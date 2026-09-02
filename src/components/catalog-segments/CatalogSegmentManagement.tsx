"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CatalogAdminCategory, CatalogAdminService } from "@/features/catalog-admin/types";
import type {
  CatalogSegment,
  CatalogSegmentActionState,
  CatalogSegmentCustomer,
  CatalogSegmentStarter,
} from "@/features/catalog-segments/types";

type SegmentAction = (
  state: CatalogSegmentActionState,
  formData: FormData,
) => Promise<CatalogSegmentActionState>;

export type CatalogSegmentManagementText = {
  active: string;
  activeSegments: string;
  allCategories: string;
  assignedCustomers: string;
  categories: string;
  categorySearch: string;
  categoryHelp: string;
  clearAll: string;
  clearAllVisible: string;
  collapse: string;
  create: string;
  createDescription: string;
  createTitle: string;
  customerHelp: string;
  customers: string;
  description: string;
  displayOrder: string;
  duplicate: string;
  expand: string;
  featured: string;
  formError: string;
  hidden: string;
  inactive: string;
  inactiveSegments: string;
  linkedServices: string;
  migrationRequired: string;
  name: string;
  noCustomers: string;
  noSegments: string;
  portalVisible: string;
  portalVisibility: string;
  quickNavigation: string;
  save: string;
  saved: string;
  saving: string;
  serviceHelp: string;
  serviceSearch: string;
  services: string;
  selectAll: string;
  selectAllVisible: string;
  starter: string;
  starterHelp: string;
  starters: Record<CatalogSegmentStarter, string>;
  unavailable: string;
  visible: string;
};

const initialState: CatalogSegmentActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60" disabled={pending} type="submit">
      {pending ? pendingLabel : label}
    </button>
  );
}

function Result({ state, text }: { state: CatalogSegmentActionState; text: CatalogSegmentManagementText }) {
  if (state.success) return <p className="text-sm font-semibold text-emerald-700" role="status">{text.saved}</p>;
  if (state.formError) {
    const message = state.formError === "migration"
      ? text.migrationRequired
      : state.formError === "duplicate"
        ? text.duplicate
        : text.formError;
    return <p className="text-sm text-red-700" role="alert">{message}</p>;
  }
  if (Object.keys(state.fieldErrors).length > 0) return <p className="text-sm text-red-700" role="alert">{text.formError}</p>;
  return null;
}

function Toggle({ defaultChecked, label, name }: { defaultChecked: boolean; label: string; name: string }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-border bg-white px-3 text-sm font-semibold text-primary">
      <span>{label}</span>
      <input className="h-5 w-5 accent-primary" defaultChecked={defaultChecked} name={name} type="checkbox" value="true" />
    </label>
  );
}

function categoryLabel(category: CatalogAdminCategory) {
  return category.portalTitle || category.categoryKey.replaceAll("_", " ");
}

function serviceAvailable(service: CatalogAdminService, categories: CatalogAdminCategory[]) {
  const category = categories.find((item) => item.categoryKey === service.portalCategoryKey);
  return service.isActive
    && service.amount !== null
    && service.portalVisible
    && service.customerOrderable
    && Boolean(category?.portalVisible);
}

function SegmentEditor({
  action,
  categories,
  customers,
  segment,
  services,
  text,
  expanded,
  onToggle,
}: {
  action: SegmentAction;
  categories: CatalogAdminCategory[];
  customers: CatalogSegmentCustomer[];
  segment: CatalogSegment;
  services: CatalogAdminService[];
  text: CatalogSegmentManagementText;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const serviceLinks = new Map(segment.serviceLinks.map((link) => [link.serviceId, link]));
  const categoryLinks = new Map(segment.categoryLinks.map((link) => [link.categoryKey, link]));
  const selectedCustomers = new Set(segment.customerIds);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState(() => new Set(segment.categoryLinks.map((link) => link.categoryKey)));
  const [selectedServiceIds, setSelectedServiceIds] = useState(() => new Set(segment.serviceLinks.map((link) => link.serviceId)));
  const visibleCategoryKeys = useMemo(() => new Set(categories
    .filter((category) => categoryLabel(category).toLocaleLowerCase().includes(categoryQuery.trim().toLocaleLowerCase()))
    .map((category) => category.categoryKey)), [categories, categoryQuery]);
  const visibleServiceIds = useMemo(() => {
    const query = serviceQuery.trim().toLocaleLowerCase();
    return new Set(services.filter((service) => {
      const categoryKey = service.portalCategoryKey ?? service.internalCategory ?? "";
      return (!serviceCategory || categoryKey === serviceCategory)
        && (!query || `${service.name} ${service.code ?? ""}`.toLocaleLowerCase().includes(query));
    }).map((service) => service.id));
  }, [serviceCategory, serviceQuery, services]);
  const editorId = `segment-editor-${segment.id}`;

  return (
    <article className="scroll-mt-24 overflow-clip rounded-card border border-border bg-white shadow-card" id={`segment-${segment.id}`}>
      <button
        aria-controls={editorId}
        aria-expanded={expanded}
        className="flex min-h-16 w-full items-center justify-between gap-3 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        onClick={onToggle}
        type="button"
      >
        <span>
          <span className="block text-lg font-semibold text-foreground">{segment.name}</span>
          <span className="mt-1 block text-sm text-muted">{segment.categoryLinks.length} {text.categories.toLocaleLowerCase()} · {segment.serviceLinks.length} {text.linkedServices}</span>
        </span>
        <span className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
          <span className={`rounded-full px-2.5 py-1 ${segment.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{segment.isActive ? text.active : text.inactive}</span>
          <span className={`rounded-full px-2.5 py-1 ${segment.portalVisible ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{segment.portalVisible ? text.portalVisible : text.hidden}</span>
          <span aria-hidden="true" className="text-base text-primary">{expanded ? "−" : "+"}</span>
          <span className="sr-only">{expanded ? text.collapse : text.expand}</span>
        </span>
      </button>
      {expanded ? <form action={formAction} className="space-y-4 border-t border-border bg-[#fafcfa] p-4 sm:p-5" id={editorId}>
        <input name="segmentId" type="hidden" value={segment.id} />

        <details className="rounded-card border border-border bg-white p-4" open>
          <summary className="cursor-pointer font-semibold text-primary">{text.name} / {text.description}</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{text.name}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={segment.name} maxLength={120} name="name" required /></label>
            <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{text.displayOrder}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={segment.displayOrder} min={0} name="displayOrder" type="number" /></label>
          </div>
          <label className="mt-4 block space-y-1.5 text-sm font-semibold text-primary"><span>{text.description}</span><textarea className="min-h-20 w-full rounded-control border border-border px-3 py-2 font-normal" defaultValue={segment.description} maxLength={1000} name="description" /></label>
        </details>

        <details className="rounded-card border border-border bg-white p-4">
          <summary className="cursor-pointer list-none font-semibold text-primary [&::-webkit-details-marker]:hidden">{text.categories} · {segment.categoryLinks.length}</summary>
          <p className="mt-2 text-sm leading-6 text-muted">{text.categoryHelp}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="min-w-0 flex-1 space-y-1.5 text-sm font-semibold text-primary"><span>{text.categorySearch}</span><input className="min-h-11 w-full rounded-control border border-border px-3" onChange={(event) => setCategoryQuery(event.target.value)} type="search" value={categoryQuery} /></label>
            <span className="flex flex-wrap gap-2">
              <button className="min-h-11 rounded-control border border-border px-3 text-sm font-semibold text-primary" onClick={() => setSelectedCategoryKeys(new Set(categories.map((category) => category.categoryKey)))} type="button">{text.selectAll}</button>
              <button className="min-h-11 rounded-control border border-border px-3 text-sm font-semibold text-primary" onClick={() => setSelectedCategoryKeys(new Set())} type="button">{text.clearAll}</button>
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {categories.map((category) => {
              const link = categoryLinks.get(category.categoryKey);
              return (
                <div className="grid grid-cols-[auto_minmax(0,1fr)_5rem] items-center gap-3 rounded-control border border-border p-3" hidden={!visibleCategoryKeys.has(category.categoryKey)} key={category.categoryKey}>
                  <input checked={selectedCategoryKeys.has(category.categoryKey)} className="h-5 w-5 accent-primary" name="categoryKeys" onChange={(event) => setSelectedCategoryKeys((current) => { const next = new Set(current); if (event.target.checked) next.add(category.categoryKey); else next.delete(category.categoryKey); return next; })} type="checkbox" value={category.categoryKey} />
                  <span className="truncate text-sm font-semibold text-foreground">{categoryLabel(category)}</span>
                  <input aria-label={`${text.displayOrder}: ${categoryLabel(category)}`} className="min-h-10 w-full rounded-control border border-border px-2 text-sm" defaultValue={link?.displayOrder ?? category.portalSortOrder} min={0} name={`categoryOrder_${category.categoryKey}`} type="number" />
                </div>
              );
            })}
          </div>
        </details>

        <details className="rounded-card border border-border bg-white p-4">
          <summary className="cursor-pointer list-none font-semibold text-primary [&::-webkit-details-marker]:hidden">{text.services} · {segment.serviceLinks.length}</summary>
          <p className="mt-2 text-sm leading-6 text-muted">{text.serviceHelp}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.55fr)]">
            <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{text.serviceSearch}</span><input className="min-h-11 w-full rounded-control border border-border px-3" onChange={(event) => setServiceQuery(event.target.value)} type="search" value={serviceQuery} /></label>
            <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{text.categories}</span><select className="min-h-11 w-full rounded-control border border-border bg-white px-3" onChange={(event) => setServiceCategory(event.target.value)} value={serviceCategory}><option value="">{text.allCategories}</option>{categories.map((category) => <option key={category.categoryKey} value={category.categoryKey}>{categoryLabel(category)}</option>)}</select></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="min-h-11 rounded-control border border-border px-3 text-sm font-semibold text-primary" onClick={() => setSelectedServiceIds((current) => new Set([...current, ...visibleServiceIds]))} type="button">{text.selectAllVisible}</button>
            <button className="min-h-11 rounded-control border border-border px-3 text-sm font-semibold text-primary" onClick={() => setSelectedServiceIds((current) => { const next = new Set(current); visibleServiceIds.forEach((id) => next.delete(id)); return next; })} type="button">{text.clearAllVisible}</button>
          </div>
          <div className="mt-4 space-y-2">
            {services.map((service) => {
              const link = serviceLinks.get(service.id);
              const available = serviceAvailable(service, categories);
              return (
                <div className="grid gap-2 rounded-control border border-border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_5rem] sm:items-center" hidden={!visibleServiceIds.has(service.id)} key={service.id}>
                  <input checked={selectedServiceIds.has(service.id)} className="h-5 w-5 accent-primary" name="serviceIds" onChange={(event) => setSelectedServiceIds((current) => { const next = new Set(current); if (event.target.checked) next.add(service.id); else next.delete(service.id); return next; })} type="checkbox" value={service.id} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{service.name}</span>
                    <span className={`text-xs ${available ? "text-emerald-700" : "text-amber-700"}`}>{available ? text.visible : text.unavailable}</span>
                  </span>
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted"><input className="h-4 w-4 accent-primary" defaultChecked={link?.featured ?? false} name="featuredServiceIds" type="checkbox" value={service.id} />{text.featured}</label>
                  <input aria-label={`${text.displayOrder}: ${service.name}`} className="min-h-10 w-full rounded-control border border-border px-2 text-sm" defaultValue={link?.displayOrder ?? service.portalSortOrder} min={0} name={`serviceOrder_${service.id}`} type="number" />
                </div>
              );
            })}
          </div>
        </details>

        <details className="rounded-card border border-border bg-white p-4">
          <summary className="cursor-pointer font-semibold text-primary">{text.portalVisibility}</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Toggle defaultChecked={segment.isActive} label={text.active} name="isActive" />
            <Toggle defaultChecked={segment.portalVisible} label={text.portalVisible} name="portalVisible" />
          </div>
        </details>

        <details className="rounded-card border border-border bg-white p-4">
          <summary className="cursor-pointer list-none font-semibold text-primary [&::-webkit-details-marker]:hidden">{text.customers} · {segment.customerIds.length}</summary>
          <p className="mt-2 text-sm leading-6 text-muted">{text.customerHelp}</p>
          {customers.length > 0 ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {customers.map((customer) => (
                <label className="flex min-h-11 items-center gap-3 rounded-control border border-border px-3 text-sm" key={customer.id}>
                  <input className="h-5 w-5 accent-primary" defaultChecked={selectedCustomers.has(customer.id)} name="customerIds" type="checkbox" value={customer.id} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{customer.displayName}</span>
                  {!customer.isActive ? <span className="text-xs text-muted">{text.inactive}</span> : null}
                </label>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-muted">{text.noCustomers}</p>}
        </details>

        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-control border border-primary/15 bg-white/95 p-3 shadow-luxury backdrop-blur lg:bottom-3">
          <Result state={state} text={text} />
          <SubmitButton label={text.save} pendingLabel={text.saving} />
        </div>
      </form> : null}
    </article>
  );
}

export function CatalogSegmentManagement({
  action,
  categories,
  customers,
  segments,
  services,
  text,
}: {
  action: SegmentAction;
  categories: CatalogAdminCategory[];
  customers: CatalogSegmentCustomer[];
  segments: CatalogSegment[];
  services: CatalogAdminService[];
  text: CatalogSegmentManagementText;
}) {
  const [createState, createAction] = useActionState(action, initialState);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedSegmentId, setExpandedSegmentId] = useState<string | null>(null);
  const activeSegments = segments.filter((segment) => segment.isActive);
  const inactiveSegments = segments.filter((segment) => !segment.isActive);

  return (
    <div className="space-y-6">
      <nav aria-label={text.quickNavigation} className="sticky top-3 z-10 flex flex-wrap gap-2 rounded-card border border-border bg-white/95 p-3 shadow-card backdrop-blur">
        <button className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-white" onClick={() => setCreateOpen(true)} type="button">{text.createTitle}</button>
        <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold text-primary" href="#active-segments">{text.activeSegments} · {activeSegments.length}</a>
        <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold text-primary" href="#inactive-segments">{text.inactiveSegments} · {inactiveSegments.length}</a>
      </nav>

      <details className="scroll-mt-24 rounded-card border border-primary/15 bg-primary-soft/45 shadow-card" id="create-segment" onToggle={(event) => setCreateOpen(event.currentTarget.open)} open={createOpen}>
        <summary className="min-h-14 cursor-pointer px-5 py-4 text-lg font-semibold text-foreground">{text.createTitle}</summary>
        <form action={createAction} className="space-y-5 border-t border-primary/10 p-5">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{text.createTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{text.createDescription}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
          <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{text.name}</span><input className="min-h-11 w-full rounded-control border border-border px-3" maxLength={120} name="name" required /></label>
          <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{text.displayOrder}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={segments.length * 10} min={0} name="displayOrder" type="number" /></label>
        </div>
        <label className="block space-y-1.5 text-sm font-semibold text-primary"><span>{text.description}</span><textarea className="min-h-20 w-full rounded-control border border-border px-3 py-2 font-normal" maxLength={1000} name="description" /></label>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="space-y-1.5 text-sm font-semibold text-primary">
            <span>{text.starter}</span>
            <select className="min-h-11 w-full rounded-control border border-border bg-white px-3" defaultValue="none" name="starter">
              {Object.entries(text.starters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <span className="block text-xs font-normal leading-5 text-muted">{text.starterHelp}</span>
          </label>
          <Toggle defaultChecked label={text.active} name="isActive" />
          <Toggle defaultChecked label={text.portalVisible} name="portalVisible" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><Result state={createState} text={text} /><SubmitButton label={text.create} pendingLabel={text.saving} /></div>
        </form>
      </details>

      {segments.length === 0 ? <p className="rounded-card border border-dashed border-border bg-white p-6 text-center text-sm text-muted">{text.noSegments}</p> : null}
      <section className="scroll-mt-24 space-y-3" id="active-segments"><h2 className="text-lg font-semibold text-foreground">{text.activeSegments}</h2>{activeSegments.map((segment) => <SegmentEditor action={action} categories={categories} customers={customers} expanded={expandedSegmentId === segment.id} key={segment.id} onToggle={() => setExpandedSegmentId((current) => current === segment.id ? null : segment.id)} segment={segment} services={services} text={text} />)}</section>
      <section className="scroll-mt-24 space-y-3" id="inactive-segments"><h2 className="text-lg font-semibold text-foreground">{text.inactiveSegments}</h2>{inactiveSegments.map((segment) => <SegmentEditor action={action} categories={categories} customers={customers} expanded={expandedSegmentId === segment.id} key={segment.id} onToggle={() => setExpandedSegmentId((current) => current === segment.id ? null : segment.id)} segment={segment} services={services} text={text} />)}</section>
    </div>
  );
}
