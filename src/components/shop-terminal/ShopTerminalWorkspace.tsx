"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { PrintOrderActions, type PrintActionText } from "@/components/printing/PrintOrderActions";
import { PortalMedia } from "@/components/portal/PortalMedia";
import type { PosSession } from "@/features/pos/types";
import { isDiscreteServiceUnit } from "@/features/services/types";
import type { ShopCodeResolveResult, ShopCustomer, ShopCustomerState, ShopService, ShopSubmitState } from "@/features/shop-terminal/types";
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
  splitCard: string; splitCash: string; splitPayment: string; subtotal: string; tillManagement: string;
  tillOpen: string; tillRequired: string; title: string; total: string; unitTypes: Record<string, string>;
  scanCode: string; scanPlaceholder: string; scanSubmit: string; scanning: string; scanInvalid: string; scanNotFound: string;
};

type Props = {
  actions: {
    createCustomer: (state: ShopCustomerState, formData: FormData) => Promise<ShopCustomerState>;
    loadServices: (customerId: string, locationId: string | null) => Promise<ShopService[]>;
    createQuickDrop: (formData: FormData) => Promise<QuickDropCreateResult>;
    resolveCode: (raw: string) => Promise<ShopCodeResolveResult>;
    submit: (state: ShopSubmitState, formData: FormData) => Promise<ShopSubmitState>;
  };
  canConfigurePrinters: boolean;
  canInvoice: boolean;
  canPrint: boolean;
  canScan: boolean;
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

export function ShopTerminalWorkspace({ actions, canConfigurePrinters, canInvoice, canPrint, canScan, customers: initialCustomers, locale, operatorName, organizationName, pendingQuickDrops, printText, quickDropText, role, session, text }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState("");
  const [customerMode, setCustomerMode] = useState<CustomerMode>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [services, setServices] = useState<ShopService[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
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

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const currency = services[0]?.currency ?? "EUR";
  const subtotal = roundMoney(cart.reduce((sum, line) => sum + line.quantity * line.service.amount, 0));
  const safeDiscount = Math.min(Math.max(roundMoney(discount || 0), 0), subtotal);
  const total = roundMoney(subtotal - safeDiscount);
  const canDiscount = role === "owner" || role === "manager";

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase(locale);
    return customers.filter((customer) => !query || [customer.name, customer.phone, customer.email]
      .some((value) => value?.toLocaleLowerCase(locale).includes(query))).slice(0, 8);
  }, [customerQuery, customers, locale]);
  const categories = useMemo(() => Array.from(new Set(services.map((service) => service.category).filter(Boolean) as string[])), [services]);
  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLocaleLowerCase(locale);
    return services.filter((service) => (category === "all" || service.category === category)
      && (!query || [service.name, service.code, service.description].some((value) => value?.toLocaleLowerCase(locale).includes(query))));
  }, [category, locale, serviceQuery, services]);

  function selectCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    setServices([]);
    setCart([]);
    setCategory("all");
    setServiceQuery("");
    startLoading(async () => setServices(await actions.loadServices(nextCustomerId, session?.locationId ?? null)));
  }

  function clearCustomer() {
    setCustomerId("");
    setServices([]);
    setCart([]);
    setCategory("all");
    setCustomerMode(null);
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
      customerName: selectedCustomer?.name,
      customerNotes: formData.get("customerNotes"),
      discountAmount: safeDiscount,
      dueAt: formData.get("dueAt"),
      idempotencyKey: crypto.randomUUID(),
      internalNotes: formData.get("internalNotes"),
      items: cart.map((line) => ({ quantity: line.quantity, serviceId: line.service.id })),
      locationId: session?.locationId ?? null,
      payments,
      sessionId: intent === "later" ? null : session?.id ?? null,
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
    <header className="border-b border-white/10 bg-primary px-4 py-3 text-white sm:px-5">
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
        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><div className="border-l-4 border-primary bg-white p-5 shadow-card sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.12em] text-secondary">✓ {text.orderSuccess}</p><h2 className="mt-1 text-3xl font-black text-primary">{result.orderNumber}</h2><p className="mt-1 text-lg font-semibold text-muted">{result.customerName}</p></div><dl className="grid grid-cols-3 gap-3">{[[text.total, result.total], [text.paid, result.paid], [text.outstanding, result.outstanding]].map(([label, value]) => <div className="min-w-0 border-l border-border pl-3" key={String(label)}><dt className="text-xs font-bold uppercase text-muted">{label}</dt><dd className="mt-1 whitespace-nowrap text-xl font-black text-primary sm:text-2xl">{formatCurrency(Number(value), currency, locale)}</dd></div>)}</dl></div>{result.dueAt ? <p className="mt-4 text-sm text-muted">{text.dueAt}: <strong className="text-primary">{new Date(result.dueAt).toLocaleString(locale)}</strong></p> : null}<div className="mt-6 flex flex-wrap gap-3"><button className="min-h-12 rounded-control bg-primary px-6 font-bold text-white" onClick={resetOrder} type="button">{text.newOrder}</button><Link className="inline-flex min-h-12 items-center rounded-control border border-primary px-5 font-bold !text-primary" href={`/app/orders/${result.orderId}`} locale={locale}>{text.openOrder}</Link>{canPrint ? <PrintOrderActions locale={locale} orderId={result.orderId} text={printText} /> : null}{canInvoice ? <Link className="inline-flex min-h-12 items-center rounded-control bg-primary-strong px-5 font-bold !text-white" href={`/app/billing/new?customerId=${result.customerId}&orderId=${result.orderId}&source=shop`} locale={locale}>{text.invoice}</Link> : null}</div></div></section>
      </div>
    );
  }

  return (
    <div className="counter-register-shell min-h-screen bg-[#eef1ed]">
      {terminalHeader}
      <section className="border-b border-border bg-white px-4 py-3 sm:px-5">
        {canScan ? <form className="mb-3 flex min-w-0 flex-col gap-2 border-l-4 border-primary bg-primary-soft p-3 sm:flex-row sm:items-end" onSubmit={resolveCode}><label className="min-w-0 flex-1 text-xs font-black uppercase tracking-[0.1em] text-primary">{text.scanCode}<input autoComplete="off" className="mt-1 min-h-11 w-full min-w-0 rounded-control border border-primary/30 bg-white px-3 font-mono text-base text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary" disabled={isResolving} onChange={(event) => { setScanValue(event.target.value); setScanError(null); }} placeholder={text.scanPlaceholder} spellCheck={false} value={scanValue} /></label><button className="min-h-11 shrink-0 rounded-control bg-primary px-5 font-bold text-white disabled:opacity-50" disabled={isResolving || !scanValue.trim()} type="submit">{isResolving ? text.scanning : text.scanSubmit}</button>{scanError ? <p aria-live="polite" className="text-sm font-semibold text-red-700 sm:self-center">{scanError === "invalid" ? text.scanInvalid : text.scanNotFound}</p> : null}</form> : null}
        {selectedCustomer ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted">{text.currentCustomer}</p><div className="mt-0.5 flex flex-wrap items-center gap-2"><strong className="truncate text-lg text-primary">{selectedCustomer.name}</strong>{selectedCustomer.isWalkIn ? <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-primary">{text.occasionalCustomer}</span> : null}<span className="text-sm text-muted">{selectedCustomer.phone || selectedCustomer.email || "—"}</span></div></div><button className="min-h-10 rounded-control border border-primary/25 px-4 text-sm font-bold text-primary" onClick={clearCustomer} type="button">{text.changeCustomer}</button></div>
        ) : (
          <div className="space-y-2"><div className="grid gap-2 md:grid-cols-[minmax(15rem,1fr)_auto_auto]"><label><span className="sr-only">{text.customerSearch}</span><input className="min-h-12 w-full rounded-control border border-border bg-[#f8faf8] px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setCustomerQuery(event.target.value)} placeholder={text.customerSearch} type="search" value={customerQuery} /></label><button className="min-h-12 rounded-control border border-primary/25 px-5 font-bold text-primary" onClick={() => setCustomerMode(customerMode === "regular" ? null : "regular")} type="button">+ {text.regularCustomer}</button><button className="min-h-12 rounded-control bg-primary-soft px-5 font-bold text-primary" onClick={() => setCustomerMode(customerMode === "walk_in" ? null : "walk_in")} type="button">{text.occasionalCustomer}</button></div>
            {!customerMode ? <div className="flex gap-2 overflow-x-auto pb-1">{filteredCustomers.map((customer) => <button className="min-h-11 shrink-0 rounded-control border border-border bg-white px-4 text-left hover:border-primary/40" key={customer.id} onClick={() => selectCustomer(customer.id)} type="button"><strong className="block max-w-56 truncate text-sm text-primary">{customer.name}</strong><span className="block max-w-56 truncate text-xs text-muted">{customer.phone || customer.email || (customer.isWalkIn ? text.occasionalCustomer : "—")}</span></button>)}</div> : <form action={createCustomer} className="grid gap-3 border-l-4 border-primary bg-[#f8faf8] p-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end"><input name="customerKind" type="hidden" value={customerMode} /><label className="text-xs font-bold text-muted">{customerMode === "walk_in" ? text.occasionalHelp : text.regularHelp}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3 text-base text-primary" name="displayName" placeholder={text.customerName} required /></label><label className="text-xs font-bold text-muted">{text.customerPhone}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3 text-base text-primary" name="phone" placeholder={text.customerPhone} /></label><label className="text-xs font-bold text-muted">{text.customerEmail}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3 text-base text-primary" name="email" placeholder={text.customerEmail} type="email" /></label><button className="min-h-11 rounded-control bg-primary px-5 font-bold text-white" disabled={isCreatingCustomer}>{isCreatingCustomer ? text.saving : customerMode === "walk_in" ? text.continueToCatalog : text.saveCustomer}</button>{customerState.error ? <p className="text-sm font-semibold text-red-700 md:col-span-4">{customerState.error === "validation" ? text.errorValidation : text.errorGeneric}</p> : null}</form>}
          </div>
        )}
        <div className="mt-3"><QuickDropTerminalPanel action={actions.createQuickDrop} canPrint={canPrint} canQr={canScan} customer={selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name } : null} locale={locale} locationId={session?.locationId ?? null} onNewOrder={clearCustomer} pending={pendingQuickDrops} printText={printText} text={quickDropText} /></div>
      </section>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,2.1fr)_minmax(20rem,1fr)] xl:grid-cols-[minmax(0,2.2fr)_minmax(23rem,1fr)]">
        <main className="min-w-0 p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-black uppercase tracking-[0.08em] text-primary">{text.catalog}</h2><input className="min-h-11 w-full rounded-control border border-border bg-white px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:max-w-sm" disabled={!selectedCustomer} onChange={(event) => setServiceQuery(event.target.value)} placeholder={text.searchServices} type="search" value={serviceQuery} /></div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1"><button className={`min-h-12 shrink-0 rounded-control px-5 text-sm font-black uppercase tracking-wide ${category === "all" ? "bg-primary text-white" : "border border-border bg-white text-primary"}`} disabled={!selectedCustomer} onClick={() => setCategory("all")} type="button">{text.categoryAll}</button>{categories.map((item) => <button className={`min-h-12 shrink-0 rounded-control px-5 text-sm font-black uppercase tracking-wide ${category === item ? "bg-primary text-white" : "border border-border bg-white text-primary"}`} key={item} onClick={() => setCategory(item)} type="button">{item}</button>)}</div>
          {!selectedCustomer ? <div className="flex min-h-[28rem] flex-col items-center justify-center border-2 border-dashed border-primary/20 bg-white px-6 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-3xl">👤</span><h3 className="mt-4 text-2xl font-black text-primary">{text.selectCustomer}</h3><p className="mt-2 max-w-md text-muted">{text.noCustomer}</p></div> : isLoading ? <div className="bg-white py-24 text-center font-semibold text-muted">{text.loadingCatalog}</div> : filteredServices.length ? <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{filteredServices.map((service) => <button className="group relative flex min-h-40 flex-col justify-between overflow-hidden rounded-control border border-border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" key={service.id} onClick={() => addService(service)} type="button">{service.imageUrl ? <PortalMedia alt={service.name} className="aspect-[16/7] w-full border-b border-border" imageClassName="transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 639px) 100vw, (max-width: 1535px) 50vw, 33vw" src={service.imageUrl} /> : <span className="absolute inset-x-0 top-0 h-1 bg-primary transition-all group-hover:h-2" />}<span className="flex flex-1 flex-col justify-between p-4"><span><span className="mb-3 inline-flex min-h-8 min-w-8 items-center justify-center rounded-control bg-primary-soft px-2 text-xs font-black uppercase text-primary">{(service.category || text.categoryAll).slice(0, 2)}</span><strong className="block text-lg leading-tight text-primary">{service.name}</strong><span className="mt-2 block text-xs font-bold uppercase tracking-wide text-muted">{service.category || text.categoryAll} · {text.unitTypes[service.unitType]}</span></span><span className="mt-5 flex items-end justify-between gap-2"><strong className="text-2xl font-black text-primary">{service.priceIsFrom ? `${text.priceFrom} ` : ""}{formatCurrency(service.amount, service.currency, locale)}</strong><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-black text-white">+</span></span>{service.pricingSource === "segment" ? <span className="mt-2 text-xs font-bold text-secondary">{text.segmentPrice.replace("{segment}", service.pricingSegmentName ?? "")}</span> : <span className="mt-2 text-xs font-semibold text-muted">{text.basePrice}</span>}</span></button>)}</div> : <p className="bg-white py-24 text-center font-semibold text-muted">{text.emptyCatalog}</p>}
        </main>

        <aside className="min-w-0 border-t border-border bg-white shadow-[-12px_0_30px_rgb(15_59_46_/_0.06)] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="p-4 sm:p-5"><div className="flex items-center justify-between border-b-2 border-primary pb-3"><div><p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-muted">{selectedCustomer?.name ?? text.customer}</p><h2 className="text-xl font-black text-primary">{text.cart}</h2></div>{cart.length ? <button className="min-h-10 px-2 text-sm font-bold text-red-700" onClick={() => setCart([])} type="button">{text.clear}</button> : null}</div>
            <div className="max-h-[32vh] overflow-y-auto lg:max-h-[30vh]">{cart.length ? cart.map((line) => <div className="border-b border-border py-3" key={line.service.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold leading-tight text-primary">{line.service.name}</p><p className="mt-1 text-xs text-muted">{formatCurrency(line.service.amount, line.service.currency, locale)} / {text.unitTypes[line.service.unitType]}</p></div><strong className="whitespace-nowrap text-lg text-primary">{formatCurrency(line.quantity * line.service.amount, line.service.currency, locale)}</strong></div><div className="mt-2 flex items-center justify-between gap-3"><div className="flex items-center rounded-control border border-border bg-[#f7f8f5]"><button aria-label={`− ${text.quantity}`} className="min-h-11 min-w-11 text-xl font-black text-primary" onClick={() => adjustQuantity(line, -1)} type="button">−</button><input aria-label={text.quantity} className="h-11 w-16 border-x border-border bg-white text-center text-base font-black text-primary" min={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.001} onChange={(event) => updateQuantity(line.service.id, Number(event.target.value))} step={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.1} type="number" value={line.quantity} /><button aria-label={`+ ${text.quantity}`} className="min-h-11 min-w-11 text-xl font-black text-primary" onClick={() => adjustQuantity(line, 1)} type="button">+</button></div><button className="min-h-11 px-2 text-sm font-bold text-red-700" onClick={() => setCart((current) => current.filter((item) => item.service.id !== line.service.id))} type="button">{text.remove}</button></div></div>) : <p className="py-10 text-center text-muted">{text.emptyCart}</p>}</div>
            <form action={submit} className="mt-4 space-y-3" onSubmit={prepareSubmission}><input name="payload" ref={payloadRef} type="hidden" /><label className="flex items-center justify-between gap-3 text-sm font-bold text-primary"><span>{text.discount}</span><input className="min-h-10 w-28 rounded-control border border-border px-3 text-right text-lg" disabled={!canDiscount} max={subtotal} min="0" onChange={(event) => setDiscount(Number(event.target.value))} step="0.01" type="number" value={discount} /></label><dl className="space-y-1.5 border-t border-border pt-3"><div className="flex justify-between text-sm"><dt className="text-muted">{text.subtotal}</dt><dd className="font-bold text-primary">{formatCurrency(subtotal, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.discount}</dt><dd className="font-bold text-primary">− {formatCurrency(safeDiscount, currency, locale)}</dd></div><div className="mt-2 flex items-end justify-between rounded-control bg-primary p-4 text-white"><dt className="text-sm font-black uppercase tracking-[0.12em]">{text.total}</dt><dd className="text-4xl font-black">{formatCurrency(total, currency, locale)}</dd></div><div className="flex justify-between pt-1 text-sm"><dt className="text-muted">{text.paid}</dt><dd className="font-bold text-primary">{formatCurrency(0, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.outstanding}</dt><dd className="font-black text-primary">{formatCurrency(total, currency, locale)}</dd></div></dl><details className="border-b border-border pb-3"><summary className="cursor-pointer text-sm font-bold text-primary">{text.notes}</summary><div className="mt-3 space-y-2"><label className="block text-xs font-bold text-muted">{text.dueAt}<input className="mt-1 min-h-11 w-full rounded-control border border-border px-3" name="dueAt" type="datetime-local" /></label><textarea className="min-h-16 w-full rounded-control border border-border p-3" name="customerNotes" placeholder={text.notes} /><textarea className="min-h-16 w-full rounded-control border border-border p-3" name="internalNotes" placeholder={text.notes} /></div></details>{submitState.error ? <p className="rounded-control bg-red-50 p-3 text-sm font-semibold text-red-700">{submitState.error === "validation" ? text.errorValidation : submitState.error === "till" ? text.errorTill : submitState.error === "discount" ? text.errorDiscount : text.errorGeneric}</p> : null}<fieldset><legend className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted">{text.payment}</legend><div className="grid grid-cols-3 gap-2"><button className="min-h-16 rounded-control bg-primary px-2 text-sm font-black uppercase text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0} name="intent" type="submit" value="cash">{isSubmitting ? text.saving : text.paymentCash}</button><button className="min-h-16 rounded-control bg-primary-strong px-2 text-sm font-black uppercase text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0} name="intent" type="submit" value="card">{isSubmitting ? text.saving : text.paymentCard}</button><button className="min-h-16 rounded-control border-2 border-primary bg-white px-2 text-sm font-black uppercase text-primary disabled:opacity-40" disabled={isSubmitting || !customerId || !cart.length || total < 0} name="intent" type="submit" value="later">{isSubmitting ? text.saving : text.payLater}</button></div></fieldset><input className="min-h-10 w-full rounded-control border border-border px-3 text-sm" onChange={(event) => setCardReference(event.target.value)} placeholder={text.cardReference} value={cardReference} /><button className="min-h-10 w-full text-sm font-bold text-primary underline underline-offset-4" onClick={() => setShowSplitPayment((current) => !current)} type="button">{text.splitPayment}</button>{showSplitPayment ? <div className="grid grid-cols-2 gap-2 border-l-4 border-primary bg-primary-soft p-3"><label className="text-xs font-bold text-muted">{text.splitCash}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-2" min="0" onChange={(event) => setSplitCash(Number(event.target.value))} step="0.01" type="number" value={splitCash} /></label><label className="text-xs font-bold text-muted">{text.splitCard}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-2" min="0" onChange={(event) => setSplitCard(Number(event.target.value))} step="0.01" type="number" value={splitCard} /></label><button className="col-span-2 min-h-12 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0 || roundMoney(splitCash + splitCard) !== total} name="intent" type="submit" value="split">{text.confirmSplit}</button></div> : null}{!session ? <Link className="flex min-h-12 items-center justify-center rounded-control bg-amber-50 px-3 text-sm font-bold !text-amber-800" href="/app/pos" locale={locale}>{text.openTill} →</Link> : null}</form>
          </div>
        </aside>
      </div>
    </div>
  );
}
