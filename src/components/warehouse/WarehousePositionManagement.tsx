"use client";

import { useActionState, useMemo, useState } from "react";
import type {
  WarehouseLocation,
  WarehousePosition,
  WarehousePositionActionState,
  WarehousePositionType,
} from "@/features/warehouse/types";

type WarehouseAction = (
  state: WarehousePositionActionState,
  formData: FormData,
) => Promise<WarehousePositionActionState>;

export type WarehousePositionText = {
  activate: string;
  active: string;
  allLocations: string;
  code: string;
  configured: string;
  createTitle: string;
  deactivate: string;
  description: string;
  duplicateError: string;
  edit: string;
  editTitle: string;
  filterLocation: string;
  genericError: string;
  inactive: string;
  location: string;
  locationError: string;
  name: string;
  newPosition: string;
  noLocations: string;
  noPositions: string;
  notFoundError: string;
  positionType: string;
  save: string;
  saved: string;
  saving: string;
  statusUpdated: string;
  types: Record<WarehousePositionType, string>;
  validationError: string;
};

const initialState: WarehousePositionActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};
const positionTypes: WarehousePositionType[] = ["shelf", "rack", "hanger", "cabinet", "other"];

function fieldClass() {
  return "mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
}

function errorMessage(state: WarehousePositionActionState, text: WarehousePositionText) {
  if (Object.keys(state.fieldErrors).length) return text.validationError;
  if (state.formError === "duplicate") return text.duplicateError;
  if (state.formError === "location") return text.locationError;
  if (state.formError === "notFound") return text.notFoundError;
  if (state.formError) return text.genericError;
  return null;
}

function PositionCard({
  action,
  locationName,
  onEdit,
  position,
  text,
}: {
  action: WarehouseAction;
  locationName: string;
  onEdit: () => void;
  position: WarehousePosition;
  text: WarehousePositionText;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const error = errorMessage(state, text);

  return (
    <article className="rounded-card border border-border bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">{text.types[position.positionType]}</p>
          <h2 className="mt-1 break-words text-lg font-semibold text-primary">{position.code}</h2>
          <p className="mt-1 text-sm text-muted">{locationName}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${position.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          {position.isActive ? text.active : text.inactive}
        </span>
      </div>
      {position.name ? <p className="mt-3 font-semibold text-foreground">{position.name}</p> : null}
      {position.description ? <p className="mt-1 text-sm leading-6 text-muted">{position.description}</p> : null}
      {state.success ? <p className="mt-3 text-sm font-semibold text-emerald-700" role="status">{text.statusUpdated}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button className="min-h-11 rounded-control border border-border px-4 text-sm font-semibold text-primary" onClick={onEdit} type="button">{text.edit}</button>
        <form action={formAction}>
          <input name="positionId" type="hidden" value={position.id} />
          <input name="isActive" type="hidden" value={position.isActive ? "false" : "true"} />
          <button className="min-h-11 w-full rounded-control border border-border px-4 text-sm font-semibold text-primary disabled:opacity-60" disabled={pending} type="submit">
            {position.isActive ? text.deactivate : text.activate}
          </button>
        </form>
      </div>
    </article>
  );
}

function PositionForm({
  action,
  editing,
  locations,
  onNew,
  text,
}: {
  action: WarehouseAction;
  editing: WarehousePosition | null;
  locations: WarehouseLocation[];
  onNew: () => void;
  text: WarehousePositionText;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const activeLocations = locations.filter((location) => location.isActive);
  const location = locations.find((item) => item.id === editing?.locationId);
  const error = errorMessage(state, text);

  return (
    <form action={formAction} className="space-y-4 rounded-card border-t-4 border-primary bg-white p-5 shadow-card" key={editing?.id ?? "new"}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-primary">{editing ? text.editTitle : text.createTitle}</h2>
        {editing ? <button className="min-h-10 text-sm font-semibold text-muted" onClick={onNew} type="button">{text.newPosition}</button> : null}
      </div>
      <input name="positionId" type="hidden" value={editing?.id ?? ""} />

      {state.success ? <p className="rounded-control bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{text.saved}</p> : null}
      {error ? <p className="rounded-control bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
      {!editing && !activeLocations.length ? <p className="rounded-control bg-amber-50 p-3 text-sm text-amber-900">{text.noLocations}</p> : null}

      <label className="block text-xs font-semibold text-muted">
        {text.location}
        {editing ? (
          <>
            <input name="locationId" type="hidden" value={editing.locationId} />
            <span className="mt-1 flex min-h-11 items-center rounded-control border border-border bg-slate-50 px-3 text-sm text-foreground">{location?.name ?? "—"}</span>
          </>
        ) : (
          <select className={fieldClass()} defaultValue={activeLocations[0]?.id ?? ""} name="locationId" required>
            {activeLocations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        )}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-muted">{text.code}<input className={fieldClass()} defaultValue={editing?.code ?? ""} maxLength={64} name="code" required /></label>
        <label className="block text-xs font-semibold text-muted">
          {text.positionType}
          <select className={fieldClass()} defaultValue={editing?.positionType ?? "shelf"} name="positionType">
            {positionTypes.map((type) => <option key={type} value={type}>{text.types[type]}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs font-semibold text-muted">{text.name}<input className={fieldClass()} defaultValue={editing?.name ?? ""} maxLength={160} name="name" /></label>
      <label className="block text-xs font-semibold text-muted">{text.description}<textarea className={`${fieldClass()} min-h-24 py-2`} defaultValue={editing?.description ?? ""} maxLength={500} name="description" /></label>
      <button className="min-h-12 w-full rounded-control bg-primary px-5 font-semibold text-white disabled:opacity-40" disabled={pending || (!editing && !activeLocations.length)} type="submit">{pending ? text.saving : text.save}</button>
    </form>
  );
}

export function WarehousePositionManagement({
  activeAction,
  locations,
  positions,
  saveAction,
  text,
}: {
  activeAction: WarehouseAction;
  locations: WarehouseLocation[];
  positions: WarehousePosition[];
  saveAction: WarehouseAction;
  text: WarehousePositionText;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("all");
  const editing = positions.find((position) => position.id === editingId) ?? null;
  const locationNames = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);
  const visiblePositions = locationFilter === "all"
    ? positions
    : positions.filter((position) => position.locationId === locationFilter);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-primary">{text.configured}</h2>
          {locations.length > 1 ? (
            <label className="text-xs font-semibold text-muted">
              {text.filterLocation}
              <select className="mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm sm:min-w-56" onChange={(event) => setLocationFilter(event.target.value)} value={locationFilter}>
                <option value="all">{text.allLocations}</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        {visiblePositions.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {visiblePositions.map((position) => (
              <PositionCard
                action={activeAction}
                key={position.id}
                locationName={locationNames.get(position.locationId) ?? "—"}
                onEdit={() => setEditingId(position.id)}
                position={position}
                text={text}
              />
            ))}
          </div>
        ) : <p className="rounded-card border-2 border-dashed border-border bg-white p-8 text-center text-sm text-muted">{text.noPositions}</p>}
      </section>
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <PositionForm action={saveAction} editing={editing} key={editing?.id ?? "new"} locations={locations} onNew={() => setEditingId(null)} text={text} />
      </aside>
    </div>
  );
}
