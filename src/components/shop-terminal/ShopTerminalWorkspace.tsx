"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { PrintOrderActions, type PrintActionText } from "@/components/printing/PrintOrderActions";
import type { PosSession } from "@/features/pos/types";
import { isDiscreteServiceUnit } from "@/features/services/types";
import type { ShopCustomer, ShopCustomerState, ShopService, ShopSubmitState } from "@/features/shop-terminal/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/number-format";

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
  occasionalHelp: string; openOrder: string; openTill: string; operator: string; orderSuccess: string;
  outstanding: string; paid: string; payLater: string; payNow: string; payment: string;
  paymentCard: string; paymentCash: string; paymentSplit: string; priceFrom: string; quantity: string;
  recentCustomers: string; regularCustomer: string; regularHelp: string; remove: string;
  saveCustomer: string; saving: string; searchServices: string; segmentPrice: string;
  selectCustomer: string; splitCard: string; splitCash: string; splitPayment: string;
  subtotal: string; tillManagement: string; tillOpen: string; tillRequired: string; title: string;
  total: string; unitTypes: Record<string, string>;
};

type Props = {
  actions: {
    createCustomer: (state: ShopCustomerState, formData: FormData) => Promise<ShopCustomerState>;
    loadServices: (customerId: string, locationId: string | null) => Promise<ShopService[]>;
    submit: (state: ShopSubmitState, formData: FormData) => Promise<ShopSubmitState>;
  };
  canPrint: boolean;
  customers: ShopCustomer[];
  locale: string;
  operatorName: string;
  organizationName: string;
  printText: PrintActionText;
  role: string;
  session: PosSession | null;
  text: ShopTerminalText;
};

const initialCustomerState: ShopCustomerState = { customer: null, error: null };
const initialSubmitState: ShopSubmitState = { error: null, result: null };
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function ShopTerminalWorkspace({ actions, canPrint, customers: initialCustomers, locale, operatorName, organizationName, printText, role, session, text }: Props) {
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
    setCustomerId(nextCustomerId); setServices([]); setCart([]); setCategory("all"); setServiceQuery("");
    startLoading(async () => setServices(await actions.loadServices(nextCustomerId, session?.locationId ?? null)));
  }

  function clearCustomer() {
    setCustomerId(""); setServices([]); setCart([]); setCategory("all"); setCustomerMode(null);
  }

  function addService(service: ShopService) {
    setCart((current) => {
      const existing = current.find((line) => line.service.id === service.id);
      if (!existing) return [...current, { quantity: 1, service }];
      const increment = isDiscreteServiceUnit(service.unitType) ? 1 : 0.1;
      return current.map((line) => line.service.id === service.id ? { ...line, quantity: Math.round((line.quantity + increment) * 1000) / 1000 } : line);
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
          ? [...(splitCash > 0 ? [{ amount: roundMoney(splitCash), idempotencyKey: crypto.randomUUID(), method: "cash" }] : []), ...(splitCard > 0 ? [{ amount: roundMoney(splitCard), idempotencyKey: crypto.randomUUID(), method: "card", reference: cardReference }] : [])]
          : [];
    const payload = {
      customerId, customerName: selectedCustomer?.name, customerNotes: formData.get("customerNotes"), discountAmount: safeDiscount,
      dueAt: formData.get("dueAt"), idempotencyKey: crypto.randomUUID(), internalNotes: formData.get("internalNotes"),
      items: cart.map((line) => ({ quantity: line.quantity, serviceId: line.service.id })), locationId: session?.locationId ?? null,
      payments, sessionId: intent === "later" ? null : session?.id ?? null,
    };
    if (payloadRef.current) payloadRef.current.value = JSON.stringify(payload);
  }

  function resetOrder() {
    setDismissedOrderId(submitState.result?.orderId ?? null); clearCustomer(); setDiscount(0); setSplitCash(0); setSplitCard(0); setCardReference(""); setShowSplitPayment(false);
  }

  const terminalHeader = (
    <header className="flex flex-col gap-3 border-b border-border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0"><p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-secondary">{organizationName}</p><h2 className="text-xl font-black text-primary">{text.title}</h2></div>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-[#f1f4f2] px-3 py-2 text-primary">{text.operator}: {operatorName}</span><Link className={`rounded-full px-3 py-2 ${session ? "bg-primary-soft !text-primary" : "bg-amber-50 !text-amber-800"}`} href="/app/pos" locale={locale}>{session ? `${text.tillOpen} · ${session.locationName ?? organizationName}` : text.tillRequired} · {text.tillManagement} →</Link></div>
    </header>
  );

  if (submitState.result && dismissedOrderId !== submitState.result.orderId) {
    const result = submitState.result;
    return <div className="-mx-4 -my-5 min-h-[calc(100vh-5rem)] bg-[#f7f8f5] sm:-mx-6 lg:-mx-8 lg:-my-7 xl:-mx-10">{terminalHeader}<section className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><div className="border-l-4 border-primary bg-white p-5 shadow-card sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.12em] text-secondary">✓ {text.orderSuccess}</p><h2 className="mt-1 text-3xl font-black text-primary">{result.orderNumber}</h2><p className="mt-1 text-lg font-semibold text-muted">{result.customerName}</p></div><dl className="grid grid-cols-3 gap-3">{[[text.total, result.total], [text.paid, result.paid], [text.outstanding, result.outstanding]].map(([label, value]) => <div className="min-w-0 border-l border-border pl-3" key={String(label)}><dt className="text-xs font-bold uppercase text-muted">{label}</dt><dd className="mt-1 whitespace-nowrap text-xl font-black text-primary sm:text-2xl">{formatCurrency(Number(value), currency, locale)}</dd></div>)}</dl></div>{result.dueAt ? <p className="mt-4 text-sm text-muted">{text.dueAt}: <strong className="text-primary">{new Date(result.dueAt).toLocaleString(locale)}</strong></p> : null}<div className="mt-6 flex flex-wrap gap-3"><button className="min-h-12 rounded-control bg-primary px-6 font-bold text-white" onClick={resetOrder} type="button">{text.newOrder}</button><Link className="inline-flex min-h-12 items-center rounded-control border border-primary px-5 font-bold !text-primary" href={`/app/orders/${result.orderId}`} locale={locale}>{text.openOrder}</Link>{canPrint ? <PrintOrderActions locale={locale} orderId={result.orderId} text={printText} /> : null}</div></div></section></div>;
  }

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-5rem)] bg-[#f7f8f5] sm:-mx-6 lg:-mx-8 lg:-my-7 xl:-mx-10">
      {terminalHeader}
      <section className="border-b border-border bg-[#fffdf8] px-4 py-4 sm:px-6">
        {selectedCustomer ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{text.currentCustomer}</p><div className="mt-1 flex flex-wrap items-center gap-2"><strong className="truncate text-xl text-primary">{selectedCustomer.name}</strong>{selectedCustomer.isWalkIn ? <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-primary">{text.occasionalCustomer}</span> : null}<span className="text-sm text-muted">{selectedCustomer.phone || selectedCustomer.email || "—"}</span></div></div><button className="min-h-11 rounded-control border border-primary/25 bg-white px-4 text-sm font-bold text-primary" onClick={clearCustomer} type="button">{text.changeCustomer}</button></div> : <div className="space-y-3"><div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_auto_auto]"><label className="relative block"><span className="sr-only">{text.customerSearch}</span><input className="min-h-14 w-full rounded-control border border-border bg-white px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setCustomerQuery(event.target.value)} placeholder={text.customerSearch} type="search" value={customerQuery} /></label><button className="min-h-14 rounded-control border border-primary/25 bg-white px-5 font-bold text-primary" onClick={() => setCustomerMode(customerMode === "regular" ? null : "regular")} type="button">+ {text.regularCustomer}</button><button className="min-h-14 rounded-control bg-primary-soft px-5 font-bold text-primary" onClick={() => setCustomerMode(customerMode === "walk_in" ? null : "walk_in")} type="button">{text.occasionalCustomer}</button></div>{!customerMode ? <div className="flex gap-2 overflow-x-auto pb-1">{filteredCustomers.map((customer) => <button className="min-h-12 shrink-0 rounded-control border border-border bg-white px-4 text-left hover:border-primary/40" key={customer.id} onClick={() => selectCustomer(customer.id)} type="button"><strong className="block max-w-56 truncate text-sm text-primary">{customer.name}</strong><span className="block max-w-56 truncate text-xs text-muted">{customer.phone || customer.email || (customer.isWalkIn ? text.occasionalCustomer : "—")}</span></button>)}</div> : <form action={createCustomer} className="grid gap-3 border-l-4 border-primary bg-white p-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end"><input name="customerKind" type="hidden" value={customerMode} /><label className="text-xs font-bold text-muted">{customerMode === "walk_in" ? text.occasionalHelp : text.regularHelp}<input className="mt-1 min-h-12 w-full rounded-control border border-border px-3 text-base text-primary" name="displayName" placeholder={text.customerName} required /></label><label className="text-xs font-bold text-muted">{text.customerPhone}<input className="mt-1 min-h-12 w-full rounded-control border border-border px-3 text-base text-primary" name="phone" placeholder={text.customerPhone} /></label><label className="text-xs font-bold text-muted">{text.customerEmail}<input className="mt-1 min-h-12 w-full rounded-control border border-border px-3 text-base text-primary" name="email" placeholder={text.customerEmail} type="email" /></label><button className="min-h-12 rounded-control bg-primary px-5 font-bold text-white" disabled={isCreatingCustomer}>{isCreatingCustomer ? text.saving : customerMode === "walk_in" ? text.continueToCatalog : text.saveCustomer}</button>{customerState.error ? <p className="text-sm font-semibold text-red-700 md:col-span-4">{customerState.error === "validation" ? text.errorValidation : text.errorGeneric}</p> : null}</form>}</div>}
      </section>

      <div className="grid min-w-0 gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
        <main className="min-w-0"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-xl font-black text-primary">{text.catalog}</h3><input className="min-h-12 w-full rounded-control border border-border bg-white px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:max-w-md" disabled={!selectedCustomer} onChange={(event) => setServiceQuery(event.target.value)} placeholder={text.searchServices} type="search" value={serviceQuery} /></div><div className="mb-4 flex gap-2 overflow-x-auto pb-1"><button className={`min-h-14 shrink-0 rounded-control px-5 text-base font-black ${category === "all" ? "bg-primary text-white" : "border border-border bg-white text-primary"}`} disabled={!selectedCustomer} onClick={() => setCategory("all")} type="button">{text.categoryAll}</button>{categories.map((item) => <button className={`min-h-14 shrink-0 rounded-control px-5 text-base font-black ${category === item ? "bg-primary text-white" : "border border-border bg-white text-primary"}`} key={item} onClick={() => setCategory(item)} type="button">{item}</button>)}</div>{!selectedCustomer ? <div className="flex min-h-[26rem] flex-col items-center justify-center border-2 border-dashed border-primary/20 bg-white px-6 text-center"><span className="text-4xl">👤</span><h3 className="mt-4 text-2xl font-black text-primary">{text.selectCustomer}</h3><p className="mt-2 max-w-md text-muted">{text.noCustomer}</p></div> : isLoading ? <div className="py-24 text-center font-semibold text-muted">{text.loadingCatalog}</div> : filteredServices.length ? <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{filteredServices.map((service) => <button className="group flex min-h-36 flex-col justify-between rounded-control border border-border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" key={service.id} onClick={() => addService(service)} type="button"><span><strong className="block text-lg leading-tight text-primary">{service.name}</strong><span className="mt-2 block text-xs font-bold uppercase tracking-wide text-muted">{service.category || text.categoryAll} · {text.unitTypes[service.unitType]}</span></span><span className="mt-5 flex items-end justify-between gap-2"><strong className="text-2xl font-black text-primary">{service.priceIsFrom ? `${text.priceFrom} ` : ""}{formatCurrency(service.amount, service.currency, locale)}</strong>{service.pricingSource === "segment" ? <span className="rounded-full bg-primary-soft px-2 py-1 text-xs font-bold text-secondary">{text.segmentPrice.replace("{segment}", service.pricingSegmentName ?? "")}</span> : <span className="text-xs font-semibold text-muted">{text.basePrice}</span>}</span></button>)}</div> : <p className="bg-white py-24 text-center font-semibold text-muted">{text.emptyCatalog}</p>}</main>

        <aside className="min-w-0 bg-white p-4 shadow-card xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto sm:p-5"><div className="flex items-center justify-between border-b border-border pb-3"><h3 className="text-xl font-black text-primary">{text.cart}</h3>{cart.length ? <button className="min-h-11 px-2 text-sm font-bold text-red-700" onClick={() => setCart([])} type="button">{text.clear}</button> : null}</div><div className="max-h-[32vh] overflow-y-auto">{cart.length ? cart.map((line) => <div className="border-b border-border py-3" key={line.service.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold leading-tight text-primary">{line.service.name}</p><p className="mt-1 text-xs text-muted">{formatCurrency(line.service.amount, line.service.currency, locale)} / {text.unitTypes[line.service.unitType]}</p></div><strong className="whitespace-nowrap text-lg text-primary">{formatCurrency(line.quantity * line.service.amount, line.service.currency, locale)}</strong></div><div className="mt-2 flex items-center justify-between gap-3"><div className="flex items-center rounded-control border border-border bg-[#f7f8f5]"><button aria-label={`− ${text.quantity}`} className="min-h-11 min-w-11 text-xl font-black text-primary" onClick={() => adjustQuantity(line, -1)} type="button">−</button><input aria-label={text.quantity} className="h-11 w-16 border-x border-border bg-white text-center text-base font-black text-primary" min={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.001} onChange={(event) => updateQuantity(line.service.id, Number(event.target.value))} step={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.1} type="number" value={line.quantity} /><button aria-label={`+ ${text.quantity}`} className="min-h-11 min-w-11 text-xl font-black text-primary" onClick={() => adjustQuantity(line, 1)} type="button">+</button></div><button className="min-h-11 px-2 text-sm font-bold text-red-700" onClick={() => setCart((current) => current.filter((item) => item.service.id !== line.service.id))} type="button">{text.remove}</button></div></div>) : <p className="py-10 text-center text-muted">{text.emptyCart}</p>}</div>
          <form action={submit} className="mt-4 space-y-4" onSubmit={prepareSubmission}><input name="payload" ref={payloadRef} type="hidden" /><label className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm font-bold text-primary"><span>{text.discount}</span><input className="min-h-11 w-28 rounded-control border border-border px-3 text-right text-lg" disabled={!canDiscount} max={subtotal} min="0" onChange={(event) => setDiscount(Number(event.target.value))} step="0.01" type="number" value={discount} /></label><dl className="space-y-2"><div className="flex justify-between text-sm"><dt className="text-muted">{text.subtotal}</dt><dd className="font-bold text-primary">{formatCurrency(subtotal, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.discount}</dt><dd className="font-bold text-primary">− {formatCurrency(safeDiscount, currency, locale)}</dd></div><div className="flex items-end justify-between border-y-2 border-primary py-3"><dt className="text-lg font-black uppercase text-primary">{text.total}</dt><dd className="text-4xl font-black text-primary">{formatCurrency(total, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.paid}</dt><dd className="font-bold text-primary">{formatCurrency(0, currency, locale)}</dd></div><div className="flex justify-between text-sm"><dt className="text-muted">{text.outstanding}</dt><dd className="font-bold text-primary">{formatCurrency(total, currency, locale)}</dd></div></dl><details className="border-b border-border pb-3"><summary className="cursor-pointer text-sm font-bold text-primary">{text.notes}</summary><div className="mt-3 space-y-2"><label className="block text-xs font-bold text-muted">{text.dueAt}<input className="mt-1 min-h-11 w-full rounded-control border border-border px-3" name="dueAt" type="datetime-local" /></label><textarea className="min-h-16 w-full rounded-control border border-border p-3" name="customerNotes" placeholder={text.notes} /><textarea className="min-h-16 w-full rounded-control border border-border p-3" name="internalNotes" placeholder={text.notes} /></div></details>{submitState.error ? <p className="rounded-control bg-red-50 p-3 text-sm font-semibold text-red-700">{submitState.error === "validation" ? text.errorValidation : submitState.error === "till" ? text.errorTill : submitState.error === "discount" ? text.errorDiscount : text.errorGeneric}</p> : null}<fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{text.payment}</legend><div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3"><button className="min-h-16 rounded-control bg-primary px-3 text-base font-black uppercase text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0} name="intent" type="submit" value="cash">{isSubmitting ? text.saving : text.paymentCash}</button><button className="min-h-16 rounded-control bg-primary px-3 text-base font-black uppercase text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0} name="intent" type="submit" value="card">{isSubmitting ? text.saving : text.paymentCard}</button><button className="min-h-16 rounded-control border-2 border-primary bg-white px-3 text-base font-black uppercase text-primary disabled:opacity-40" disabled={isSubmitting || !customerId || !cart.length || total < 0} name="intent" type="submit" value="later">{isSubmitting ? text.saving : text.payLater}</button></div></fieldset><input className="min-h-11 w-full rounded-control border border-border px-3 text-sm" onChange={(event) => setCardReference(event.target.value)} placeholder={text.cardReference} value={cardReference} /><button className="min-h-11 w-full text-sm font-bold text-primary underline underline-offset-4" onClick={() => setShowSplitPayment((current) => !current)} type="button">{text.splitPayment}</button>{showSplitPayment ? <div className="grid grid-cols-2 gap-2 border-l-4 border-primary bg-primary-soft p-3"><label className="text-xs font-bold text-muted">{text.splitCash}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-2" min="0" onChange={(event) => setSplitCash(Number(event.target.value))} step="0.01" type="number" value={splitCash} /></label><label className="text-xs font-bold text-muted">{text.splitCard}<input className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-2" min="0" onChange={(event) => setSplitCard(Number(event.target.value))} step="0.01" type="number" value={splitCard} /></label><button className="col-span-2 min-h-12 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0 || roundMoney(splitCash + splitCard) !== total} name="intent" type="submit" value="split">{text.confirmSplit}</button></div> : null}{!session ? <Link className="flex min-h-12 items-center justify-center rounded-control bg-amber-50 px-3 text-sm font-bold !text-amber-800" href="/app/pos" locale={locale}>{text.openTill} →</Link> : null}</form>
        </aside>
      </div>
    </div>
  );
}
