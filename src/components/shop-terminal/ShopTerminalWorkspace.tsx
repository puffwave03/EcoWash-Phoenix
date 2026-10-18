"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PrintOrderActions, type PrintActionText } from "@/components/printing/PrintOrderActions";
import { PortalMedia } from "@/components/portal/PortalMedia";
import type { PosSession } from "@/features/pos/types";
import { isDiscreteServiceUnit } from "@/features/services/types";
import { resolveProductionAssignee } from "@/features/shop-terminal/production-assignee";
import { parsePersistedDeliveryDraft, readDraftMap, type PersistedDeliveryDraft } from "@/features/shop-terminal/draft-storage";
import { canCorrectRejectedSubmission } from "@/features/shop-terminal/submission-rejection";
import { createSubmissionFlight } from "@/features/shop-terminal/submission-flight";
import { resolveShopCategoryLabel } from "@/features/shop-terminal/category-label";
import { SALES_WORKSPACES, inspectWorkspaceDiscard, legacyDraftKey, parseStoredWorkspaceCustomer, parseWorkspace, workspaceCustomerKey, workspaceDraftKey, workspaceNamespace, workspaceOccupied, workspaceSelectionKey, workspaceSubmissionKey, workspaceWalkInKey, type SalesWorkspace } from "@/features/shop-terminal/workspace-storage";
import { persistSubmissionAttempt, readSubmissionAttempt, removeSubmissionAttempt, type SubmissionAttempt } from "@/features/shop-terminal/submission-recovery";
import type { ShopAssignmentOption, ShopCatalogSelection, ShopCodeResolveResult, ShopCustomer, ShopCustomerState, ShopDeliveryAddress, ShopDeliveryOptions, ShopService, ShopSubmitState, ShopSubmissionStatusResult } from "@/features/shop-terminal/types";
import { Link, useRouter } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/number-format";
import { QuickDropTerminalPanel, type QuickDropText } from "@/components/quick-drop/QuickDropTerminalPanel";
import type { PendingQuickDrop, QuickDropCreateResult } from "@/features/quick-drop/types";

type CartLine = { quantity: number; service: ShopService };
type CustomerMode = "regular" | "walk_in" | null;
type DeliveryDraft = PersistedDeliveryDraft;
type ShopTerminalDraft = {
  cardReference: string;
  customerNotes: string;
  discount: number;
  dueAt: string;
  internalNotes: string;
  items: Array<{ quantity: number; serviceId: string }>;
  delivery: DeliveryDraft;
  productionAssigneeId?: string;
  showSplitPayment: boolean;
  splitCard: number;
  splitCash: number;
};

export type ShopTerminalText = {
  addCustomer: string; basePrice: string; card: string; cardReference: string; cart: string;
  cash: string; catalog: string; categoryAll: string; changeCustomer: string; clear: string;
  confirmSplit: string; continueToCatalog: string; currentCustomer: string; customer: string;
  customerEmail: string; customerName: string; customerPhone: string; customerSearch: string;
  discount: string; dueAt: string; emptyCart: string; emptyCatalog: string; errorDiscount: string;
  errorClosedDay: string; errorGeneric: string; errorInbound: string; errorTill: string; errorValidation: string; loadingCatalog: string;
  newCustomer: string; newOrder: string; noCustomer: string; notes: string; occasionalCustomer: string;
  occasionalHelp: string; openOrder: string; openTill: string; operator: string; orderSuccess: string; invoice: string;
  outstanding: string; paid: string; payLater: string; payNow: string; payment: string;
  paymentCard: string; paymentCash: string; paymentSplit: string; priceFrom: string; printerSettings: string;
  quantity: string; recentCustomers: string; regularCustomer: string; regularHelp: string; remove: string;
  searchingCustomers: string; noCustomerMatches: string;
  saveCustomer: string; saving: string; searchServices: string; segmentPrice: string; selectCustomer: string;
  segmentCatalog: string;
  catalogLoadError: string; retryCatalog: string;
  splitCard: string; splitCash: string; splitPayment: string; subtotal: string; tillManagement: string;
  tillClosed: string; tillOpen: string; title: string; total: string; unitTypes: Record<string, string>;
  scanCode: string; scanPlaceholder: string; scanSubmit: string; scanning: string; scanInvalid: string; scanNotFound: string;
  addressLine1: string; addressLine2: string; city: string; contactName: string; contactPhone: string;
  countryCode: string; delivery: string; deliveryAssignee: string; deliveryNotes: string;
  deliveryProperty: string; deliveryScheduledAt: string; loadingDelivery: string; manualAddress: string;
  noAssignee: string; postalCode: string; productionAssignee: string;
  workspace: string; workspaceAvailable: string; workspaceInProgress: string; workspaceSelected: string;
  workspacePrompt: string; workspaceDiscard: string; workspaceDiscardConfirm: string;
  workspaceLocationRequired: string; workspaceStorageError: string; legacyDraftNotice: string; resumeOccasional: string;
  workspaceSwitchBlocked: string; workspaceRetrySave: string; workspaceCleanupError: string; workspaceRetryCleanup: string;
  workspaceDraftLoadError: string; workspaceRetryLoad: string;
  submissionRejected: string; submissionCorrectDraft: string;
  submissionSaveError: string; submissionSaving: string; submissionUnknown: string; submissionPending: string; submissionNotFound: string;
  submissionCheck: string; submissionRetry: string; submissionCompleted: string; submissionStorageLost: string;
};

type Props = {
  actions: {
    createCustomer: (state: ShopCustomerState, formData: FormData) => Promise<ShopCustomerState>;
    loadDeliveryOptions: (customerId: string) => Promise<ShopDeliveryOptions>;
    loadServices: (customerId: string, locationId: string | null) => Promise<ShopCatalogSelection>;
    createQuickDrop: (formData: FormData) => Promise<QuickDropCreateResult>;
    resolveCode: (raw: string) => Promise<ShopCodeResolveResult>;
    searchCustomers: (rawQuery: string) => Promise<ShopCustomer[]>;
    submit: (state: ShopSubmitState, formData: FormData) => Promise<ShopSubmitState>;
    submissionStatus: (key: string) => Promise<ShopSubmissionStatusResult>;
  };
  canConfigurePrinters: boolean;
  canInvoice: boolean;
  canPrint: boolean;
  canScan: boolean;
  categoryLabels: Record<string, string>;
  defaultCountryCode: string | null;
  defaultCurrency: string;
  customers: ShopCustomer[];
  deliveryAssignments: ShopAssignmentOption[];
  draftLocationId: string | null;
  locale: string;
  operatorName: string;
  organizationId: string;
  organizationName: string;
  pendingQuickDrops: PendingQuickDrop[];
  printText: PrintActionText;
  defaultProductionAssigneeId: string | null;
  productionAssignments: ShopAssignmentOption[];
  quickDropText: QuickDropText;
  quickDropClosed: boolean;
  role: string;
  session: PosSession | null;
  text: ShopTerminalText;
};

const initialCustomerState: ShopCustomerState = { customer: null, error: null };
const initialSubmitState: ShopSubmitState = { error: null, result: null };
const roundMoney = (value: number) => Math.round(value * 100) / 100;

function emptyDeliveryDraft(defaultAssignee = "", defaultCountryCode = ""): DeliveryDraft {
  return {
    addressLine1: "",
    addressLine2: "",
    assignedTo: defaultAssignee,
    city: "",
    contactName: "",
    contactPhone: "",
    countryCode: defaultCountryCode,
    notes: "",
    postalCode: "",
    propertyId: "",
    requested: false,
    scheduledAt: "",
  };
}

function parseDeliveryDraft(value: unknown): DeliveryDraft | null {
  return parsePersistedDeliveryDraft(value);
}

function parseStoredDraft(value: unknown): ShopTerminalDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  const allowedFields = new Set(["cardReference", "customerNotes", "discount", "dueAt", "internalNotes", "items", "delivery", "productionAssigneeId", "showSplitPayment", "splitCard", "splitCash"]);
  if (Object.keys(draft).some((field) => !allowedFields.has(field))) return null;
  if (
    typeof draft.cardReference !== "string"
    || typeof draft.customerNotes !== "string"
    || typeof draft.discount !== "number" || !Number.isFinite(draft.discount) || draft.discount < 0
    || typeof draft.dueAt !== "string"
    || typeof draft.internalNotes !== "string"
    || !Array.isArray(draft.items)
    || typeof draft.showSplitPayment !== "boolean"
    || typeof draft.splitCard !== "number" || !Number.isFinite(draft.splitCard) || draft.splitCard < 0
    || typeof draft.splitCash !== "number" || !Number.isFinite(draft.splitCash) || draft.splitCash < 0
    || (draft.productionAssigneeId !== undefined && typeof draft.productionAssigneeId !== "string")
  ) return null;
  const delivery = parseDeliveryDraft(draft.delivery);
  if (!delivery) return null;
  const items: ShopTerminalDraft["items"] = [];
  for (const value of draft.items) {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some((field) => field !== "serviceId" && field !== "quantity")
      || typeof item.serviceId !== "string" || !item.serviceId
      || typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0) return null;
    items.push({ quantity: item.quantity, serviceId: item.serviceId });
  }
  return {
    cardReference: draft.cardReference,
    customerNotes: draft.customerNotes,
    discount: draft.discount,
    dueAt: draft.dueAt,
    internalNotes: draft.internalNotes,
    items,
    delivery,
    productionAssigneeId: typeof draft.productionAssigneeId === "string" ? draft.productionAssigneeId : undefined,
    showSplitPayment: draft.showSplitPayment,
    splitCard: draft.splitCard,
    splitCash: draft.splitCash,
  };
}

function loadCustomerDrafts(storageKey: string) {
  try { return readDraftMap(window.sessionStorage, storageKey, parseStoredDraft); }
  catch { return { kind: "read_error" as const }; }
}

function persistCustomerDrafts(storageKey: string, drafts: Map<string, ShopTerminalDraft>) {
  try {
    if (!drafts.size) {
      window.sessionStorage.removeItem(storageKey);
      return window.sessionStorage.getItem(storageKey) === null;
    }
    const serialized = JSON.stringify(Array.from(drafts.entries()));
    window.sessionStorage.setItem(storageKey, serialized);
    return window.sessionStorage.getItem(storageKey) === serialized;
  } catch {
    return false;
  }
}

function readStoredCustomer(storageKey: string):
  { kind: "missing" | "invalid" | "read_error" } | { kind: "present"; customer: ShopCustomer } {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw === null) return { kind: "missing" };
    const customer = parseStoredWorkspaceCustomer(raw);
    return customer ? { kind: "present", customer } : { kind: "invalid" };
  } catch {
    return { kind: "read_error" };
  }
}

function persistStoredCustomer(storageKey: string, customer: ShopCustomer | null) {
  try {
    if (customer) {
      const serialized = JSON.stringify({
      id: customer.id,
      isWalkIn: customer.isWalkIn,
      name: customer.name,
      phone: customer.isWalkIn ? customer.phone : null,
      email: null,
      updatedAt: customer.updatedAt,
      } satisfies ShopCustomer);
      window.sessionStorage.setItem(storageKey, serialized);
      return window.sessionStorage.getItem(storageKey) === serialized;
    }
    window.sessionStorage.removeItem(storageKey);
    return window.sessionStorage.getItem(storageKey) === null;
  } catch {
    return false;
  }
}

function browserSubmissionStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

function readBrowserSubmission(key: string) {
  const storage = browserSubmissionStorage();
  return storage ? readSubmissionAttempt(storage, key) : { kind: "unavailable" as const };
}

function persistBrowserSubmission(key: string, attempt: SubmissionAttempt) {
  const storage = browserSubmissionStorage();
  return storage ? persistSubmissionAttempt(storage, key, attempt) : false;
}

function removeBrowserSubmission(key: string) {
  const storage = browserSubmissionStorage();
  return storage ? removeSubmissionAttempt(storage, key) : false;
}

export function ShopTerminalWorkspace(props: Props) {
  const { draftLocationId, organizationId, session, text } = props;
  const namespace = workspaceNamespace(organizationId, draftLocationId);
  const [selected, setSelected] = useState<SalesWorkspace | null>(null);
  const [occupied, setOccupied] = useState<Record<number, boolean>>({});
  const [legacyPresent, setLegacyPresent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [switchBlocked, setSwitchBlocked] = useState(false);
  const [discardBlocked, setDiscardBlocked] = useState<"submission" | "unreadable" | null>(null);
  const saveActiveDraftRef = useRef<(() => boolean) | null>(null);
  const selectionMadeRef = useRef(false);
  const updateOccupied = useCallback((workspace: SalesWorkspace, value: boolean) => {
    setOccupied((current) => ({ ...current, [workspace]: value }));
  }, []);
  const onActiveOccupiedChange = useCallback((value: boolean) => {
    if (selected !== null) updateOccupied(selected, value);
  }, [selected, updateOccupied]);
  const reportStorageFailure = useCallback(() => setStorageError(true), []);

  useEffect(() => {
    selectionMadeRef.current = false;
    const timer = window.setTimeout(() => {
      try {
        const storage = window.sessionStorage;
        if (!selectionMadeRef.current) setSelected(parseWorkspace(storage.getItem(workspaceSelectionKey(namespace))));
        setOccupied(Object.fromEntries(SALES_WORKSPACES.map((workspace) => [workspace, workspaceOccupied(storage, namespace, workspace)])));
        const legacyKeys = new Set([
          legacyDraftKey(organizationId, null),
          legacyDraftKey(organizationId, draftLocationId),
          legacyDraftKey(organizationId, session?.locationId ?? null),
        ]);
        setLegacyPresent([...legacyKeys].some((key) => {
          const value = storage.getItem(key);
          return Boolean(value && value !== "[]");
        }));
      } catch { setStorageError(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftLocationId, namespace, organizationId, session?.locationId]);

  function chooseWorkspace(workspace: SalesWorkspace) {
    if (busy || !draftLocationId) return;
    if (workspace === selected) return;
    if (saveActiveDraftRef.current && !saveActiveDraftRef.current()) {
      setStorageError(true);
      setSwitchBlocked(true);
      return;
    }
    try { window.sessionStorage.setItem(workspaceSelectionKey(namespace), String(workspace)); } catch {
      setStorageError(true);
      return;
    }
    setStorageError(false);
    setSwitchBlocked(false);
    selectionMadeRef.current = true;
    setSelected(workspace);
  }

  function discardWorkspace(workspace: SalesWorkspace) {
    const storage = browserSubmissionStorage();
    if (!storage) {
      setDiscardBlocked("unreadable");
      return;
    }
    const inspected = inspectWorkspaceDiscard(storage, namespace, workspace, (raw) =>
      readDraftMap({ getItem: () => raw }, workspaceDraftKey(namespace, workspace), parseStoredDraft).kind === "loaded");
    if (inspected.kind !== "ready") {
      setDiscardBlocked(inspected.kind);
      return;
    }
    try {
      for (const key of inspected.keys) storage.removeItem(key);
    } catch {
      setStorageError(true);
      return;
    }
    setStorageError(false);
    setDiscardBlocked(null);
    setOccupied((current) => ({ ...current, [workspace]: false }));
    setSelected(null);
  }

  const workspaceButtons = (
    <nav aria-label={text.workspacePrompt} className="flex flex-wrap gap-2 border-b border-border bg-white px-3 py-3 sm:px-5">
      {SALES_WORKSPACES.map((workspace) => <button aria-current={selected === workspace ? "step" : undefined} className={`min-h-12 min-w-24 rounded-control border px-3 text-left text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${selected === workspace ? "border-primary bg-primary text-white" : "border-border bg-white text-primary"}`} disabled={busy || !draftLocationId} key={workspace} onClick={() => chooseWorkspace(workspace)} type="button"><span className="block">{text.workspace} {workspace}</span><span className="block text-xs font-medium opacity-80">{occupied[workspace] ? text.workspaceInProgress : text.workspaceAvailable}{selected === workspace ? ` · ${text.workspaceSelected}` : ""}</span></button>)}
    </nav>
  );

  return <div className="counter-register-shell min-h-screen bg-[#eef1ed]">
    {workspaceButtons}
    {!draftLocationId ? <p className="mx-3 mt-3 rounded-control border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:mx-5" role="status">{text.workspaceLocationRequired}</p> : null}
    {storageError ? <p className="mx-3 mt-3 rounded-control border border-red-300 bg-red-50 p-3 text-sm text-red-900 sm:mx-5" role="alert">{text.workspaceStorageError}</p> : null}
    {switchBlocked ? <p className="mx-3 mt-3 rounded-control border border-red-300 bg-red-50 p-3 text-sm text-red-900 sm:mx-5" role="alert">{text.workspaceSwitchBlocked}</p> : null}
    {discardBlocked ? <p className="mx-3 mt-3 rounded-control border border-red-300 bg-red-50 p-3 text-sm text-red-900 sm:mx-5" role="alert">{discardBlocked === "submission" ? text.submissionUnknown : text.workspaceDraftLoadError}</p> : null}
    {storageError && selected !== null ? <button className="mx-3 mt-2 min-h-11 rounded-control border border-primary px-4 text-sm font-bold text-primary sm:mx-5" onClick={() => { if (saveActiveDraftRef.current?.()) { setStorageError(false); setSwitchBlocked(false); } }} type="button">{text.workspaceRetrySave}</button> : null}
    {legacyPresent ? <p className="mx-3 mt-3 rounded-control border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:mx-5" role="status">{text.legacyDraftNotice}</p> : null}
    {selected === null || !draftLocationId ? <p className="px-5 py-10 text-center text-lg font-semibold text-primary">{text.workspacePrompt}</p> : <>
      <div className="flex justify-end px-3 pt-3 sm:px-5"><button className="min-h-11 rounded-control border border-red-300 bg-white px-4 text-sm font-bold text-red-800 disabled:opacity-50" disabled={busy} onClick={() => { if (window.confirm(text.workspaceDiscardConfirm)) discardWorkspace(selected); }} type="button">{text.workspaceDiscard}</button></div>
      <SaleWorkspace key={`${namespace}:${selected}`} {...props} namespace={namespace} onBusyChange={setBusy} onOccupiedChange={onActiveOccupiedChange} onRegisterSave={(save) => { saveActiveDraftRef.current = save; }} onStorageFailure={reportStorageFailure} workspace={selected} />
    </>}
  </div>;
}

type SaleProps = Props & { namespace: string; onBusyChange: (busy: boolean) => void; onOccupiedChange: (occupied: boolean) => void; onRegisterSave: (save: (() => boolean) | null) => void; onStorageFailure: () => void; workspace: SalesWorkspace };

function SaleWorkspace({ actions, canConfigurePrinters, canInvoice, canPrint, canScan, categoryLabels, customers: initialCustomers, defaultCountryCode, defaultCurrency, defaultProductionAssigneeId, deliveryAssignments, locale, namespace, onBusyChange, onOccupiedChange, onRegisterSave, onStorageFailure, operatorName, organizationName, pendingQuickDrops, printText, productionAssignments, quickDropClosed, quickDropText, role, session, text, workspace }: SaleProps) {
  const router = useRouter();
  const draftStorageKey = workspaceDraftKey(namespace, workspace);
  const activeCustomerStorageKey = workspaceCustomerKey(namespace, workspace);
  const walkInStorageKey = workspaceWalkInKey(namespace, workspace);
  const submissionStorageKey = workspaceSubmissionKey(namespace, workspace);
  const [customers, setCustomers] = useState(initialCustomers);
  const [walkInCustomer, setWalkInCustomer] = useState<ShopCustomer | null>(null);
  const [recentCustomers, setRecentCustomers] = useState(initialCustomers);
  const [customerSearchResults, setCustomerSearchResults] = useState<{ query: string; customers: ShopCustomer[] }>({ query: "", customers: [] });
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(true);
  const [customerMode, setCustomerMode] = useState<CustomerMode>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [services, setServices] = useState<ShopService[]>([]);
  const [segmentName, setSegmentName] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [splitCash, setSplitCash] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const [cardReference, setCardReference] = useState("");
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const resolvedProductionDefault = resolveProductionAssignee(productionAssignments, defaultProductionAssigneeId);
  const [productionAssigneeId, setProductionAssigneeId] = useState(resolvedProductionDefault);
  const [delivery, setDelivery] = useState<DeliveryDraft>(() => emptyDeliveryDraft(deliveryAssignments[0]?.id, defaultCountryCode ?? ""));
  const [deliveryOptions, setDeliveryOptions] = useState<ShopDeliveryOptions | null>(null);
  const [dismissedOrderId, setDismissedOrderId] = useState<string | null>(null);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const [attempt, setAttempt] = useState<SubmissionAttempt | null>(null);
  const [attemptLoaded, setAttemptLoaded] = useState(false);
  const [draftHydration, setDraftHydration] = useState<"loading" | "error" | "ready">("loading");
  const [attemptStorageLost, setAttemptStorageLost] = useState(false);
  const [attemptPersistenceFailed, setAttemptPersistenceFailed] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<ShopSubmissionStatusResult["status"] | null>(null);
  const [reconciledOrder, setReconciledOrder] = useState<{ id: string; number: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [definitiveRejection, setDefinitiveRejection] = useState<string | null>(null);
  const [, startLoading] = useTransition();
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isResolving, startResolving] = useTransition();
  const [isLoadingDelivery, startLoadingDelivery] = useTransition();
  const [scanError, setScanError] = useState<ShopCodeResolveResult["error"]>(null);
  const [scanValue, setScanValue] = useState("");
  const [customerState, createCustomer, isCreatingCustomer] = useActionState(async (state: ShopCustomerState, formData: FormData) => {
    const result = await actions.createCustomer(state, formData);
    if (result.customer) {
      setCustomers((current) => [result.customer!, ...current.filter((customer) => customer.id !== result.customer!.id)]);
      if (!result.customer.isWalkIn) setRecentCustomers((current) => [result.customer!, ...current.filter((customer) => customer.id !== result.customer!.id)].slice(0, 8));
      if (result.customer.isWalkIn) {
        setWalkInCustomer(result.customer);
        if (!persistStoredCustomer(walkInStorageKey, result.customer)) onStorageFailure();
      }
      selectCustomer(result.customer.id, result.customer);
      setCustomerMode(null);
      setCustomerQuery("");
    }
    return result;
  }, initialCustomerState);
  const [submitState, submit, isSubmitting] = useActionState(async (state: ShopSubmitState, _formData: FormData) => {
    void _formData;
    const stored = readBrowserSubmission(submissionStorageKey);
    if (stored.kind !== "present" || stored.attempt.status !== "pending"
      || stored.attempt.key !== attemptRef.current?.key || stored.attempt.payload !== attemptRef.current.payload) {
      const token = initialSubmissionTokenRef.current;
      if (token !== null) flightRef.current.endSubmission(token);
      initialSubmissionTokenRef.current = null;
      setAttemptStorageLost(true);
      return { error: "storage", result: null };
    }
    const frozen = new FormData();
    frozen.set("payload", stored.attempt.payload);
    const token = initialSubmissionTokenRef.current;
    initialSubmissionTokenRef.current = null;
    if (token === null || !flightRef.current.isCurrentSubmission(token)) {
      setRecoveryStatus("unknown");
      return { error: "unknown", result: null };
    }
    const firstDispatch = firstDispatchKeyRef.current === stored.attempt.key;
    firstDispatchKeyRef.current = null;
    try {
      const result = await actions.submit(state, frozen);
      if (result.result) initialResultTokenRef.current = token;
      else if (result.error) handleSubmissionError(stored.attempt, result, firstDispatch, token);
      else {
        flightRef.current.endSubmission(token);
        setRecoveryStatus("unknown");
      }
      return result;
    } catch {
      flightRef.current.endSubmission(token);
      setRecoveryStatus("unknown");
      return { error: "unknown", result: null };
    }
  }, initialSubmitState);

  useEffect(() => {
    onBusyChange(isSubmitting || isCreatingCustomer);
    return () => onBusyChange(false);
  }, [isCreatingCustomer, isSubmitting, onBusyChange]);
  const payloadRef = useRef<HTMLInputElement>(null);
  const flightRef = useRef(createSubmissionFlight());
  const initialSubmissionTokenRef = useRef<number | null>(null);
  const initialResultTokenRef = useRef<number | null>(null);
  const firstDispatchKeyRef = useRef<string | null>(null);
  const attemptRef = useRef<SubmissionAttempt | null>(null);
  const catalogRequestRef = useRef(0);
  const catalogCustomerRef = useRef<string | null>(null);
  const selectedCustomerIdRef = useRef("");
  const deliveryRequestRef = useRef(0);
  const customerSearchRequestRef = useRef(0);
  const customerDraftsRef = useRef(new Map<string, ShopTerminalDraft>());
  const hydratedDraftStorageKeyRef = useRef<string | null>(null);
  const mobileCartCloseRef = useRef<HTMLButtonElement>(null);

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const selectedCustomerName = selectedCustomer?.isWalkIn
    ? selectedCustomer.name || text.occasionalCustomer
    : selectedCustomer?.name ?? null;
  const currency = services[0]?.currency ?? defaultCurrency;
  const subtotal = roundMoney(cart.reduce((sum, line) => sum + line.quantity * line.service.amount, 0));
  const safeDiscount = Math.min(Math.max(roundMoney(discount || 0), 0), subtotal);
  const total = roundMoney(subtotal - safeDiscount);
  const canDiscount = role === "owner" || role === "manager";
  const cartByServiceId = useMemo(() => new Map(cart.map((line) => [line.service.id, line])), [cart]);

  const normalizedCustomerQuery = customerQuery.trim();
  const filteredCustomers = normalizedCustomerQuery
    ? !isSearchingCustomers && customerSearchResults.query === normalizedCustomerQuery ? customerSearchResults.customers : []
    : recentCustomers;
  const categories = useMemo(() => {
    const options = new Map<string, string>();
    for (const service of services) {
      if (service.categoryKey && !options.has(service.categoryKey)) {
        options.set(service.categoryKey, resolveShopCategoryLabel(service.categoryKey, service.category, categoryLabels));
      }
    }
    return Array.from(options, ([key, label]) => ({ key, label }));
  }, [categoryLabels, services]);
  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLocaleLowerCase(locale);
    return services.filter((service) => (category === "all" || service.categoryKey === category)
      && (!query || [service.name, service.code, service.description, service.category, service.categoryKey ? resolveShopCategoryLabel(service.categoryKey, service.category, categoryLabels) : null].some((value) => value?.toLocaleLowerCase(locale).includes(query))));
  }, [category, categoryLabels, locale, serviceQuery, services]);

  function hydrateCustomerDrafts() {
    const loaded = loadCustomerDrafts(draftStorageKey);
    const storedWalkIn = readStoredCustomer(walkInStorageKey);
    const storedCustomer = readStoredCustomer(activeCustomerStorageKey);
    if (loaded.kind !== "loaded" || !["missing", "present"].includes(storedWalkIn.kind)
      || (storedWalkIn.kind === "present" && !storedWalkIn.customer.isWalkIn)
      || !["missing", "present"].includes(storedCustomer.kind)) {
      setDraftHydration("error");
      return;
    }
    customerDraftsRef.current = loaded.drafts;
    hydratedDraftStorageKeyRef.current = draftStorageKey;
    setDraftHydration("ready");
    if (storedWalkIn.kind === "present" && storedWalkIn.customer.isWalkIn) {
      setWalkInCustomer(storedWalkIn.customer);
      setCustomers((current) => [storedWalkIn.customer, ...current.filter((customer) => customer.id !== storedWalkIn.customer.id)]);
    }
    if (storedCustomer.kind === "present") selectCustomer(storedCustomer.customer.id, storedCustomer.customer);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = readBrowserSubmission(submissionStorageKey);
      if (restored.kind === "present") {
        attemptRef.current = restored.attempt;
        setAttempt(restored.attempt);
        if (restored.attempt.status === "rejected") setDefinitiveRejection(restored.attempt.rejectionReason ?? null);
        if (restored.attempt.status === "completed" && restored.attempt.orderId && restored.attempt.orderNumber) {
          setReconciledOrder({ id: restored.attempt.orderId, number: restored.attempt.orderNumber });
        }
      } else if (restored.kind !== "missing") setAttemptStorageLost(true);
      setAttemptLoaded(true);
      hydrateCustomerDrafts();
    }, 0);
    return () => window.clearTimeout(timer);
    // The selected customer is hydrated only when this workspace's storage keys change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCustomerStorageKey, draftStorageKey, submissionStorageKey, walkInStorageKey]);

  useEffect(() => {
    if (!normalizedCustomerQuery) return;
    const requestId = ++customerSearchRequestRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const results = await actions.searchCustomers(normalizedCustomerQuery);
        if (customerSearchRequestRef.current !== requestId) return;
        setCustomerSearchResults({ query: normalizedCustomerQuery, customers: results });
      } catch {
        if (customerSearchRequestRef.current === requestId) {
          setCustomerSearchResults({ query: normalizedCustomerQuery, customers: [] });
        }
      } finally {
        if (customerSearchRequestRef.current === requestId) setIsSearchingCustomers(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      customerSearchRequestRef.current += 1;
    };
  }, [actions, normalizedCustomerQuery]);

  useEffect(() => {
    if (!customerId || catalogCustomerRef.current !== customerId || hydratedDraftStorageKeyRef.current !== draftStorageKey) return;
    customerDraftsRef.current.set(customerId, {
      cardReference,
      customerNotes,
      delivery,
      discount,
      dueAt,
      internalNotes,
      items: cart.map((line) => ({ quantity: line.quantity, serviceId: line.service.id })),
      productionAssigneeId,
      showSplitPayment,
      splitCard,
      splitCash,
    });
    if (persistCustomerDrafts(draftStorageKey, customerDraftsRef.current)) onOccupiedChange(true);
    else onStorageFailure();
  }, [cardReference, cart, customerId, customerNotes, delivery, discount, draftStorageKey, dueAt, internalNotes, onOccupiedChange, onStorageFailure, productionAssigneeId, showSplitPayment, splitCard, splitCash]);

  useEffect(() => {
    const submittedCustomerId = submitState.result?.customerId;
    if (!submittedCustomerId || !submitState.result?.orderId || hydratedDraftStorageKeyRef.current !== draftStorageKey) return;
    const token = initialResultTokenRef.current;
    if (token === null || !flightRef.current.isCurrentSubmission(token)) return;
    initialResultTokenRef.current = null;
    const current = attemptRef.current;
    if (!current || !persistBrowserSubmission(submissionStorageKey, {
      ...current, status: "completed", orderId: submitState.result.orderId, orderNumber: submitState.result.orderNumber,
    })) {
      setCleanupFailed(true);
      setAttemptStorageLost(true);
      flightRef.current.endSubmission(token);
      return;
    }
    const completed = { ...current, status: "completed" as const, orderId: submitState.result.orderId, orderNumber: submitState.result.orderNumber };
    attemptRef.current = completed;
    setAttempt(completed);
    cleanupSubmittedDraft(submittedCustomerId, submitState.result.isWalkIn);
    flightRef.current.endSubmission(token);
    // Cleanup is tied to the confirmed order result, not to later UI state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCustomerStorageKey, draftStorageKey, submitState.result?.customerId, submitState.result?.isWalkIn, submitState.result?.orderId, submissionStorageKey, walkInStorageKey]);

  function handleSubmissionError(current: SubmissionAttempt, result: ShopSubmitState, firstDispatch: boolean, token: number) {
    if (!flightRef.current.endSubmission(token)) return;
    const proven = result.error && canCorrectRejectedSubmission(result.rejectionProof, firstDispatch);
    if (!proven || !result.error) {
      setRecoveryStatus("unknown");
      return;
    }
    const stored = readBrowserSubmission(submissionStorageKey);
    if (stored.kind !== "present" || stored.attempt.status !== "pending"
      || stored.attempt.key !== current.key || stored.attempt.payload !== current.payload) {
      setAttemptStorageLost(true);
      return;
    }
    const rejected: SubmissionAttempt = { ...current, status: "rejected", rejectionReason: result.error };
    setDefinitiveRejection(result.error);
    if (!persistBrowserSubmission(submissionStorageKey, rejected)) {
      onStorageFailure();
      return;
    }
    attemptRef.current = rejected;
    setAttempt(rejected);
  }

  function cleanupSubmittedDraft(submittedCustomerId: string, isWalkIn: boolean) {
    if (hydratedDraftStorageKeyRef.current !== draftStorageKey) {
      setCleanupFailed(true);
      return false;
    }
    customerDraftsRef.current.delete(submittedCustomerId);
    const draftRemoved = persistCustomerDrafts(draftStorageKey, customerDraftsRef.current);
    const walkInRemoved = !isWalkIn || persistStoredCustomer(walkInStorageKey, null);
    const customerRemoved = persistStoredCustomer(activeCustomerStorageKey, null);
    const markerRemoved = draftRemoved && walkInRemoved && customerRemoved
      && removeBrowserSubmission(submissionStorageKey);
    if (!draftRemoved || !walkInRemoved || !customerRemoved || !markerRemoved) {
      setCleanupFailed(true);
      onStorageFailure();
      return false;
    }
    setCleanupFailed(false);
    attemptRef.current = null;
    setAttempt(null);
    onOccupiedChange(customerDraftsRef.current.size > 0);
    return true;
  }

  useEffect(() => {
    if (!isMobileCartOpen) return;
    mobileCartCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileCartOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileCartOpen]);

  function saveCurrentCustomerDraft() {
    if (flightRef.current.hasActivity()) return false;
    if (attemptRef.current) return true;
    if (submitState.result?.orderId && dismissedOrderId !== submitState.result.orderId) return !cleanupFailed;
    if (hydratedDraftStorageKeyRef.current !== draftStorageKey) return false;
    if (!customerId || catalogCustomerRef.current !== customerId) {
      const draftsSaved = persistCustomerDrafts(draftStorageKey, customerDraftsRef.current);
      const customerSaved = persistStoredCustomer(activeCustomerStorageKey, selectedCustomer);
      const walkInSaved = !walkInCustomer || persistStoredCustomer(walkInStorageKey, walkInCustomer);
      if (!draftsSaved || !customerSaved || !walkInSaved) onStorageFailure();
      return draftsSaved && customerSaved && walkInSaved;
    }
    customerDraftsRef.current.set(customerId, {
      cardReference,
      customerNotes,
      delivery,
      discount,
      dueAt,
      internalNotes,
      items: cart.map((line) => ({ quantity: line.quantity, serviceId: line.service.id })),
      productionAssigneeId,
      showSplitPayment,
      splitCard,
      splitCash,
    });
    const draftSaved = persistCustomerDrafts(draftStorageKey, customerDraftsRef.current);
    const customerSaved = persistStoredCustomer(activeCustomerStorageKey, selectedCustomer);
    const walkInSaved = !walkInCustomer || persistStoredCustomer(walkInStorageKey, walkInCustomer);
    if (draftSaved && customerSaved && walkInSaved) onOccupiedChange(true);
    else onStorageFailure();
    return draftSaved && customerSaved && walkInSaved;
  }

  useEffect(() => {
    onRegisterSave(saveCurrentCustomerDraft);
    return () => onRegisterSave(null);
  });

  function restoreCheckoutDraft(draft: ShopTerminalDraft | undefined) {
    setDiscount(draft?.discount ?? 0);
    setSplitCash(draft?.splitCash ?? 0);
    setSplitCard(draft?.splitCard ?? 0);
    setCardReference(draft?.cardReference ?? "");
    setShowSplitPayment(draft?.showSplitPayment ?? false);
    setDueAt(draft?.dueAt ?? "");
    setCustomerNotes(draft?.customerNotes ?? "");
    setInternalNotes(draft?.internalNotes ?? "");
    setProductionAssigneeId(resolveProductionAssignee(
      productionAssignments, defaultProductionAssigneeId, draft?.productionAssigneeId,
    ));
    const restoredDelivery = draft?.delivery ?? emptyDeliveryDraft(deliveryAssignments[0]?.id, defaultCountryCode ?? "");
    setDelivery({
      ...restoredDelivery,
      assignedTo: deliveryAssignments.some((assignment) => assignment.id === restoredDelivery.assignedTo)
        ? restoredDelivery.assignedTo
        : deliveryAssignments[0]?.id ?? "",
    });
  }

  function applyDeliveryAddress(address: ShopDeliveryAddress, propertyId = "") {
    setDelivery((current) => ({ ...current, ...address, propertyId }));
  }

  function loadDeliveryOptionsForCustomer(nextCustomerId: string, prefill: boolean) {
    const requestId = deliveryRequestRef.current + 1;
    deliveryRequestRef.current = requestId;
    startLoadingDelivery(async () => {
      const options = await actions.loadDeliveryOptions(nextCustomerId);
      if (deliveryRequestRef.current !== requestId || selectedCustomerIdRef.current !== nextCustomerId) return;
      setDeliveryOptions(options);
      if (!prefill) return;
      const property = options.properties.length === 1 ? options.properties[0] : null;
      const address = property ?? (options.properties.length === 0 ? options.billing : null);
      if (address) setDelivery((current) => current.requested && !current.addressLine1
        ? { ...current, ...address, propertyId: property?.id ?? "" }
        : current);
    });
  }

  function setDeliveryRequested(requested: boolean) {
    setDelivery((current) => ({ ...current, requested }));
    if (requested && customerId) loadDeliveryOptionsForCustomer(customerId, true);
  }

  function selectDeliveryProperty(propertyId: string) {
    const property = deliveryOptions?.properties.find((option) => option.id === propertyId);
    if (property) applyDeliveryAddress(property, property.id);
    else if (!propertyId && deliveryOptions?.properties.length === 0 && deliveryOptions.billing) applyDeliveryAddress(deliveryOptions.billing);
    else setDelivery((current) => ({ ...current, propertyId }));
  }

  function reconcileDraftCart(draft: ShopTerminalDraft | undefined, freshServices: ShopService[]) {
    if (!draft) return [];
    const freshServiceById = new Map(freshServices.map((service) => [service.id, service]));
    return draft.items.flatMap((item) => {
      const service = freshServiceById.get(item.serviceId);
      return service ? [{ quantity: item.quantity, service }] : [];
    });
  }

  function selectCustomer(nextCustomerId: string, foundCustomer?: ShopCustomer, reloadCatalog = false) {
    const nextCustomer = foundCustomer ?? customers.find((customer) => customer.id === nextCustomerId);
    if (!nextCustomer) return;
    if (foundCustomer) setCustomers((current) => [foundCustomer, ...current.filter((customer) => customer.id !== foundCustomer.id)]);
    if (nextCustomerId === customerId) {
      if (!reloadCatalog) {
        setCustomerMode(null);
        setIsCustomerPickerOpen(false);
        return;
      }
    }
    if (!saveCurrentCustomerDraft()) return;
    if (!persistStoredCustomer(activeCustomerStorageKey, nextCustomer)) {
      onStorageFailure();
      return;
    }
    onOccupiedChange(true);
    const nextDraft = customerDraftsRef.current.get(nextCustomerId);
    const requestId = catalogRequestRef.current + 1;
    catalogRequestRef.current = requestId;
    catalogCustomerRef.current = null;
    setCatalogStatus("loading");
    selectedCustomerIdRef.current = nextCustomerId;
    setCustomerId(nextCustomerId);
    setCustomerMode(null);
    setCustomerQuery("");
    setIsCustomerPickerOpen(false);
    setServices([]);
    setSegmentName(null);
    setCart([]);
    setIsMobileCartOpen(false);
    setCategory("all");
    setServiceQuery("");
    setDeliveryOptions(null);
    restoreCheckoutDraft(nextDraft);
    if (nextDraft?.delivery.requested) loadDeliveryOptionsForCustomer(nextCustomerId, false);
    startLoading(async () => {
      try {
        const catalog = await actions.loadServices(nextCustomerId, session?.locationId ?? null);
        if (catalogRequestRef.current !== requestId) return;
        catalogCustomerRef.current = nextCustomerId;
        setServices(catalog.services);
        setSegmentName(catalog.segmentName);
        setCart(reconcileDraftCart(nextDraft, catalog.services));
        setCatalogStatus("ready");
      } catch {
        if (catalogRequestRef.current !== requestId) return;
        setCatalogStatus("error");
      }
    });
  }

  function openCustomerPicker() {
    setCustomerMode(null);
    setIsCustomerPickerOpen(true);
  }

  function clearCustomer(options: { preserveDraft?: boolean } = {}) {
    if (customerId && !options.preserveDraft) {
      customerDraftsRef.current.delete(customerId);
      persistCustomerDrafts(draftStorageKey, customerDraftsRef.current);
    }
    if (selectedCustomer?.isWalkIn && !options.preserveDraft) {
      persistStoredCustomer(walkInStorageKey, null);
      setWalkInCustomer(null);
    }
    persistStoredCustomer(activeCustomerStorageKey, null);
    onOccupiedChange(customerDraftsRef.current.size > 0);
    catalogRequestRef.current += 1;
    deliveryRequestRef.current += 1;
    catalogCustomerRef.current = null;
    selectedCustomerIdRef.current = "";
    setCustomerId("");
    setServices([]);
    setSegmentName(null);
    setCart([]);
    setIsMobileCartOpen(false);
    setCategory("all");
    setCustomerMode(null);
    setIsCustomerPickerOpen(true);
    setDiscount(0);
    setSplitCash(0);
    setSplitCard(0);
    setCardReference("");
    setShowSplitPayment(false);
    setDueAt("");
    setCustomerNotes("");
    setInternalNotes("");
    setProductionAssigneeId(resolvedProductionDefault);
    setDelivery(emptyDeliveryDraft(deliveryAssignments[0]?.id, defaultCountryCode ?? ""));
    setDeliveryOptions(null);
  }

  function addService(service: ShopService) {
    setCart((current) => {
      const existing = current.find((line) => line.service.id === service.id);
      if (!existing) return [...current, { quantity: 1, service }];
      const increment = isDiscreteServiceUnit(service.unitType) ? 1 : 0.1;
      return current.map((line) => line.service.id === service.id
        ? { ...line, quantity: Math.round((line.quantity + increment) * 1000) / 1000 }
        : line);
    });
  }

  function updateQuantity(serviceId: string, raw: number) {
    setCart((current) => current.map((line) => {
      if (line.service.id !== serviceId) return line;
      const discrete = isDiscreteServiceUnit(line.service.unitType);
      const quantity = discrete ? Math.trunc(raw) : Math.round(raw * 1000) / 1000;
      return { ...line, quantity: Math.max(quantity, discrete ? 1 : 0.001) };
    }));
  }

  function adjustQuantity(line: CartLine, direction: -1 | 1) {
    updateQuantity(line.service.id, line.quantity + direction * (isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.1));
  }

  function removeCartLine(serviceId: string) {
    if (cart.length === 1) setIsMobileCartOpen(false);
    setCart((current) => current.filter((item) => item.service.id !== serviceId));
  }

  function clearCart() {
    setIsMobileCartOpen(false);
    setCart([]);
  }

  function continueToCheckout() {
    setIsMobileCartOpen(false);
    requestAnimationFrame(() => document.getElementById("terminal-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function prepareSubmission(event: React.FormEvent<HTMLFormElement>) {
    if (!customerId || catalogCustomerRef.current !== customerId) {
      event.preventDefault();
      return;
    }
    if (!attemptLoaded || draftHydration !== "ready" || attemptStorageLost || flightRef.current.hasActivity() || attemptRef.current) {
      event.preventDefault();
      setRecoveryStatus("unknown");
      return;
    }
    const intent = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value ?? "later";
    const formData = new FormData(event.currentTarget);
    const payments = intent === "cash"
      ? [{ amount: total, idempotencyKey: crypto.randomUUID(), method: "cash" }]
      : intent === "card"
        ? [{ amount: total, idempotencyKey: crypto.randomUUID(), method: "card", reference: cardReference }]
        : intent === "split"
          ? [
              ...(splitCash > 0 ? [{ amount: roundMoney(splitCash), idempotencyKey: crypto.randomUUID(), method: "cash" }] : []),
              ...(splitCard > 0 ? [{ amount: roundMoney(splitCard), idempotencyKey: crypto.randomUUID(), method: "card", reference: cardReference }] : []),
            ]
          : [];
    const payload = {
      customerId,
      customerName: selectedCustomerName,
      customerNotes: formData.get("customerNotes"),
      discountAmount: safeDiscount,
      dueAt: formData.get("dueAt"),
      productionAssigneeId: productionAssigneeId || null,
      deliveryRequested: delivery.requested,
      delivery: delivery.requested ? {
        addressLine1: delivery.addressLine1,
        addressLine2: delivery.addressLine2,
        assignedTo: delivery.assignedTo || null,
        city: delivery.city,
        contactName: delivery.contactName,
        contactPhone: delivery.contactPhone,
        countryCode: delivery.countryCode,
        notes: delivery.notes,
        postalCode: delivery.postalCode,
        scheduledAt: delivery.scheduledAt,
      } : null,
      idempotencyKey: crypto.randomUUID(),
      internalNotes: formData.get("internalNotes"),
      items: cart.map((line) => ({ quantity: line.quantity, serviceId: line.service.id })),
      locationId: session?.locationId ?? null,
      payments,
      sessionId: intent === "later" ? null : session?.id ?? null,
      isWalkIn: selectedCustomer?.isWalkIn ?? false,
      walkInName: selectedCustomer?.isWalkIn ? selectedCustomer.name || null : null,
      walkInPhone: selectedCustomer?.isWalkIn ? selectedCustomer.phone : null,
    };
    const serialized = JSON.stringify(payload);
    const nextAttempt: SubmissionAttempt = {
      version: 1, key: payload.idempotencyKey, payload: serialized,
      status: "pending", orderId: null, orderNumber: null,
    };
    const stored = readBrowserSubmission(submissionStorageKey);
    if (stored.kind === "present") {
      event.preventDefault();
      attemptRef.current = stored.attempt;
      setAttempt(stored.attempt);
      setRecoveryStatus("unknown");
      return;
    }
    if (stored.kind !== "missing") {
      event.preventDefault();
      setAttemptStorageLost(true);
      return;
    }
    if (!persistBrowserSubmission(submissionStorageKey, nextAttempt)) {
      event.preventDefault();
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      setAttemptPersistenceFailed(true);
      return;
    }
    attemptRef.current = nextAttempt;
    setAttempt(nextAttempt);
    const token = flightRef.current.beginSubmission();
    if (token === null) {
      event.preventDefault();
      setRecoveryStatus("unknown");
      return;
    }
    initialSubmissionTokenRef.current = token;
    firstDispatchKeyRef.current = nextAttempt.key;
    setDefinitiveRejection(null);
    if (payloadRef.current) payloadRef.current.value = serialized;
  }

  function retryAttemptPersistence() {
    const current = attemptRef.current;
    if (!attemptPersistenceFailed || !current) return;
    const stored = readBrowserSubmission(submissionStorageKey);
    if (stored.kind !== "missing" && (stored.kind !== "present"
      || stored.attempt.key !== current.key || stored.attempt.payload !== current.payload)) return;
    if (persistBrowserSubmission(submissionStorageKey, current)) {
      setAttemptPersistenceFailed(false);
      setRecoveryStatus("not_found");
    }
  }

  function confirmRecoveredOrder(current: SubmissionAttempt, orderId: string, orderNumber: string) {
    const completed: SubmissionAttempt = { ...current, status: "completed", orderId, orderNumber };
    setReconciledOrder({ id: orderId, number: orderNumber });
    if (!persistBrowserSubmission(submissionStorageKey, completed)) {
      setAttemptStorageLost(true);
      setCleanupFailed(true);
      return;
    }
    attemptRef.current = completed;
    setAttempt(completed);
    try {
      const payload = JSON.parse(current.payload) as { customerId?: string; isWalkIn?: boolean };
      if (payload.customerId) cleanupSubmittedDraft(payload.customerId, payload.isWalkIn === true);
      else setCleanupFailed(true);
    } catch { setCleanupFailed(true); }
  }

  async function checkSubmissionStatus() {
    const current = attemptRef.current;
    if (!current || current.status !== "pending" || !flightRef.current.beginStatusLookup()) return;
    const stored = readBrowserSubmission(submissionStorageKey);
    if (stored.kind !== "present" || stored.attempt.key !== current.key || stored.attempt.payload !== current.payload) {
      setAttemptStorageLost(true);
      flightRef.current.endStatusLookup();
      return;
    }
    setCheckingStatus(true);
    try {
      const result = await actions.submissionStatus(current.key);
      if (attemptRef.current?.key !== current.key || attemptRef.current?.status !== "pending") return;
      setRecoveryStatus(result.status);
      if (result.status === "completed" && result.orderId && result.orderNumber) {
        confirmRecoveredOrder(current, result.orderId, result.orderNumber);
      }
    } catch { setRecoveryStatus("unknown"); }
    finally { flightRef.current.endStatusLookup(); setCheckingStatus(false); }
  }

  async function retryIdenticalSubmission() {
    const current = attemptRef.current;
    if (!current || recoveryStatus !== "not_found") return;
    const token = flightRef.current.beginSubmission();
    if (token === null) return;
    const stored = readBrowserSubmission(submissionStorageKey);
    if (stored.kind !== "present" || stored.attempt.status !== "pending"
      || stored.attempt.key !== current.key || stored.attempt.payload !== current.payload) {
      setAttemptStorageLost(true);
      flightRef.current.endSubmission(token);
      return;
    }
    setRetrying(true);
    setRecoveryStatus("unknown");
    const frozen = new FormData();
    frozen.set("payload", current.payload);
    try {
      const result = await actions.submit(initialSubmitState, frozen);
      if (!flightRef.current.isCurrentSubmission(token)) return;
      if (result.result) confirmRecoveredOrder(current, result.result.orderId, result.result.orderNumber);
      else if (result.error) handleSubmissionError(current, result, false, token);
    } catch { /* The server outcome is unknown; retain the same identity. */ }
    finally { flightRef.current.endSubmission(token); setRetrying(false); }
  }

  function correctRejectedDraft() {
    const current = attemptRef.current;
    if (!current || !definitiveRejection || draftHydration !== "ready" || flightRef.current.hasActivity()) return;
    const stored = readBrowserSubmission(submissionStorageKey);
    if (stored.kind !== "present" || stored.attempt.key !== current.key || stored.attempt.payload !== current.payload
      || !["pending", "rejected"].includes(stored.attempt.status)) {
      setAttemptStorageLost(true);
      return;
    }
    if (!removeBrowserSubmission(submissionStorageKey)) {
      onStorageFailure();
      return;
    }
    attemptRef.current = null;
    setAttempt(null);
    setDefinitiveRejection(null);
    setRecoveryStatus(null);
  }

  function retryCompletedCleanup() {
    const current = attemptRef.current;
    if (!current || current.status !== "completed") return;
    try {
      const payload = JSON.parse(current.payload) as { customerId?: string; isWalkIn?: boolean };
      if (payload.customerId) cleanupSubmittedDraft(payload.customerId, payload.isWalkIn === true);
    } catch { setCleanupFailed(true); }
  }

  function resetOrder() {
    if (attemptRef.current || attemptStorageLost || cleanupFailed) return;
    setDismissedOrderId(submitState.result?.orderId ?? null);
    setReconciledOrder(null);
    if (submitState.result?.isWalkIn) setWalkInCustomer(null);
    if (submitState.result?.customerId) {
      customerDraftsRef.current.delete(submitState.result.customerId);
      persistCustomerDrafts(draftStorageKey, customerDraftsRef.current);
    }
    clearCustomer({ preserveDraft: true });
  }

  function resolveCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = scanValue.trim();
    if (!raw) return;
    setScanError(null);
    startResolving(async () => {
      const result = await actions.resolveCode(raw);
      if (result.orderId) {
        router.push(`/app/orders/${result.orderId}`);
        return;
      }
      setScanError(result.error);
    });
  }

  const terminalHeader = (
    <header className="hidden border-b border-white/10 bg-primary px-4 py-3 text-white sm:px-5 md:block">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0"><p className="truncate text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/65">{organizationName}</p><h1 className="text-xl font-black tracking-tight">{text.title}</h1></div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-control bg-white/10 px-3 py-2">{text.operator}: {operatorName}</span>
          <span className={`rounded-control px-3 py-2 ${session ? "bg-emerald-100 text-emerald-950" : "bg-white/10 text-white"}`}>{session ? text.tillOpen : text.tillClosed}{session?.locationName ? ` · ${session.locationName}` : ""}</span>
          <Link className={`rounded-control px-3 py-2 ${session ? "bg-white !text-primary" : "bg-amber-100 !text-amber-950"}`} href="/app/pos" locale={locale}>{session ? text.tillManagement : text.openTill} →</Link>
          {canConfigurePrinters ? <Link className="rounded-control border border-white/25 px-3 py-2 !text-white" href="/app/settings/printers" locale={locale}>{text.printerSettings}</Link> : null}
        </div>
      </div>
    </header>
  );

  if (submitState.result && dismissedOrderId !== submitState.result.orderId) {
    const result = submitState.result;
    return (
      <div className="counter-register-shell min-h-screen bg-[#eef1ed]">
        {terminalHeader}
        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><div className="border-l-4 border-primary bg-white p-5 shadow-card sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.12em] text-secondary">✓ {text.orderSuccess}</p><h2 className="mt-1 text-3xl font-black text-primary">{result.orderNumber}</h2><p className="mt-1 text-lg font-semibold text-muted">{result.customerName}</p></div><dl className="grid grid-cols-3 gap-3">{[[text.total, result.total], [text.paid, result.paid], [text.outstanding, result.outstanding]].map(([label, value]) => <div className="min-w-0 border-l border-border pl-3" key={String(label)}><dt className="text-xs font-bold uppercase text-muted">{label}</dt><dd className="mt-1 whitespace-nowrap text-xl font-black text-primary sm:text-2xl">{formatCurrency(Number(value), currency, locale)}</dd></div>)}</dl></div>{result.dueAt ? <p className="mt-4 text-sm text-muted">{text.dueAt}: <strong className="text-primary">{new Date(result.dueAt).toLocaleString(locale)}</strong></p> : null}{cleanupFailed || attemptStorageLost ? <div className="mt-4 rounded-control border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900" role="alert"><p>{text.workspaceCleanupError}</p><button className="mt-2 min-h-11 rounded-control border border-red-700 px-4" onClick={() => cleanupSubmittedDraft(result.customerId, result.isWalkIn)} type="button">{text.workspaceRetryCleanup}</button></div> : null}<div className="mt-6 flex flex-wrap gap-3"><button className="min-h-12 rounded-control bg-primary px-6 font-bold text-white disabled:opacity-40" disabled={cleanupFailed || attemptStorageLost || Boolean(attempt)} onClick={resetOrder} type="button">{text.newOrder}</button><Link className="inline-flex min-h-12 items-center rounded-control border border-primary px-5 font-bold !text-primary" href={`/app/orders/${result.orderId}`} locale={locale}>{text.openOrder}</Link>{canPrint ? <PrintOrderActions locale={locale} orderId={result.orderId} text={printText} /> : null}{canInvoice ? <Link className="inline-flex min-h-12 items-center rounded-control bg-primary-strong px-5 font-bold !text-white" href={`/app/billing/new?orderId=${result.orderId}&source=shop`} locale={locale}>{text.invoice}</Link> : null}</div></div></section>
      </div>
    );
  }

  if (!attemptLoaded || draftHydration !== "ready" || attemptStorageLost || attempt || reconciledOrder) {
    const confirmed = reconciledOrder ?? (attempt?.status === "completed" && attempt.orderId && attempt.orderNumber
      ? { id: attempt.orderId, number: attempt.orderNumber } : null);
    return <div className="counter-register-shell min-h-screen bg-[#eef1ed]">
      {terminalHeader}
      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6" role="status">
        <div className="rounded-card border border-border bg-white p-5 shadow-card">
          {confirmed ? <><h2 className="text-2xl font-black text-primary">{text.submissionCompleted}: {confirmed.number}</h2><Link className="mt-4 inline-flex min-h-11 items-center rounded-control border border-primary px-4 font-bold text-primary" href={`/app/orders/${confirmed.id}`} locale={locale}>{text.openOrder}</Link></>
            : <h2 className="text-lg font-bold text-primary">{!attemptLoaded ? text.saving : draftHydration === "error" ? text.workspaceDraftLoadError : attemptStorageLost ? text.submissionStorageLost : definitiveRejection ? text.submissionRejected : isSubmitting || retrying ? text.submissionSaving : recoveryStatus === "pending" ? text.submissionPending : recoveryStatus === "not_found" ? text.submissionNotFound : text.submissionUnknown}</h2>}
          {attemptStorageLost ? <p className="mt-3 text-sm text-red-800" role="alert">{text.submissionStorageLost}</p> : null}
          {draftHydration === "error" ? <div className="mt-3" role="alert"><p className="text-sm text-red-800">{text.workspaceDraftLoadError}</p><button className="mt-3 min-h-11 rounded-control border border-primary px-4 font-bold text-primary" onClick={hydrateCustomerDrafts} type="button">{text.workspaceRetryLoad}</button></div> : null}
          {attemptPersistenceFailed ? <p className="mt-3 text-sm text-red-800" role="alert">{text.submissionSaveError}</p> : null}
          {attemptPersistenceFailed ? <button className="mt-4 min-h-11 rounded-control border border-primary px-4 font-bold text-primary" onClick={retryAttemptPersistence} type="button">{text.workspaceRetrySave}</button> : null}
          {definitiveRejection ? <div className="mt-4" role="alert"><p className="text-sm font-semibold text-red-800">{text.submissionRejected} {definitiveRejection === "closedDay" ? text.errorClosedDay : definitiveRejection === "till" ? text.errorTill : definitiveRejection === "discount" ? text.errorDiscount : definitiveRejection === "validation" ? text.errorValidation : text.errorGeneric}</p><button className="mt-3 min-h-11 rounded-control border border-primary px-4 font-bold text-primary disabled:opacity-40" disabled={draftHydration !== "ready" || attemptStorageLost || retrying || checkingStatus || isSubmitting} onClick={correctRejectedDraft} type="button">{text.submissionCorrectDraft}</button></div> : null}
          {attempt?.status === "pending" && !definitiveRejection && draftHydration === "ready" && !attemptStorageLost && !attemptPersistenceFailed ? <div className="mt-4 flex flex-wrap gap-3">
            <button className="min-h-11 rounded-control border border-primary px-4 font-bold text-primary disabled:opacity-40" disabled={checkingStatus || retrying} onClick={checkSubmissionStatus} type="button">{text.submissionCheck}</button>
            {recoveryStatus === "not_found" ? <button className="min-h-11 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-40" disabled={checkingStatus || retrying} onClick={retryIdenticalSubmission} type="button">{text.submissionRetry}</button> : null}
          </div> : null}
          {attempt?.status === "completed" ? <button className="mt-4 min-h-11 rounded-control border border-primary px-4 font-bold text-primary" onClick={retryCompletedCleanup} type="button">{text.workspaceRetryCleanup}</button> : null}
          {confirmed && !attempt && !attemptStorageLost ? <button className="mt-4 min-h-11 rounded-control bg-primary px-4 font-bold text-white" onClick={resetOrder} type="button">{text.newOrder}</button> : null}
        </div>
      </section>
    </div>;
  }

  return (
    <div className="counter-register-shell min-h-screen bg-[#eef1ed]">
      {terminalHeader}
      <section className="border-b border-border bg-white px-3 py-2 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
          <div className="min-w-0">
            <p className="truncate text-[0.65rem] font-black uppercase tracking-[0.12em] text-muted">{organizationName}</p>
            <h1 className="truncate text-lg font-black text-primary">{text.title}</h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${session ? "bg-emerald-50 text-emerald-800" : "bg-[#f2f3f2] text-muted"}`}>{session ? text.tillOpen : text.tillClosed}</span>
            <Link className={`inline-flex min-h-11 items-center rounded-control px-3 text-xs font-bold ${session ? "bg-primary-soft !text-primary" : "bg-amber-100 !text-amber-950"}`} href="/app/pos" locale={locale}>{session ? text.tillManagement : text.openTill}</Link>
          </div>
        </div>
        <div className={`grid min-w-0 gap-2 ${canScan ? "lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]" : ""}`}>
          {canScan ? (
            <form className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-control bg-primary-soft px-3 py-2" onSubmit={resolveCode}>
              <label className="min-w-0 text-[0.68rem] font-black uppercase tracking-[0.1em] text-primary">{text.scanCode}<input autoComplete="off" className="mt-0.5 min-h-10 w-full min-w-0 rounded-control border border-primary/30 bg-white px-3 font-mono text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary" disabled={isResolving} onChange={(event) => { setScanValue(event.target.value); setScanError(null); }} placeholder={text.scanPlaceholder} spellCheck={false} value={scanValue} /></label>
              <button className="min-h-10 shrink-0 rounded-control bg-primary px-4 text-sm font-bold text-white disabled:opacity-50" disabled={isResolving || !scanValue.trim()} type="submit">{isResolving ? text.scanning : text.scanSubmit}</button>
              {scanError ? <p aria-live="polite" className="col-span-2 text-xs font-semibold text-red-700">{scanError === "invalid" ? text.scanInvalid : text.scanNotFound}</p> : null}
            </form>
          ) : null}
          <div className="min-w-0 space-y-2">
            {selectedCustomer ? (
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-control border border-border bg-[#f8faf8] px-3 py-2">
              <div className="min-w-0"><p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-muted">{text.currentCustomer}</p><div className="flex min-w-0 flex-wrap items-center gap-2"><strong className="truncate text-base text-primary">{selectedCustomerName}</strong>{selectedCustomer.isWalkIn ? <span className="shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-[0.68rem] font-bold text-primary">{text.occasionalCustomer}</span> : null}{segmentName ? <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[0.68rem] font-bold text-primary">{text.segmentCatalog}: {segmentName}</span> : null}<span className="hidden truncate text-xs text-muted sm:inline">{selectedCustomer.phone || selectedCustomer.email || "—"}</span></div></div>
              <button className="min-h-10 shrink-0 rounded-control border border-primary/25 px-3 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={openCustomerPicker} type="button">{text.changeCustomer}</button>
            </div>
            ) : null}
            {!selectedCustomer || isCustomerPickerOpen ? (
            <div className="min-w-0 space-y-1.5">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5">
                <label><span className="sr-only">{text.customerSearch}</span><input className="min-h-10 w-full min-w-0 rounded-control border border-border bg-[#f8faf8] px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => { customerSearchRequestRef.current += 1; setCustomerQuery(event.target.value); setIsSearchingCustomers(Boolean(event.target.value.trim())); }} placeholder={text.customerSearch} type="search" value={customerQuery} /></label>
                <button aria-pressed={customerMode === "regular"} className={`min-h-10 rounded-control border px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${customerMode === "regular" ? "border-primary bg-primary text-white" : "border-primary/25 text-primary"}`} onClick={() => setCustomerMode(customerMode === "regular" ? null : "regular")} type="button">+ {text.regularCustomer}</button>
                <button aria-pressed={customerMode === "walk_in"} className={`min-h-10 rounded-control px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${customerMode === "walk_in" ? "bg-primary text-white" : "bg-primary-soft text-primary"}`} onClick={() => walkInCustomer ? selectCustomer(walkInCustomer.id, walkInCustomer) : setCustomerMode(customerMode === "walk_in" ? null : "walk_in")} type="button">{walkInCustomer ? text.resumeOccasional : text.occasionalCustomer}</button>
              </div>
              {!customerMode ? <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">{!normalizedCustomerQuery ? <span className="shrink-0 text-[0.68rem] font-black uppercase tracking-[0.08em] text-muted">{text.recentCustomers}</span> : null}{filteredCustomers.map((customer) => <button className="min-h-9 shrink-0 rounded-full border border-border bg-white px-3 text-left hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" key={customer.id} onClick={() => selectCustomer(customer.id, normalizedCustomerQuery ? customer : undefined)} type="button"><strong className="block max-w-44 truncate text-xs text-primary">{customer.name}</strong></button>)}{normalizedCustomerQuery && isSearchingCustomers ? <span className="self-center text-xs text-muted" role="status">{text.searchingCustomers}</span> : null}{normalizedCustomerQuery && !isSearchingCustomers && filteredCustomers.length === 0 ? <span className="self-center text-xs text-muted" role="status">{text.noCustomerMatches}</span> : null}</div> : <form action={createCustomer} className="grid gap-2 border-l-4 border-primary bg-[#f8faf8] p-2 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end"><input name="customerKind" type="hidden" value={customerMode} /><button className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-bold text-primary underline underline-offset-4 md:col-span-4 md:justify-self-start" onClick={() => setCustomerMode(null)} type="button">← {text.recentCustomers}</button><label className="text-xs font-bold text-muted">{customerMode === "walk_in" ? text.occasionalHelp : text.regularHelp}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3 text-sm text-primary" name="displayName" placeholder={text.customerName} required={customerMode === "regular"} /></label><label className="text-xs font-bold text-muted">{text.customerPhone}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3 text-sm text-primary" name="phone" placeholder={text.customerPhone} /></label>{customerMode === "regular" ? <label className="text-xs font-bold text-muted">{text.customerEmail}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3 text-sm text-primary" name="email" placeholder={text.customerEmail} type="email" /></label> : null}<button className="min-h-10 rounded-control bg-primary px-4 text-sm font-bold text-white" disabled={isCreatingCustomer}>{isCreatingCustomer ? text.saving : customerMode === "walk_in" ? text.continueToCatalog : text.saveCustomer}</button>{customerState.error ? <p className="text-sm font-semibold text-red-700 md:col-span-4">{customerState.error === "validation" ? text.errorValidation : text.errorGeneric}</p> : null}</form>}
            </div>
            ) : null}
          </div>
        </div>
        <div className="mt-2"><QuickDropTerminalPanel action={actions.createQuickDrop} canPrint={canPrint} canQr={canScan} closedDay={quickDropClosed} customer={selectedCustomer ? { id: selectedCustomer.id, isWalkIn: selectedCustomer.isWalkIn, name: selectedCustomerName ?? text.occasionalCustomer, phone: selectedCustomer.phone, walkInName: selectedCustomer.isWalkIn ? selectedCustomer.name || null : null } : null} locale={locale} locationId={session?.locationId ?? null} onNewOrder={clearCustomer} pending={pendingQuickDrops} printText={printText} text={quickDropText} /></div>
      </section>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,2.1fr)_minmax(20rem,1fr)] xl:grid-cols-[minmax(0,2.2fr)_minmax(23rem,1fr)]">
        <main className="min-w-0 p-3 pb-28 sm:p-4 md:pb-4">
          <div className="mb-2 flex items-center gap-2"><h2 className="shrink-0 text-sm font-black uppercase tracking-[0.08em] text-primary">{text.catalog}</h2><input className="min-h-10 w-full min-w-0 rounded-control border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:ml-auto sm:max-w-xs" disabled={!selectedCustomer} onChange={(event) => setServiceQuery(event.target.value)} placeholder={text.searchServices} type="search" value={serviceQuery} /></div>
          <nav aria-label={text.catalog} className="mb-3 flex min-w-0 gap-1.5 overflow-x-auto pb-1"><button aria-pressed={category === "all"} className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-black ${category === "all" ? "bg-primary text-white" : "border border-border bg-white text-primary"}`} disabled={!selectedCustomer} onClick={() => setCategory("all")} type="button">{text.categoryAll}</button>{categories.map((item) => <button aria-pressed={category === item.key} className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-black ${category === item.key ? "bg-primary text-white" : "border border-border bg-white text-primary"}`} key={item.key} onClick={() => setCategory(item.key)} type="button">{item.label}</button>)}</nav>
          {!selectedCustomer ? <div className="flex min-h-64 flex-col items-center justify-center rounded-control border border-dashed border-primary/25 bg-white px-6 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary"><svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m6.5-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 0 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg></span><h3 className="mt-3 text-lg font-black text-primary">{text.selectCustomer}</h3><p className="mt-1 max-w-md text-sm text-muted">{text.noCustomer}</p></div> : catalogStatus === "error" ? <div className="rounded-control border border-red-200 bg-red-50 p-6 text-center" role="alert"><p className="font-semibold text-red-700">{text.catalogLoadError}</p><button className="mt-4 min-h-11 rounded-control bg-primary px-4 font-bold text-white" onClick={() => selectCustomer(customerId, undefined, true)} type="button">{text.retryCatalog}</button></div> : catalogStatus === "loading" ? <div className="rounded-control bg-white py-20 text-center font-semibold text-muted">{text.loadingCatalog}</div> : filteredServices.length ? <div className="grid grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-4" data-terminal-service-grid>{filteredServices.map((service) => {
            const line = cartByServiceId.get(service.id);
            const categoryLabel = service.categoryKey ? resolveShopCategoryLabel(service.categoryKey, service.category, categoryLabels) : text.categoryAll;
            return <div className="contents" key={service.id}>
              <article className={`flex min-w-0 gap-3 rounded-control border bg-white p-2.5 shadow-sm md:hidden ${line ? "border-primary ring-1 ring-primary/15" : "border-border"}`} data-terminal-mobile-service-card>
                <PortalMedia alt={service.imageUrl ? service.name : ""} className="h-24 w-24 shrink-0 rounded-control border border-border" fit="contain" imageClassName="p-1.5" sizes="96px" src={service.imageUrl} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-base font-black leading-5 text-primary">{service.name}</strong>
                  <span className="mt-1 text-[0.68rem] font-bold uppercase leading-4 tracking-wide text-muted">{categoryLabel} · {text.unitTypes[service.unitType]}{service.pricingSource === "segment" && service.pricingSegmentName ? ` · ${service.pricingSegmentName}` : ""}</span>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                    <strong className="text-lg font-black text-primary">{service.priceIsFrom ? `${text.priceFrom} ` : ""}{formatCurrency(service.amount, service.currency, locale)}</strong>
                    {line ? <div className="grid grid-cols-[2.75rem_3rem_2.75rem] items-center overflow-hidden rounded-control border border-border bg-white">
                      <button aria-label={`− ${text.quantity} · ${service.name}`} className="min-h-11 text-xl font-black text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => adjustQuantity(line, -1)} type="button">−</button>
                      <input aria-label={`${text.quantity} · ${service.name}`} className="h-11 w-full border-x border-border text-center font-black text-primary outline-none focus:bg-primary-soft/50" min={isDiscreteServiceUnit(service.unitType) ? 1 : 0.001} onChange={(event) => updateQuantity(service.id, Number(event.target.value))} step={isDiscreteServiceUnit(service.unitType) ? 1 : 0.1} type="number" value={line.quantity} />
                      <button aria-label={`+ ${text.quantity} · ${service.name}`} className="min-h-11 text-xl font-black text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => adjustQuantity(line, 1)} type="button">+</button>
                    </div> : <button aria-label={`${text.emptyCart} · ${service.name}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-control bg-primary text-xl font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" onClick={() => addService(service)} type="button">+</button>}
                  </div>
                </div>
              </article>
              <button className="group relative hidden h-full min-w-0 flex-col overflow-hidden rounded-control border border-border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex" data-terminal-service-card onClick={() => addService(service)} type="button"><PortalMedia alt={service.imageUrl ? service.name : ""} className="h-28 w-full shrink-0 border-b border-border sm:h-32" fit="contain" imageClassName="p-2 transition-transform duration-300 group-hover:scale-[1.02]" sizes="(max-width: 1535px) 33vw, 25vw" src={service.imageUrl} /><span className="flex w-full flex-1 flex-col px-2.5 py-1.5"><span className="flex min-w-0 items-start justify-between gap-1.5"><strong className="line-clamp-2 min-h-8 text-sm leading-4 text-primary">{service.name}</strong><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-white">+</span></span><span className="mt-0.5 block truncate text-[0.65rem] font-bold uppercase leading-4 tracking-wide text-muted">{categoryLabel} · {text.unitTypes[service.unitType]}{service.pricingSource === "segment" && service.pricingSegmentName ? ` · ${service.pricingSegmentName}` : ""}</span><strong className="mt-auto block pt-1 text-base font-black text-primary sm:text-lg">{service.priceIsFrom ? `${text.priceFrom} ` : ""}{formatCurrency(service.amount, service.currency, locale)}</strong></span></button>
            </div>;
          })}</div> : <p className="rounded-control bg-white py-20 text-center font-semibold text-muted">{text.emptyCatalog}</p>}
        </main>

        <aside className="scroll-mt-4 min-w-0 border-t border-border bg-white shadow-[-12px_0_30px_rgb(15_59_46_/_0.06)] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-l lg:border-t-0" id="terminal-checkout">
          <div className="p-4 sm:p-5"><div className="flex items-center justify-between border-b-2 border-primary pb-3"><div><p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted">{selectedCustomerName ?? text.customer}</p><h2 className="text-xl font-black text-primary">{text.cart}</h2></div>{cart.length ? <button className="min-h-10 px-2 text-sm font-bold text-red-700" onClick={clearCart} type="button">{text.clear}</button> : null}</div>
            <div className="max-h-[32vh] overflow-y-auto lg:max-h-[30vh]">{cart.length ? cart.map((line) => <div className="border-b border-border py-3" key={line.service.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold leading-tight text-primary">{line.service.name}</p><p className="mt-1 text-xs text-muted">{formatCurrency(line.service.amount, line.service.currency, locale)} / {text.unitTypes[line.service.unitType]}</p></div><strong className="whitespace-nowrap text-lg text-primary">{formatCurrency(line.quantity * line.service.amount, line.service.currency, locale)}</strong></div><div className="mt-2 flex items-center justify-between gap-3"><div className="flex items-center rounded-control border border-border bg-[#f7f8f5]"><button aria-label={`− ${text.quantity}`} className="min-h-11 min-w-11 text-xl font-black text-primary" onClick={() => adjustQuantity(line, -1)} type="button">−</button><input aria-label={text.quantity} className="h-11 w-16 border-x border-border bg-white text-center text-base font-black text-primary" min={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.001} onChange={(event) => updateQuantity(line.service.id, Number(event.target.value))} step={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.1} type="number" value={line.quantity} /><button aria-label={`+ ${text.quantity}`} className="min-h-11 min-w-11 text-xl font-black text-primary" onClick={() => adjustQuantity(line, 1)} type="button">+</button></div><button className="min-h-11 px-2 text-sm font-bold text-red-700" onClick={() => removeCartLine(line.service.id)} type="button">{text.remove}</button></div></div>) : <p className="py-10 text-center text-muted">{text.emptyCart}</p>}</div>
            <form action={submit} className="mt-4" onSubmit={prepareSubmission}>
              <fieldset className="min-w-0 space-y-3" disabled={!customerId || catalogStatus !== "ready"}>
              <input name="payload" ref={payloadRef} type="hidden" />
              <div className="rounded-control border-2 border-primary/30 bg-primary-soft p-3">
                <label className="block text-sm font-black text-primary">{text.dueAt}<input className="mt-1 min-h-12 w-full rounded-control border border-border bg-white px-3 text-base" name="dueAt" onChange={(event) => setDueAt(event.target.value)} required type="datetime-local" value={dueAt} /></label>
              </div>
              <label className="block text-sm font-bold text-primary">{text.productionAssignee}<select className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setProductionAssigneeId(event.target.value)} value={productionAssigneeId}><option value="">{text.noAssignee}</option>{productionAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.label}</option>)}</select></label>
              <div className="rounded-control border border-border p-3">
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm font-black text-primary"><span>{text.delivery}</span><input checked={delivery.requested} className="h-5 w-5 accent-primary" onChange={(event) => setDeliveryRequested(event.target.checked)} type="checkbox" /></label>
                {delivery.requested ? <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
                  {isLoadingDelivery ? <p className="text-xs font-semibold text-muted sm:col-span-2">{text.loadingDelivery}</p> : null}
                  {deliveryOptions && deliveryOptions.properties.length > 1 ? <label className="text-xs font-bold text-muted sm:col-span-2">{text.deliveryProperty}<select className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3 text-sm" onChange={(event) => selectDeliveryProperty(event.target.value)} value={delivery.propertyId}><option value="">{text.manualAddress}</option>{deliveryOptions.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label> : null}
                  <label className="text-xs font-bold text-muted sm:col-span-2">{text.deliveryScheduledAt}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setDelivery((current) => ({ ...current, scheduledAt: event.target.value }))} required type="datetime-local" value={delivery.scheduledAt} /></label>
                  <label className="text-xs font-bold text-muted sm:col-span-2">{text.addressLine1}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setDelivery((current) => ({ ...current, addressLine1: event.target.value }))} required value={delivery.addressLine1} /></label>
                  <label className="text-xs font-bold text-muted sm:col-span-2">{text.addressLine2}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setDelivery((current) => ({ ...current, addressLine2: event.target.value }))} value={delivery.addressLine2} /></label>
                  <label className="text-xs font-bold text-muted">{text.city}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setDelivery((current) => ({ ...current, city: event.target.value }))} value={delivery.city} /></label>
                  <label className="text-xs font-bold text-muted">{text.postalCode}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setDelivery((current) => ({ ...current, postalCode: event.target.value }))} value={delivery.postalCode} /></label>
                  <label className="text-xs font-bold text-muted">{text.countryCode}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3 uppercase" maxLength={2} onChange={(event) => setDelivery((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} value={delivery.countryCode} /></label>
                  <label className="text-xs font-bold text-muted">{text.contactName}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setDelivery((current) => ({ ...current, contactName: event.target.value }))} value={delivery.contactName} /></label>
                  <label className="text-xs font-bold text-muted">{text.contactPhone}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setDelivery((current) => ({ ...current, contactPhone: event.target.value }))} value={delivery.contactPhone} /></label>
                  <label className="text-xs font-bold text-muted">{text.deliveryAssignee}<select className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setDelivery((current) => ({ ...current, assignedTo: event.target.value }))} value={delivery.assignedTo}><option value="">{text.noAssignee}</option>{deliveryAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.label}</option>)}</select></label>
                  <label className="text-xs font-bold text-muted sm:col-span-2">{text.deliveryNotes}<textarea className="mt-1 min-h-16 w-full rounded-control border border-border bg-white p-3" onChange={(event) => setDelivery((current) => ({ ...current, notes: event.target.value }))} value={delivery.notes} /></label>
                </div> : null}
              </div>
              <label className="flex items-center justify-between gap-3 text-sm font-bold text-primary"><span>{text.discount}</span><input className="min-h-10 w-28 rounded-control border border-border px-3 text-right text-lg" disabled={!canDiscount} max={subtotal} min="0" onChange={(event) => setDiscount(Number(event.target.value))} step="0.01" type="number" value={discount} /></label>
              <dl className="space-y-1.5 border-t border-border pt-3"><div className="flex justify-between text-sm"><dt className="text-muted">{text.subtotal}</dt><dd className="font-bold text-primary">{formatCurrency(subtotal, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.discount}</dt><dd className="font-bold text-primary">− {formatCurrency(safeDiscount, currency, locale)}</dd></div><div className="mt-2 flex items-end justify-between rounded-control bg-primary p-4 text-white"><dt className="text-sm font-black uppercase tracking-[0.12em]">{text.total}</dt><dd className="text-4xl font-black">{formatCurrency(total, currency, locale)}</dd></div><div className="flex justify-between pt-1 text-sm"><dt className="text-muted">{text.paid}</dt><dd className="font-bold text-primary">{formatCurrency(0, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.outstanding}</dt><dd className="font-black text-primary">{formatCurrency(total, currency, locale)}</dd></div></dl>
              <details className="border-b border-border pb-3"><summary className="cursor-pointer text-sm font-bold text-primary">{text.notes}</summary><div className="mt-3 space-y-2"><textarea className="min-h-16 w-full rounded-control border border-border p-3" name="customerNotes" onChange={(event) => setCustomerNotes(event.target.value)} placeholder={text.notes} value={customerNotes} /><textarea className="min-h-16 w-full rounded-control border border-border p-3" name="internalNotes" onChange={(event) => setInternalNotes(event.target.value)} placeholder={text.notes} value={internalNotes} /></div></details>
              {submitState.error ? <p className="rounded-control bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{submitState.error === "closedDay" ? text.errorClosedDay : submitState.error === "validation" ? text.errorValidation : submitState.error === "till" ? text.errorTill : submitState.error === "discount" ? text.errorDiscount : submitState.error === "inboundUnavailable" ? text.errorInbound : text.errorGeneric}</p> : null}
              <fieldset><legend className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted">{text.payment}</legend><div className="grid grid-cols-3 gap-2"><button className="min-h-16 rounded-control bg-primary px-2 text-sm font-black uppercase text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0} name="intent" type="submit" value="cash">{isSubmitting ? text.saving : text.paymentCash}</button><button className="min-h-16 rounded-control bg-primary-strong px-2 text-sm font-black uppercase text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0} name="intent" type="submit" value="card">{isSubmitting ? text.saving : text.paymentCard}</button><button className="min-h-16 rounded-control border-2 border-primary bg-white px-2 text-sm font-black uppercase text-primary disabled:opacity-40" disabled={isSubmitting || !customerId || !cart.length || total < 0} name="intent" type="submit" value="later">{isSubmitting ? text.saving : text.payLater}</button></div></fieldset>
              <input className="min-h-10 w-full rounded-control border border-border px-3 text-sm" onChange={(event) => setCardReference(event.target.value)} placeholder={text.cardReference} value={cardReference} /><button className="min-h-10 w-full text-sm font-bold text-primary underline underline-offset-4" onClick={() => setShowSplitPayment((current) => !current)} type="button">{text.splitPayment}</button>{showSplitPayment ? <div className="grid grid-cols-2 gap-2 border-l-4 border-primary bg-primary-soft p-3"><label className="text-xs font-bold text-muted">{text.splitCash}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-2" min="0" onChange={(event) => setSplitCash(Number(event.target.value))} step="0.01" type="number" value={splitCash} /></label><label className="text-xs font-bold text-muted">{text.splitCard}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-2" min="0" onChange={(event) => setSplitCard(Number(event.target.value))} step="0.01" type="number" value={splitCard} /></label><button className="col-span-2 min-h-12 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0 || roundMoney(splitCash + splitCard) !== total} name="intent" type="submit" value="split">{text.confirmSplit}</button></div> : null}{!session ? <Link className="flex min-h-12 items-center justify-center rounded-control bg-amber-50 px-3 text-sm font-bold !text-amber-800" href="/app/pos" locale={locale}>{text.openTill} →</Link> : null}
              </fieldset>
            </form>
          </div>
        </aside>
      </div>

      {cart.length > 0 ? <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-card border border-primary/15 bg-white/96 p-2.5 shadow-luxury backdrop-blur md:hidden" data-terminal-mobile-mini-cart>
        <button aria-haspopup="dialog" className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-control px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setIsMobileCartOpen(true)} type="button">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M4 5h2l2 10h9l2-7H7m2 11h.01M17 19h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg></span>
          <span className="min-w-0"><strong className="block truncate text-sm text-primary">{text.quantity}: {cart.length}</strong><span className="block text-xs text-muted">{text.total} · {formatCurrency(total, currency, locale)}</span></span>
        </button>
        <button className="min-h-11 shrink-0 rounded-control bg-primary px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" onClick={() => setIsMobileCartOpen(true)} type="button">{text.openOrder} <span aria-hidden="true">›</span></button>
      </div> : null}

      {isMobileCartOpen && cart.length > 0 ? <div aria-labelledby="terminal-mobile-cart-title" aria-modal="true" className="fixed inset-x-0 top-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 md:hidden" role="dialog">
        <button aria-label={text.continueToCatalog} className="absolute inset-0 bg-slate-950/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" onClick={() => setIsMobileCartOpen(false)} type="button" />
        <section className="absolute inset-x-0 bottom-0 max-h-[min(82vh,46rem)] overflow-y-auto rounded-t-[1.75rem] bg-white p-4 shadow-luxury">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
            <div><h2 className="text-xl font-black text-primary" id="terminal-mobile-cart-title">{text.cart}</h2><p className="mt-1 text-sm text-muted">{text.quantity}: {cart.length}</p></div>
            <button aria-label={text.continueToCatalog} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-xl text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setIsMobileCartOpen(false)} ref={mobileCartCloseRef} type="button">×</button>
          </div>
          <div className="divide-y divide-border">{cart.map((line) => <article className="py-4" key={line.service.id}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-primary">{line.service.name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{line.service.categoryKey ? resolveShopCategoryLabel(line.service.categoryKey, line.service.category, categoryLabels) : text.categoryAll} · {text.unitTypes[line.service.unitType]}</p></div><strong className="shrink-0 text-primary">{formatCurrency(line.quantity * line.service.amount, line.service.currency, locale)}</strong></div>
            <div className="mt-3 flex items-center justify-between gap-3"><button className="min-h-11 px-2 text-sm font-bold text-red-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600" onClick={() => removeCartLine(line.service.id)} type="button">{text.remove}</button><div className="grid grid-cols-[2.75rem_3.5rem_2.75rem] items-center overflow-hidden rounded-control border border-border"><button aria-label={`− ${text.quantity} · ${line.service.name}`} className="min-h-11 text-xl font-black text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => adjustQuantity(line, -1)} type="button">−</button><input aria-label={`${text.quantity} · ${line.service.name}`} className="h-11 w-full border-x border-border text-center font-black text-primary outline-none focus:bg-primary-soft/50" min={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.001} onChange={(event) => updateQuantity(line.service.id, Number(event.target.value))} step={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.1} type="number" value={line.quantity} /><button aria-label={`+ ${text.quantity} · ${line.service.name}`} className="min-h-11 text-xl font-black text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => adjustQuantity(line, 1)} type="button">+</button></div></div>
          </article>)}</div>
          <dl className="space-y-2 border-t border-border pt-4"><div className="flex justify-between text-sm"><dt className="text-muted">{text.subtotal}</dt><dd className="font-bold text-primary">{formatCurrency(subtotal, currency, locale)}</dd></div>{canDiscount || safeDiscount > 0 ? <div className="flex justify-between text-sm"><dt className="text-muted">{text.discount}</dt><dd className="font-bold text-primary">− {formatCurrency(safeDiscount, currency, locale)}</dd></div> : null}<div className="flex items-end justify-between rounded-control bg-primary p-3 text-white"><dt className="text-sm font-black uppercase tracking-wide">{text.total}</dt><dd className="text-2xl font-black">{formatCurrency(total, currency, locale)}</dd></div></dl>
          <div className="mt-4 grid grid-cols-2 gap-3"><button className="min-h-12 rounded-control border border-primary px-3 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setIsMobileCartOpen(false)} type="button">{text.continueToCatalog}</button><button className="min-h-12 rounded-control bg-primary px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" onClick={continueToCheckout} type="button">{text.payment}</button></div>
        </section>
      </div> : null}
    </div>
  );
}
