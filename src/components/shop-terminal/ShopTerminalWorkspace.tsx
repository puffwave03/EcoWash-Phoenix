"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { PrintOrderActions, type PrintActionText } from "@/components/printing/PrintOrderActions";
import { formatCurrency } from "@/lib/number-format";
import { isDiscreteServiceUnit } from "@/features/services/types";
import type { PosSession } from "@/features/pos/types";
import type {
  ShopCustomer,
  ShopCustomerState,
  ShopRecentOrder,
  ShopService,
  ShopSubmitState,
} from "@/features/shop-terminal/types";

type CartLine = { quantity: number; service: ShopService };

export type ShopTerminalText = {
  addCustomer: string; basePrice: string; card: string; cardReference: string; cart: string;
  cash: string; categoryAll: string; clear: string; customer: string; customerEmail: string;
  customerName: string; customerPhone: string; customerSearch: string; discount: string;
  dueAt: string; emptyCart: string; emptyCatalog: string; errorDiscount: string;
  errorGeneric: string; errorTill: string; errorValidation: string; loadingCatalog: string;
  newCustomer: string; newOrder: string; noCustomer: string; notes: string; openOrder: string;
  openTill: string; orderSuccess: string; outstanding: string; paid: string; payLater: string;
  payNow: string; payment: string; paymentCard: string; paymentCash: string; paymentSplit: string;
  priceFrom: string; quantity: string; recentCustomers: string; recentOrders: string; remove: string;
  saveCustomer: string; saving: string; searchServices: string; segmentPrice: string; selectCustomer: string;
  splitCard: string; splitCash: string; subtotal: string; tillOpen: string; tillRequired: string;
  title: string; total: string; unitTypes: Record<string, string>;
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
  organizationName: string;
  printText: PrintActionText;
  recentOrders: ShopRecentOrder[];
  role: string;
  session: PosSession | null;
  text: ShopTerminalText;
};

const initialCustomerState: ShopCustomerState = { customer: null, error: null };
const initialSubmitState: ShopSubmitState = { error: null, result: null };

function roundMoney(value: number) { return Math.round(value * 100) / 100; }

export function ShopTerminalWorkspace({ actions, canPrint, customers: initialCustomers, locale, organizationName, printText, recentOrders, role, session, text }: Props) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [services, setServices] = useState<ShopService[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "split">("cash");
  const [splitCash, setSplitCash] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const [cardReference, setCardReference] = useState("");
  const [dismissedOrderId, setDismissedOrderId] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerState, createCustomer, isCreatingCustomer] = useActionState(async (state: ShopCustomerState, formData: FormData) => {
    const result = await actions.createCustomer(state, formData);
    if (result.customer) {
      setCustomers((current) => [result.customer!, ...current.filter((customer) => customer.id !== result.customer!.id)]);
      selectCustomer(result.customer.id);
      setShowNewCustomer(false);
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
      .some((value) => value?.toLocaleLowerCase(locale).includes(query))).slice(0, 12);
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
    startLoading(async () => {
      const nextServices = await actions.loadServices(nextCustomerId, session?.locationId ?? null);
      setServices(nextServices);
    });
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
      const quantity = isDiscreteServiceUnit(line.service.unitType) ? Math.trunc(raw) : Math.round(raw * 1000) / 1000;
      return { ...line, quantity: Math.max(quantity, isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.001) };
    }));
  }

  function prepareSubmission(event: React.FormEvent<HTMLFormElement>) {
    const native = event.nativeEvent as SubmitEvent;
    const intent = (native.submitter as HTMLButtonElement | null)?.value ?? "later";
    const formData = new FormData(event.currentTarget);
    const payments = intent === "now"
      ? paymentMode === "cash"
        ? [{ amount: total, idempotencyKey: crypto.randomUUID(), method: "cash" }]
        : paymentMode === "card"
          ? [{ amount: total, idempotencyKey: crypto.randomUUID(), method: "card", reference: cardReference }]
          : [
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
      sessionId: intent === "now" ? session?.id ?? null : null,
    };
    if (payloadRef.current) payloadRef.current.value = JSON.stringify(payload);
  }

  function resetOrder() {
    setDismissedOrderId(submitState.result?.orderId ?? null);
    setCustomerId(""); setServices([]); setCart([]); setDiscount(0); setSplitCash(0); setSplitCard(0); setCardReference("");
  }

  if (submitState.result && dismissedOrderId !== submitState.result.orderId) {
    const result = submitState.result;
    return (
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-primary/15 bg-white p-6 text-center shadow-luxury sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-3xl text-primary">✓</div>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.14em] text-secondary">{text.orderSuccess}</p>
        <h2 className="mt-2 text-3xl font-semibold text-primary">{result.orderNumber}</h2>
        <p className="mt-2 text-lg text-muted">{result.customerName}</p>
        <dl className="mt-7 grid gap-3 sm:grid-cols-3">
          {[[text.total, result.total], [text.paid, result.paid], [text.outstanding, result.outstanding]].map(([label, value]) => (
            <div className="rounded-card bg-[#f5f7f5] p-4" key={String(label)}><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-2xl font-bold text-primary">{formatCurrency(Number(value), currency, locale)}</dd></div>
          ))}
        </dl>
        {result.dueAt ? <p className="mt-5 text-sm text-muted">{text.dueAt}: <strong className="text-primary">{new Date(result.dueAt).toLocaleString(locale)}</strong></p> : null}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button className="min-h-14 rounded-control bg-primary px-5 font-bold text-white" onClick={resetOrder} type="button">{text.newOrder}</button>
          <Link className="flex min-h-14 items-center justify-center rounded-control border border-primary px-5 font-bold !text-primary" href={`/app/orders/${result.orderId}`} locale={locale}>{text.openOrder}</Link>
        </div>
        {canPrint ? <PrintOrderActions className="mt-3 justify-center" locale={locale} orderId={result.orderId} text={printText} /> : null}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <header className="flex flex-col gap-3 rounded-card border border-border bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary">{organizationName}</p><h2 className="mt-1 text-2xl font-semibold text-primary">{text.title}</h2></div>
        <Link className={`rounded-control px-4 py-2 text-sm font-bold ${session ? "bg-primary-soft !text-primary" : "bg-amber-50 !text-amber-800"}`} href="/app/pos" locale={locale}>{session ? `${text.tillOpen} · ${session.locationName ?? organizationName}` : text.tillRequired} →</Link>
      </header>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[19rem_minmax(0,1fr)_25rem]">
        <aside className="min-w-0 space-y-4 rounded-card border border-border bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-bold text-primary">{text.customer}</h3><button className="min-h-11 rounded-control bg-primary-soft px-3 text-sm font-bold text-primary" onClick={() => setShowNewCustomer((open) => !open)} type="button">+ {text.newCustomer}</button></div>
          {showNewCustomer ? (
            <form action={createCustomer} className="space-y-3 rounded-card border border-primary/15 bg-primary-soft p-3">
              <input className="min-h-12 w-full rounded-control border border-border bg-white px-3" name="displayName" placeholder={text.customerName} required />
              <input className="min-h-12 w-full rounded-control border border-border bg-white px-3" name="phone" placeholder={text.customerPhone} />
              <input className="min-h-12 w-full rounded-control border border-border bg-white px-3" name="email" placeholder={text.customerEmail} type="email" />
              {customerState.error ? <p className="text-sm font-semibold text-red-700">{customerState.error === "validation" ? text.errorValidation : text.errorGeneric}</p> : null}
              <button className="min-h-12 w-full rounded-control bg-primary px-4 font-bold text-white" disabled={isCreatingCustomer}>{isCreatingCustomer ? text.saving : text.saveCustomer}</button>
            </form>
          ) : null}
          <input className="min-h-12 w-full rounded-control border border-border bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setCustomerQuery(event.target.value)} placeholder={text.customerSearch} type="search" value={customerQuery} />
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{text.recentCustomers}</p><div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">{filteredCustomers.map((customer) => <button className={`min-h-14 w-full rounded-control border p-3 text-left transition ${customer.id === customerId ? "border-primary bg-primary-soft" : "border-border bg-white hover:border-primary/40"}`} key={customer.id} onClick={() => selectCustomer(customer.id)} type="button"><span className="block truncate font-bold text-primary">{customer.name}</span><span className="mt-1 block truncate text-xs text-muted">{customer.phone || customer.email || "—"}</span></button>)}</div></div>
          {recentOrders.length ? <div className="border-t border-border pt-4"><p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{text.recentOrders}</p><div className="space-y-2">{recentOrders.map((order) => <Link className="flex items-center justify-between gap-2 rounded-control bg-[#f5f7f5] p-2.5 text-sm !text-primary" href={`/app/orders/${order.id}`} key={order.id} locale={locale}><span className="min-w-0"><strong className="block">{order.orderNumber}</strong><span className="block truncate text-xs text-muted">{order.customerName}</span></span><strong>{formatCurrency(order.total, currency, locale)}</strong></Link>)}</div></div> : null}
        </aside>

        <main className="min-w-0 rounded-card border border-border bg-white p-4 shadow-card sm:p-5">
          {!selectedCustomer ? <div className="flex min-h-[30rem] flex-col items-center justify-center rounded-card border border-dashed border-primary/25 bg-primary-soft/50 p-8 text-center"><span className="text-5xl">👤</span><h3 className="mt-5 text-2xl font-semibold text-primary">{text.selectCustomer}</h3><p className="mt-2 max-w-md text-muted">{text.noCustomer}</p></div> : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row"><input className="min-h-13 flex-1 rounded-control border border-border px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setServiceQuery(event.target.value)} placeholder={text.searchServices} type="search" value={serviceQuery} /></div>
              <div className="flex gap-2 overflow-x-auto pb-1"><button className={`min-h-12 shrink-0 rounded-control px-4 font-bold ${category === "all" ? "bg-primary text-white" : "bg-[#f1f4f2] text-primary"}`} onClick={() => setCategory("all")} type="button">{text.categoryAll}</button>{categories.map((item) => <button className={`min-h-12 shrink-0 rounded-control px-4 font-bold ${category === item ? "bg-primary text-white" : "bg-[#f1f4f2] text-primary"}`} key={item} onClick={() => setCategory(item)} type="button">{item}</button>)}</div>
              {isLoading ? <div className="py-20 text-center font-semibold text-muted">{text.loadingCatalog}</div> : filteredServices.length ? <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{filteredServices.map((service) => <button className="group min-h-32 rounded-card border border-border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" key={service.id} onClick={() => addService(service)} type="button"><span className="block text-lg font-bold text-primary">{service.name}</span><span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-muted">{service.category || text.categoryAll} · {text.unitTypes[service.unitType]}</span><span className="mt-5 flex items-end justify-between gap-2"><strong className="text-2xl text-primary">{service.priceIsFrom ? `${text.priceFrom} ` : ""}{formatCurrency(service.amount, service.currency, locale)}</strong>{service.pricingSource === "segment" ? <span className="rounded-full bg-primary-soft px-2 py-1 text-xs font-bold text-secondary">{service.pricingSegmentName ? text.segmentPrice.replace("{segment}", service.pricingSegmentName) : text.segmentPrice.replace("{segment}", "")}</span> : <span className="text-xs text-muted">{text.basePrice}</span>}</span></button>)}</div> : <p className="py-20 text-center font-semibold text-muted">{text.emptyCatalog}</p>}
            </div>
          )}
        </main>

        <aside className="min-w-0 rounded-card border border-border bg-white p-4 shadow-card xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <div className="flex items-center justify-between"><h3 className="text-xl font-bold text-primary">{text.cart}</h3>{cart.length ? <button className="min-h-11 px-2 text-sm font-bold text-red-700" onClick={() => setCart([])} type="button">{text.clear}</button> : null}</div>
          <div className="mt-4 space-y-3">{cart.length ? cart.map((line) => <div className="rounded-card bg-[#f5f7f5] p-3" key={line.service.id}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-bold text-primary">{line.service.name}</p><p className="text-xs text-muted">{formatCurrency(line.service.amount, line.service.currency, locale)} / {text.unitTypes[line.service.unitType]}</p></div><button aria-label={text.remove} className="min-h-11 min-w-11 rounded-full text-xl text-red-700" onClick={() => setCart((current) => current.filter((item) => item.service.id !== line.service.id))} type="button">×</button></div><div className="mt-3 flex items-center justify-between gap-3"><label className="text-xs font-bold text-muted">{text.quantity}<input className="ml-2 h-11 w-24 rounded-control border border-border bg-white px-2 text-center text-base font-bold" min={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.001} onChange={(event) => updateQuantity(line.service.id, Number(event.target.value))} step={isDiscreteServiceUnit(line.service.unitType) ? 1 : 0.1} type="number" value={line.quantity} /></label><strong className="text-lg text-primary">{formatCurrency(line.quantity * line.service.amount, line.service.currency, locale)}</strong></div></div>) : <p className="rounded-card border border-dashed border-border py-12 text-center text-muted">{text.emptyCart}</p>}</div>
          <form action={submit} className="mt-5 space-y-4 border-t border-border pt-5" onSubmit={prepareSubmission}>
            <input name="payload" ref={payloadRef} type="hidden" />
            <label className="block text-sm font-bold text-primary">{text.discount}<input className="mt-1 min-h-12 w-full rounded-control border border-border px-3 text-lg" disabled={!canDiscount} max={subtotal} min="0" onChange={(event) => setDiscount(Number(event.target.value))} step="0.01" type="number" value={discount} /></label>
            <details className="rounded-control border border-border p-3"><summary className="cursor-pointer font-bold text-primary">{text.notes}</summary><div className="mt-3 space-y-3"><input className="min-h-12 w-full rounded-control border border-border px-3" name="dueAt" type="datetime-local" /><textarea className="min-h-20 w-full rounded-control border border-border p-3" name="customerNotes" placeholder={text.notes} /><textarea className="min-h-20 w-full rounded-control border border-border p-3" name="internalNotes" placeholder={text.notes} /></div></details>
            <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-muted">{text.subtotal}</dt><dd className="font-bold text-primary">{formatCurrency(subtotal, currency, locale)}</dd></div><div className="flex justify-between"><dt className="text-muted">{text.discount}</dt><dd className="font-bold text-primary">− {formatCurrency(safeDiscount, currency, locale)}</dd></div><div className="flex items-end justify-between border-t border-border pt-3"><dt className="text-lg font-bold text-primary">{text.total}</dt><dd className="text-3xl font-black text-primary">{formatCurrency(total, currency, locale)}</dd></div></dl>
            <fieldset className="space-y-3"><legend className="mb-2 text-sm font-bold text-primary">{text.payment}</legend><div className="grid grid-cols-3 gap-2">{[["cash", text.paymentCash], ["card", text.paymentCard], ["split", text.paymentSplit]].map(([mode, label]) => <button className={`min-h-12 rounded-control px-2 text-sm font-bold ${paymentMode === mode ? "bg-primary text-white" : "bg-[#f1f4f2] text-primary"}`} key={mode} onClick={() => setPaymentMode(mode as typeof paymentMode)} type="button">{label}</button>)}</div>{paymentMode === "split" ? <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-muted">{text.splitCash}<input className="mt-1 min-h-12 w-full rounded-control border border-border px-2" min="0" onChange={(event) => setSplitCash(Number(event.target.value))} step="0.01" type="number" value={splitCash} /></label><label className="text-xs font-bold text-muted">{text.splitCard}<input className="mt-1 min-h-12 w-full rounded-control border border-border px-2" min="0" onChange={(event) => setSplitCard(Number(event.target.value))} step="0.01" type="number" value={splitCard} /></label></div> : null}{paymentMode !== "cash" ? <input className="min-h-12 w-full rounded-control border border-border px-3" onChange={(event) => setCardReference(event.target.value)} placeholder={text.cardReference} value={cardReference} /> : null}</fieldset>
            {submitState.error ? <p className="rounded-control bg-red-50 p-3 text-sm font-semibold text-red-700">{submitState.error === "validation" ? text.errorValidation : submitState.error === "till" ? text.errorTill : submitState.error === "discount" ? text.errorDiscount : text.errorGeneric}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><button className="min-h-14 rounded-control border border-primary px-4 font-bold text-primary disabled:opacity-40" disabled={isSubmitting || !customerId || !cart.length || total < 0} name="intent" type="submit" value="later">{isSubmitting ? text.saving : text.payLater}</button><button className="min-h-14 rounded-control bg-primary px-4 font-bold text-white disabled:opacity-40" disabled={isSubmitting || !session || !customerId || !cart.length || total <= 0 || (paymentMode === "split" && roundMoney(splitCash + splitCard) !== total)} name="intent" type="submit" value="now">{isSubmitting ? text.saving : text.payNow}</button></div>
            {!session ? <Link className="flex min-h-12 items-center justify-center rounded-control bg-amber-50 px-3 text-sm font-bold !text-amber-800" href="/app/pos" locale={locale}>{text.openTill} →</Link> : null}
          </form>
        </aside>
      </div>
    </div>
  );
}
