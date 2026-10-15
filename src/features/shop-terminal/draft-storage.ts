import type { ShopDeliveryAddress } from "./types";

export type PersistedDeliveryDraft = ShopDeliveryAddress & {
  assignedTo: string;
  notes: string;
  propertyId: string;
  requested: boolean;
  scheduledAt: string;
};

export function parsePersistedDeliveryDraft(value: unknown): PersistedDeliveryDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  const fields = ["addressLine1", "addressLine2", "assignedTo", "city", "contactName", "contactPhone", "countryCode", "notes", "postalCode", "propertyId", "scheduledAt"] as const;
  if (typeof draft.requested !== "boolean" || fields.some((field) => typeof draft[field] !== "string")
    || Object.keys(draft).some((field) => field !== "requested" && !fields.includes(field as typeof fields[number]))) return null;
  return Object.fromEntries([...fields.map((field) => [field, draft[field]]), ["requested", draft.requested]]) as PersistedDeliveryDraft;
}

export type DraftMapRead<T> = { kind: "loaded"; drafts: Map<string, T> } | { kind: "read_error" } | { kind: "invalid" };

export function readDraftMap<T>(storage: Pick<Storage, "getItem">, key: string, parse: (value: unknown) => T | null): DraftMapRead<T> {
  let raw: string | null;
  try { raw = storage.getItem(key); } catch { return { kind: "read_error" }; }
  if (raw === null) return { kind: "loaded", drafts: new Map() };
  try {
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries)) return { kind: "invalid" };
    const drafts = new Map<string, T>();
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || drafts.has(entry[0])) return { kind: "invalid" };
      const draft = parse(entry[1]);
      if (draft === null) return { kind: "invalid" };
      drafts.set(entry[0], draft);
    }
    return { kind: "loaded", drafts };
  } catch { return { kind: "invalid" }; }
}
