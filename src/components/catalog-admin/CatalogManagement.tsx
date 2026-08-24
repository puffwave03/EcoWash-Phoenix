"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CatalogAdminActionState, CatalogAdminCategory, CatalogAdminService } from "@/features/catalog-admin/types";
import type { ServiceCategoryKey } from "@/features/services/catalog";
import type { ServiceUnitType } from "@/features/services/types";
import { formatCurrency } from "@/lib/number-format";

type CatalogManagementText = {
  all: string;
  bulkAction: string;
  bulkApply: string;
  bulkCategory: string;
  bulkConfirm: string;
  bulkOptions: Record<"category" | "hide" | "notOrderable" | "orderable" | "show", string>;
  bulkSelect: string;
  categories: string;
  categoriesHelp: string;
  category: string;
  categoryFeatured: string;
  categoryHiddenHelp: string;
  categoryImage: string;
  categoryTitle: string;
  customerDescription: string;
  customerOrderable: string;
  displayOrder: string;
  editPresentation: string;
  featured: string;
  filters: {
    allOrderability: string;
    allVisibility: string;
    hidden: string;
    nonOrderable: string;
    orderable: string;
    visible: string;
  };
  focalPosition: string;
  focalPositions: Record<string, string>;
  formError: string;
  fromPrice: string;
  imageHelp: string;
  internalDescription: string;
  migrationRequired: string;
  noResults: string;
  removeImage: string;
  save: string;
  saved: string;
  saving: string;
  search: string;
  searchPlaceholder: string;
  selectAll: string;
  selectedCount: string;
  summary: Record<"featured" | "hidden" | "internal" | "orderable" | "visible", string>;
  unitTypes: Record<ServiceUnitType, string>;
  visible: string;
  categoryLabels: Record<string, string>;
};

type Action = (
  state: CatalogAdminActionState,
  formData: FormData,
) => Promise<CatalogAdminActionState>;

const initialState: CatalogAdminActionState = { fieldErrors: {}, formError: null, success: false };

function SubmitButton({ text }: { text: Pick<CatalogManagementText, "save" | "saving"> }) {
  const { pending } = useFormStatus();
  return (
    <button className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-white transition-standard hover:bg-primary-strong disabled:cursor-wait disabled:opacity-60" disabled={pending} type="submit">
      {pending ? text.saving : text.save}
    </button>
  );
}

function Result({ state, text }: { state: CatalogAdminActionState; text: CatalogManagementText }) {
  if (state.success) return <p className="text-sm font-semibold text-emerald-700" role="status">{text.saved}</p>;
  if (state.formError) return <p className="text-sm text-red-700" role="alert">{state.formError === "migration" ? text.migrationRequired : text.formError}</p>;
  if (Object.keys(state.fieldErrors).length > 0) return <p className="text-sm text-red-700" role="alert">{text.formError}</p>;
  return null;
}

function BooleanControl({ defaultChecked, label, name }: { defaultChecked: boolean; label: string; name: string }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-border bg-white px-3 text-sm font-semibold text-primary">
      <span>{label}</span>
      <input className="h-5 w-5 accent-primary" defaultChecked={defaultChecked} name={name} type="checkbox" value="true" />
    </label>
  );
}

function CategoryEditor({ action, category, text }: { action: Action; category: CatalogAdminCategory; text: CatalogManagementText }) {
  const [state, formAction] = useActionState(action, initialState);
  const label = category.portalTitle || text.categoryLabels[category.categoryKey] || category.categoryKey;

  return (
    <details className="rounded-card border border-border bg-white shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-primary [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          {category.imageUrl ? <img alt="" className="h-10 w-14 rounded-control object-cover" src={category.imageUrl} /> : null}
          <span className="truncate">{label}</span>
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs ${category.portalVisible ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{category.portalVisible ? text.filters.visible : text.filters.hidden}</span>
      </summary>
      <form action={formAction} className="space-y-4 border-t border-border p-4">
        <input name="categoryKey" type="hidden" value={category.categoryKey} />
        <div className="grid gap-3 sm:grid-cols-2">
          <BooleanControl defaultChecked={category.portalVisible} label={text.visible} name="portalVisible" />
          <BooleanControl defaultChecked={category.portalFeatured} label={text.categoryFeatured} name="portalFeatured" />
        </div>
        <p className="text-xs leading-5 text-muted">{text.categoryHiddenHelp}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5 text-sm font-semibold text-primary">
            <span>{text.categoryTitle}</span>
            <input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={category.portalTitle} maxLength={120} name="portalTitle" />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-primary">
            <span>{text.displayOrder}</span>
            <input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={category.portalSortOrder} min={0} name="portalSortOrder" type="number" />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-primary">
            <span>{text.focalPosition}</span>
            <select className="min-h-11 w-full rounded-control border border-border bg-white px-3" defaultValue={category.focalPosition} name="focalPosition">
              {Object.entries(text.focalPositions).map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-1.5 text-sm font-semibold text-primary">
            <span>{text.categoryImage}</span>
            <input accept="image/jpeg,image/png,image/webp" className="block min-h-11 w-full rounded-control border border-border bg-white px-3 py-2 text-sm" name="image" type="file" />
            <span className="block text-xs font-normal text-muted">{text.imageHelp}</span>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted"><input className="h-5 w-5 accent-primary" name="removeImage" type="checkbox" value="true" />{text.removeImage}</label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><Result state={state} text={text} /><SubmitButton text={text} /></div>
      </form>
    </details>
  );
}

function ServiceEditor({ action, categories, service, text }: { action: Action; categories: CatalogAdminCategory[]; service: CatalogAdminService; text: CatalogManagementText }) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <details className="group">
      <summary className="min-h-11 cursor-pointer list-none rounded-control border border-border bg-white px-3 py-2 text-center text-sm font-semibold text-primary hover:bg-primary-soft [&::-webkit-details-marker]:hidden">{text.editPresentation}</summary>
      <form action={formAction} className="mt-3 space-y-4 rounded-card border border-border bg-[#fafcfa] p-4">
        <input name="serviceId" type="hidden" value={service.id} />
        <div className="grid gap-3 sm:grid-cols-3">
          <BooleanControl defaultChecked={service.portalVisible} label={text.visible} name="portalVisible" />
          <BooleanControl defaultChecked={service.customerOrderable} label={text.customerOrderable} name="customerOrderable" />
          <BooleanControl defaultChecked={service.portalFeatured} label={text.featured} name="portalFeatured" />
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(12rem,0.7fr)_minmax(8rem,0.3fr)]">
          <label className="space-y-1.5 text-sm font-semibold text-primary">
            <span>{text.category}</span>
            <select className="min-h-11 w-full rounded-control border border-border bg-white px-3" defaultValue={service.portalCategoryKey ?? ""} name="portalCategoryKey">
              <option disabled value="">—</option>
              {categories.map((category) => <option key={category.categoryKey} value={category.categoryKey}>{category.portalTitle || text.categoryLabels[category.categoryKey] || category.categoryKey}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-primary">
            <span>{text.displayOrder}</span>
            <input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={service.portalSortOrder} min={0} name="portalSortOrder" type="number" />
          </label>
        </div>
        <label className="block space-y-1.5 text-sm font-semibold text-primary">
          <span>{text.customerDescription}</span>
          <textarea className="min-h-24 w-full rounded-control border border-border px-3 py-2 font-normal" defaultValue={service.portalDescription} maxLength={1000} name="portalDescription" />
          {service.internalDescription ? <span className="block text-xs font-normal leading-5 text-muted">{text.internalDescription}: {service.internalDescription}</span> : null}
        </label>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-1.5 text-sm font-semibold text-primary">
            <span>{text.categoryImage}</span>
            <input accept="image/jpeg,image/png,image/webp" className="block min-h-11 w-full rounded-control border border-border bg-white px-3 py-2 text-sm" name="image" type="file" />
            <span className="block text-xs font-normal text-muted">{text.imageHelp}</span>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted"><input className="h-5 w-5 accent-primary" name="removeImage" type="checkbox" value="true" />{text.removeImage}</label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><Result state={state} text={text} /><SubmitButton text={text} /></div>
      </form>
    </details>
  );
}

function effectiveVisibility(service: CatalogAdminService, categories: Map<ServiceCategoryKey, CatalogAdminCategory>) {
  const category = service.portalCategoryKey ? categories.get(service.portalCategoryKey) : null;
  return service.isActive && service.amount !== null && service.portalVisible && Boolean(category?.portalVisible);
}

export function CatalogManagement({
  bulkAction,
  categories,
  categoryAction,
  locale,
  serviceAction,
  services,
  text,
}: {
  bulkAction: Action;
  categories: CatalogAdminCategory[];
  categoryAction: Action;
  locale: string;
  serviceAction: Action;
  services: CatalogAdminService[];
  text: CatalogManagementText;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [orderabilityFilter, setOrderabilityFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkChoice, setBulkChoice] = useState("");
  const [bulkState, bulkFormAction] = useActionState(bulkAction, initialState);
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.categoryKey, category])), [categories]);
  const visible = services.filter((service) => effectiveVisibility(service, categoryMap));
  const orderable = visible.filter((service) => service.customerOrderable);
  const featured = visible.filter((service) => service.portalFeatured || Boolean(service.portalCategoryKey && categoryMap.get(service.portalCategoryKey)?.portalFeatured));
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return services.filter((service) => {
      const isVisible = effectiveVisibility(service, categoryMap);
      const isOrderable = isVisible && service.customerOrderable;
      return (categoryFilter === "all" || service.portalCategoryKey === categoryFilter)
        && (visibilityFilter === "all" || (visibilityFilter === "visible" ? isVisible : !isVisible))
        && (orderabilityFilter === "all" || (orderabilityFilter === "orderable" ? isOrderable : !isOrderable))
        && (!query || [service.name, service.code, service.internalCategory, service.portalCategoryKey].some((value) => value?.toLocaleLowerCase(locale).includes(query)));
    });
  }, [categoryFilter, categoryMap, locale, orderabilityFilter, search, services, visibilityFilter]);
  const groups = categories.map((category) => ({
    category,
    items: filtered.filter((service) => service.portalCategoryKey === category.categoryKey),
  })).filter((group) => group.items.length > 0);
  const unassigned = filtered.filter((service) => !service.portalCategoryKey);

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filtered.map((service) => service.id)) : new Set());
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          [text.summary.internal, services.length],
          [text.summary.visible, visible.length],
          [text.summary.orderable, orderable.length],
          [text.summary.hidden, services.length - visible.length],
          [text.summary.featured, featured.length],
        ].map(([label, value]) => <div className="rounded-card border border-border bg-white p-4 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><p className="mt-2 text-2xl font-semibold text-primary">{value}</p></div>)}
      </section>

      <details className="rounded-card border border-border bg-primary-soft/35 p-4">
        <summary className="cursor-pointer list-none text-lg font-semibold text-primary [&::-webkit-details-marker]:hidden">{text.categories}</summary>
        <p className="mt-2 text-sm leading-6 text-muted">{text.categoriesHelp}</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {categories.map((category) => <CategoryEditor action={categoryAction} category={category} key={category.categoryKey} text={text} />)}
        </div>
      </details>

      <section className="sticky top-[4.5rem] z-20 rounded-card border border-border bg-white/95 p-4 shadow-card backdrop-blur sm:top-[5.5rem]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted"><span>{text.search}</span><input className="min-h-11 w-full rounded-control border border-border px-3 text-sm font-normal normal-case tracking-normal text-foreground" onChange={(event) => setSearch(event.target.value)} placeholder={text.searchPlaceholder} type="search" value={search} /></label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted"><span>{text.category}</span><select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm font-normal normal-case tracking-normal text-foreground" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}><option value="all">{text.all}</option>{categories.map((category) => <option key={category.categoryKey} value={category.categoryKey}>{category.portalTitle || text.categoryLabels[category.categoryKey]}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted"><span>{text.visible}</span><select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm font-normal normal-case tracking-normal text-foreground" onChange={(event) => setVisibilityFilter(event.target.value)} value={visibilityFilter}><option value="all">{text.filters.allVisibility}</option><option value="visible">{text.filters.visible}</option><option value="hidden">{text.filters.hidden}</option></select></label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted"><span>{text.customerOrderable}</span><select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm font-normal normal-case tracking-normal text-foreground" onChange={(event) => setOrderabilityFilter(event.target.value)} value={orderabilityFilter}><option value="all">{text.filters.allOrderability}</option><option value="orderable">{text.filters.orderable}</option><option value="notOrderable">{text.filters.nonOrderable}</option></select></label>
        </div>
      </section>

      <form action={bulkFormAction} className="rounded-card border border-border bg-white p-4 shadow-sm" onSubmit={(event) => {
        if (selected.size >= 10 && !window.confirm(text.bulkConfirm.replace("{count}", String(selected.size)))) event.preventDefault();
      }}>
        <input name="serviceIds" type="hidden" value={JSON.stringify([...selected])} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><input checked={filtered.length > 0 && filtered.every((service) => selected.has(service.id))} className="h-5 w-5 accent-primary" onChange={(event) => toggleAll(event.target.checked)} type="checkbox" />{text.selectAll}</label>
          <p className="min-h-11 py-3 text-sm text-muted">{text.selectedCount.replace("{count}", String(selected.size))}</p>
          <label className="min-w-56 flex-1 space-y-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted"><span>{text.bulkAction}</span><select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm font-normal normal-case tracking-normal text-foreground" name="bulkAction" onChange={(event) => setBulkChoice(event.target.value)} required value={bulkChoice}><option value="">{text.bulkSelect}</option>{Object.entries(text.bulkOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {bulkChoice === "category" ? <label className="min-w-56 flex-1 space-y-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted"><span>{text.bulkCategory}</span><select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm font-normal normal-case tracking-normal text-foreground" name="bulkCategory" required>{categories.map((category) => <option key={category.categoryKey} value={category.categoryKey}>{category.portalTitle || text.categoryLabels[category.categoryKey]}</option>)}</select></label> : <input name="bulkCategory" type="hidden" value="" />}
          <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={selected.size === 0 || !bulkChoice} type="submit">{text.bulkApply}</button>
        </div>
        <div className="mt-2"><Result state={bulkState} text={text} /></div>
      </form>

      {filtered.length === 0 ? <p className="rounded-card border border-dashed border-border bg-white p-6 text-center text-sm text-muted">{text.noResults}</p> : null}
      {[...groups, ...(unassigned.length ? [{ category: null, items: unassigned }] : [])].map((group) => {
        const label = group.category ? group.category.portalTitle || text.categoryLabels[group.category.categoryKey] : "—";
        return (
          <details className="overflow-hidden rounded-card border border-border bg-white shadow-card" key={group.category?.categoryKey ?? "unassigned"} open>
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between bg-primary-soft/45 px-4 py-3 font-semibold text-primary [&::-webkit-details-marker]:hidden"><span>{label}</span><span className="text-sm text-muted">{group.items.length}</span></summary>
            <div className="divide-y divide-border">
              {group.items.map((service) => {
                const isVisible = effectiveVisibility(service, categoryMap);
                return (
                  <article className="grid gap-3 p-4 xl:grid-cols-[auto_minmax(14rem,1.25fr)_minmax(8rem,0.55fr)_minmax(15rem,0.8fr)_minmax(10rem,0.55fr)] xl:items-center" key={service.id}>
                    <input aria-label={`${text.bulkSelect}: ${service.name}`} checked={selected.has(service.id)} className="h-5 w-5 accent-primary" onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(service.id); else next.delete(service.id); return next; })} type="checkbox" />
                    <div className="min-w-0"><p className="font-semibold text-foreground">{service.name}</p><p className="truncate text-xs text-muted">{service.code || service.internalCategory || "—"}</p></div>
                    <p className="text-sm font-semibold text-primary">{service.amount === null ? "—" : `${service.priceIsFrom ? `${text.fromPrice} ` : ""}${formatCurrency(service.amount, service.currency ?? "EUR", locale)}`}<span className="block text-xs font-normal text-muted">{text.unitTypes[service.unitType]}</span></p>
                    <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isVisible ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{isVisible ? text.filters.visible : text.filters.hidden}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isVisible && service.customerOrderable ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>{isVisible && service.customerOrderable ? text.filters.orderable : text.filters.nonOrderable}</span>{service.portalFeatured ? <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-800">{text.featured}</span> : null}</div>
                    <ServiceEditor action={serviceAction} categories={categories} service={service} text={text} />
                  </article>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
