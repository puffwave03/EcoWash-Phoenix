"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PrintOrderActions, type PrintActionText } from "@/components/printing/PrintOrderActions";
import { PortalMedia } from "@/components/portal/PortalMedia";
import type { PosSession } from "@/features/pos/types";
import { isDiscreteServiceUnit } from "@/features/services/types";
import { resolveShopCategoryLabel } from "@/features/shop-terminal/category-label";
import type { ShopCatalogSelection, ShopCodeResolveResult, ShopCustomer, ShopCustomerState, ShopService, ShopSubmitState } from "@/features/shop-terminal/types";
import { Link, useRouter } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/number-format";
import { QuickDropTerminalPanel, type QuickDropText } from "@/components/quick-drop/QuickDropTerminalPanel";
import type { PendingQuickDrop, QuickDropCreateResult } from "@/features/quick-drop/types";

type CartLine = { quantity: number; service: ShopService };
type CustomerMode = "regular" | "walk_in" | null;

export type ShopTerminalText = {
  addCustomer: string; basePrice: string; card: string; cardReference: string; cart: string;
  cash: string; catalog: string; categoryAll: string; changeCustomer: string; clear: string;
  confirmSplit: string; continueToCatalog: string; currentCustomer: string; customer: string;
  customerEmail: string; customerName: string; customerPhone: string; customerSearch: string;
  discount: string; dueAt: string; emptyCart: string; emptyCatalog: string; errorDiscount: string;
  errorGeneric: string; errorTill: string; errorValidation: string; loadingCatalog: string;
  newCustomer: string; newOrder: string; noCustomer: string; notes: string; occasionalCustomer: string;
  occasionalHelp: string; openOrder: string; openTill: string; operator: string; orderSuccess: string; invoice: string;
  outstanding: string; paid: string; payLater: string; payNow: string; payment: string;
  paymentCard: string; paymentCash: string; paymentSplit: string; priceFrom: string; printerSettings: string;
  quantity: string; recentCustomers: string; regularCustomer: string; regularHelp: string; remove: string;
  saveCustomer: string; saving: string; searchServices: string; segmentPrice: string; selectCustomer: string;
  segmentCatalog: string;
  splitCard: string; splitCash: string; splitPayment: string; subtotal: string; tillManagement: string;
  tillOpen: string; tillRequired: string; title: string; total: string; unitTypes: Record<string, string>;
  scanCode: string; scanPlaceholder: string; scanSubmit: string; scanning: string; scanInvalid: string; scanNotFound: string;
};

type Props = {
  actions: {
    createCustomer: (state: ShopCustomerState, formData: FormData) => Promise<ShopCustomerState>;
    loadServices: (customerId: string, locationId: string | null) => Promise<ShopCatalogSelection>;
    createQuickDrop: (formData: FormData) => Promise<QuickDropCreateResult>;
    resolveCode: (raw: string) => Promise<ShopCodeResolveResult>;
    submit: (state: ShopSubmitState, formData: FormData) => Promise<ShopSubmitState>;
  };
  canConfigurePrinters: boolean;
  canInvoice: boolean;
  canPrint: boolean;
  canScan: boolean;
  categoryLabels: Record<string, string>;
  customers: ShopCustomer[];
  locale: string;
  operatorName: string;
  organizationName: string;
  pendingQuickDrops: PendingQuickDrop[];
  printText: PrintActionText;
  quickDropText: QuickDropText;
  role: string;
  session: PosSession | null;
  text: ShopTerminalText;
};

const initialCustomerState: ShopCustomerState = { customer: null, error: null };
const initialSubmitState: ShopSubmitState = { error: null, result: null };
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function ShopTerminalWorkspace({ actions, canConfigurePrinters, canInvoice, canPrint, canScan, categoryLabels, customers: initialCustomers, locale, operatorName, organizationName, pendingQuickDrops, printText, quickDropText, role, session, text }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
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
  const [dismissedOrderId, setDismissedOrderId] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isResolving, startResolving] = useTransition();
  const [scanError, setScanError] = useState<ShopCodeResolveResult["error"]>(null);
  const [scanValue, setScanValue] = useState("");
  const [customerState, createCustomer, isCreatingCustomer] = useActionState(async (state: ShopCustomerState, formData: FormData) => {
    const result = await actions.createCustomer(state, formData);
    if (result.customer) {
      setCustomers((current) => [result.customer!, ...current.filter((customer) => customer.id !== result.customer!.id)]);
      selectCustomer(result.customer.id);
      setCustomerMode(null);
      setCustomerQuery("");
    }
    return result;
  }, initialCustomerState);
  const [submitState, submit, isSubmitting] = useActionState(actions.submit, initialSubmitState);
  const payloadRef = useRef<HTMLInputElement>(null);
  const catalogRequestRef = useRef(0);
  const mobileCartCloseRef = useRef<HTMLButtonElement>(null);

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const selectedCustomerName = selectedCustomer?.isWalkIn
    ? selectedCustomer.name || text.occasionalCustomer
    : selectedCustomer?.name ?? null;
  const currency = services[0]?.currency ?? "EUR";
  const subtotal = roundMoney(cart.reduce((sum, line) => sum + line.quantity * line.service.amount, 0));
  const safeDiscount = Math.min(Math.max(roundMoney(discount || 0), 0), subtotal);
  const total = roundMoney(subtotal - safeDiscount);
  const canDiscount = role === "owner" || role === "manager";
  const cartByServiceId = useMemo(() => new Map(cart.map((line) => [line.service.id, line])), [cart]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase(locale);
    return customers.filter((customer) => !customer.isWalkIn && (!query || [customer.name, customer.phone, customer.email]
      .some((value) => value?.toLocaleLowerCase(locale).includes(query)))).slice(0, 8);
  }, [customerQuery, customers, locale]);
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

  useEffect(() => {
    if (!isMobileCartOpen) return;
    mobileCartCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileCartOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileCartOpen]);

  function selectCustomer(nextCustomerId: string) {
    if (nextCustomerId === customerId) {
      setCustomerMode(null);
      setIsCustomerPickerOpen(false);
      return;
    }
    const requestId = catalogRequestRef.current + 1;
    catalogRequestRef.current = requestId;
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
    startLoading(async () => {
      const catalog = await actions.loadServices(nextCustomerId, session?.locationId ?? null);
      if (catalogRequestRef.current !== requestId) return;
      setServices(catalog.services);
      setSegmentName(catalog.segmentName);
    });
  }

  function openCustomerPicker() {
    setCustomerMode(null);
    setIsCustomerPickerOpen(true);
  }

  function clearCustomer() {
    catalogRequestRef.current += 1;
    setCustomerId("");
    setServices([]);
    setSegmentName(null);
    setCart([]);
    setIsMobileCartOpen(false);
    setCategory("all");
    setCustomerMode(null);
    setIsCustomerPickerOpen(true);
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
    if (payloadRef.current) payloadRef.current.value = JSON.stringify(payload);
  }

  function resetOrder() {
    setDismissedOrderId(submitState.result?.orderId ?? null);
    clearCustomer();
    setDiscount(0);
    setSplitCash(0);
    setSplitCard(0);
    setCardReference("");
    setShowSplitPayment(false);
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
          <Link className={`rounded-control px-3 py-2 ${session ? "bg-white text-primary" : "bg-amber-100 !text-amber-950"}`} href="/app/pos" locale={locale}>{session ? `${text.tillOpen} · ${session.locationName ?? organizationName}` : text.tillRequired} · {text.tillManagement} →</Link>
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
        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><div className="border-l-4 border-primary bg-white p-5 shadow-card sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.12em] text-secondary">✓ {text.orderSuccess}</p><h2 className="mt-1 text-3xl font-black text-primary">{result.orderNumber}</h2><p className="mt-1 text-lg font-semibold text-muted">{result.customerName}</p></div><dl className="grid grid-cols-3 gap-3">{[[text.total, result.total], [text.paid, result.paid], [text.outstanding, result.outstanding]].map(([label, value]) => <div className="min-w-0 border-l border-border pl-3" key={String(label)}><dt className="text-xs font-bold uppercase text-muted">{label}</dt><dd className="mt-1 whitespace-nowrap text-xl font-black text-primary sm:text-2xl">{formatCurrency(Number(value), currency, locale)}</dd></div>)}</dl></div>{result.dueAt ? <p className="mt-4 text-sm text-muted">{text.dueAt}: <strong className="text-primary">{new Date(result.dueAt).toLocaleString(locale)}</strong></p> : null}<div className="mt-6 flex flex-wrap gap-3"><button className="min-h-12 rounded-control bg-primary px-6 font-bold text-white" onClick={resetOrder} type="button">{text.newOrder}</button><Link className="inline-flex min-h-12 items-center rounded-control border border-primary px-5 font-bold !text-primary" href={`/app/orders/${result.orderId}`} locale={locale}>{text.openOrder}</Link>{canPrint ? <PrintOrderActions locale={locale} orderId={result.orderId} text={printText} /> : null}{canInvoice && !result.isWalkIn ? <Link className="inline-flex min-h-12 items-center rounded-control bg-primary-strong px-5 font-bold !text-white" href={`/app/billing/new?customerId=${result.customerId}&orderId=${result.orderId}&source=shop`} locale={locale}>{text.invoice}</Link> : null}</div></div></section>
      </div>
    );
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
          <Link aria-label={text.tillManagement} className={`inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-xs font-bold ${session ? "bg-primary-soft !text-primary" : "bg-amber-100 !text-amber-950"}`} href="/app/pos" locale={locale}>{session ? text.tillOpen : text.tillRequired}</Link>
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
                <label><span className="sr-only">{text.customerSearch}</span><input className="min-h-10 w-full min-w-0 rounded-control border border-border bg-[#f8faf8] px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setCustomerQuery(event.target.value)} placeholder={text.customerSearch} type="search" value={customerQuery} /></label>
                <button aria-pressed={customerMode === "regular"} className={`min-h-10 rounded-control border px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${customerMode === "regular" ? "border-primary bg-primary text-white" : "border-primary/25 text-primary"}`} onClick={() => setCustomerMode(customerMode === "regular" ? null : "regular")} type="button">+ {text.regularCustomer}</button>
                <button aria-pressed={customerMode === "walk_in"} className={`min-h-10 rounded-control px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${customerMode === "walk_in" ? "bg-primary text-white" : "bg-primary-soft text-primary"}`} onClick={() => setCustomerMode(customerMode === "walk_in" ? null : "walk_in")} type="button">{text.occasionalCustomer}</button>
              </div>
              {!customerMode ? <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">{!customerQuery ? <span className="shrink-0 text-[0.68rem] font-black uppercase tracking-[0.08em] text-muted">{text.recentCustomers}</span> : null}{filteredCustomers.map((customer) => <button className="min-h-9 shrink-0 rounded-full border border-border bg-white px-3 text-left hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" key={customer.id} onClick={() => selectCustomer(customer.id)} type="button"><strong className="block max-w-44 truncate text-xs text-primary">{customer.name}</strong></button>)}</div> : <form action={createCustomer} className="grid gap-2 border-l-4 border-primary bg-[#f8faf8] p-2 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end"><input name="customerKind" type="hidden" value={customerMode} /><button className="inline-flex min-h-10 items-center rounded-control px-3 text-sm font-bold text-primary underline underline-offset-4 md:col-span-4 md:justify-self-start" onClick={() => setCustomerMode(null)} type="button">← {text.recentCustomers}</button><label className="text-xs font-bold text-muted">{customerMode === "walk_in" ? text.occasionalHelp : text.regularHelp}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3 text-sm text-primary" name="displayName" placeholder={text.customerName} required={customerMode === "regular"} /></label><label className="text-xs font-bold text-muted">{text.customerPhone}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3 text-sm text-primary" name="phone" placeholder={text.customerPhone} /></label>{customerMode === "regular" ? <label className="text-xs font-bold text-muted">{text.customerEmail}<input className="mt-1 min-h-10 w-full rounded-control border border-border bg-white px-3 text-sm text-primary" name="email" placeholder={text.customerEmail} type="email" /></label> : null}<button className="min-h-10 rounded-control bg-primary px-4 text-sm font-bold text-white" disabled={isCreatingCustomer}>{isCreatingCustomer ? text.saving : customerMode === "walk_in" ? text.continueToCatalog : text.saveCustomer}</button>{customerState.error ? <p className="text-sm font-semibold text-red-700 md:col-span-4">{customerState.error === "validation" ? text.errorValidation : text.errorGeneric}</p> : null}</form>}
            </div>
            ) : null}
          </div>
        </div>
        <div className="mt-2"><QuickDropTerminalPanel action={actions.createQuickDrop} canPrint={canPrint} canQr={canScan} customer={selectedCustomer ? { id: selectedCustomer.id, isWalkIn: selectedCustomer.isWalkIn, name: selectedCustomerName ?? text.occasionalCustomer, phone: selectedCustomer.phone, walkInName: selectedCustomer.isWalkIn ? selectedCustomer.name || null : null } : null} locale={locale} locationId={session?.locationId ?? null} onNewOrder={clearCustomer} pending={pendingQuickDrops} printText={printText} text={quickDropText} /></div>
      </section>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,2.1fr)_minmax(20rem,1fr)] xl:grid-cols-[minmax(0,2.2fr)_minmax(23rem,1fr)]">
        <main className="min-w-0 p-3 pb-28 sm:p-4 md:pb-4">
          <div className="mb-2 flex items-center gap-2"><h2 className="shrink-0 text-sm font-black uppercase tracking-[0.08em] text-primary">{text.catalog}</h2><input className="min-h-10 w-full min-w-0 rounded-control border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:ml-auto sm:max-w-xs" disabled={!selectedCustomer} onChange={(event) => setServiceQuery(event.target.value)} placeholder={text.searchServices} type="search" value={serviceQuery} /></div>
          <nav aria-label={text.catalog} className="mb-3 flex min-w-0 gap-1.5 overflow-x-auto pb-1"><button aria-pressed={category === "all"} className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-black ${category === "all" ? "bg-primary text-white" : "border border-border bg-white text-primary"}`} disabled={!selectedCustomer} onClick={() => setCategory("all")} type="button">{text.categoryAll}</button>{categories.map((item) => <button aria-pressed={category === item.key} className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-black ${category === item.key ? "bg-primary text-white" : "border border-border bg-white text-primary"}`} key={item.key} onClick={() => setCategory(item.key)} type="button">{item.label}</button>)}</nav>
          {!selectedCustomer ? <div className="flex min-h-64 flex-col items-center justify-center rounded-control border border-dashed border-primary/25 bg-white px-6 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary"><svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m6.5-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 0 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg></span><h3 className="mt-3 text-lg font-black text-primary">{text.selectCustomer}</h3><p className="mt-1 max-w-md text-sm text-muted">{text.noCustomer}</p></div> : isLoading ? <div className="rounded-control bg-white py-20 text-center font-semibold text-muted">{text.loadingCatalog}</div> : filteredServices.length ? <div className="grid grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-4" data-terminal-service-grid>{filteredServices.map((service) => {
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
            <form action={submit} className="mt-4 space-y-3" onSubmit={prepareSubmission}><input name="payload" ref={payloadRef} type="hidden" /><label className="flex items-center justify-between gap-3 text-sm font-bold text-primary"><span>{text.discount}</span><input className="min-h-10 w-28 rounded-control border border-border px-3 text-right text-lg" disabled={!canDiscount} max={subtotal} min="0" onChange={(event) => setDiscount(Number(event.target.value))} step="0.01" type="number" value={discount} /></label><dl className="space-y-1.5 border-t border-border pt-3"><div className="flex justify-between text-sm"><dt className="text-muted">{text.subtotal}</dt><dd className="font-bold text-primary">{formatCurrency(subtotal, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.discount}</dt><dd className="font-bold text-primary">− {formatCurrency(safeDiscount, currency, locale)}</dd></div><div className="mt-2 flex items-end justify-between rounded-control bg-primary p-4 text-white"><dt className="text-sm font-black uppercase tracking-[0.12em]">{text.total}</dt><dd className="text-4xl font-black">{formatCurrency(total, currency, locale)}</dd></div><div className="flex justify-between pt-1 text-sm"><dt className="text-muted">{text.paid}</dt><dd className="font-bold text-primary">{formatCurrency(0, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.outstanding}</dt><dd className="font-black text-primary">{formatCurrency(total, currency, locale)}</dd></div></dl><details className="border-b border-border pb-3"><summary className="cursor-pointer text-sm font-bold text-primary">{text.notes}</summary><div className="mt-3 space-y-2"><label className="block text-xs font-bold text-muted">{text.dueAt}<input className="mt-1 min-h-11 w-full rounded-control border border-border px-3" name="dueAt" type="datetime-local" /></label><textarea className="min-h-16 w-full rounded-control border border-border p-3" name="customerNotes" placeholder={text.notes} /><textarea className="min-h-16 w-full rounded-control border border-border p-3" name="internalNotes" placeholder={text.notes} /></div></details>{submitState.error ? <p className="rounded-control bg-red-50 p-3 text-sm font-semibold text-red-700">{submitState.error === "validation" ? text.errorValidation : submitState.error === "till" ? text.errorTill : submitState.error === "discount" ? text.errorDiscount : text.errorGeneric}</p> : null}<fieldset><legend className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted">{text.payment}</legend><div className="grid grid-cols-3 gap-2"><button className="min-h-16 rounded-control bg-primary px-2 text-sm font-black uppercase text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0} name="intent" type="submit" value="cash">{isSubmitting ? text.saving : text.paymentCash}</button><button className="min-h-16 rounded-control bg-primary-strong px-2 text-sm font-black uppercase text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0} name="intent" type="submit" value="card">{isSubmitting ? text.saving : text.paymentCard}</button><button className="min-h-16 rounded-control border-2 border-primary bg-white px-2 text-sm font-black uppercase text-primary disabled:opacity-40" disabled={isSubmitting || !customerId || !cart.length || total < 0} name="intent" type="submit" value="later">{isSubmitting ? text.saving : text.payLater}</button></div></fieldset><input className="min-h-10 w-full rounded-control border border-border px-3 text-sm" onChange={(event) => setCardReference(event.target.value)} placeholder={text.cardReference} value={cardReference} /><button className="min-h-10 w-full text-sm font-bold text-primary underline underline-offset-4" onClick={() => setShowSplitPayment((current) => !current)} type="button">{text.splitPayment}</button>{showSplitPayment ? <div className="grid grid-cols-2 gap-2 border-l-4 border-primary bg-primary-soft p-3"><label className="text-xs font-bold text-muted">{text.splitCash}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-2" min="0" onChange={(event) => setSplitCash(Number(event.target.value))} step="0.01" type="number" value={splitCash} /></label><label className="text-xs font-bold text-muted">{text.splitCard}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-2" min="0" onChange={(event) => setSplitCard(Number(event.target.value))} step="0.01" type="number" value={splitCard} /></label><button className="col-span-2 min-h-12 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0 || roundMoney(splitCash + splitCard) !== total} name="intent" type="submit" value="split">{text.confirmSplit}</button></div> : null}{!session ? <Link className="flex min-h-12 items-center justify-center rounded-control bg-amber-50 px-3 text-sm font-bold !text-amber-800" href="/app/pos" locale={locale}>{text.openTill} →</Link> : null}</form>
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
