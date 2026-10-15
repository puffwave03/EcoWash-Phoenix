import type { ShopCustomer } from "./types";

export const SALES_WORKSPACES = [1, 2, 3, 4, 5] as const;
export type SalesWorkspace = (typeof SALES_WORKSPACES)[number];

const prefix = "ecowash:shop-terminal-workspaces:v1";

export function workspaceNamespace(organizationId: string, locationId: string | null) {
  return `${prefix}:${organizationId}:${locationId ?? "no-location"}`;
}

export function workspaceDraftKey(namespace: string, workspace: SalesWorkspace) {
  return `${namespace}:${workspace}:drafts`;
}

export function workspaceSubmissionKey(namespace: string, workspace: SalesWorkspace) {
  return `${namespace}:${workspace}:submission`;
}

export function workspaceCustomerKey(namespace: string, workspace: SalesWorkspace) {
  return `${namespace}:${workspace}:customer`;
}

export function workspaceWalkInKey(namespace: string, workspace: SalesWorkspace) {
  return `${namespace}:${workspace}:walk-in`;
}

export function workspaceSelectionKey(namespace: string) {
  return `${namespace}:selected`;
}

export function legacyDraftKey(organizationId: string, locationId: string | null) {
  return `ecowash:shop-terminal-drafts:v1:${organizationId}:${locationId ?? "no-location"}`;
}

export function parseWorkspace(value: string | null): SalesWorkspace | null {
  const number = Number(value);
  return SALES_WORKSPACES.find((workspace) => workspace === number) ?? null;
}

export function workspaceOccupied(storage: Pick<Storage, "getItem">, namespace: string, workspace: SalesWorkspace) {
  return storage.getItem(workspaceCustomerKey(namespace, workspace)) !== null
    || storage.getItem(workspaceWalkInKey(namespace, workspace)) !== null
    || storage.getItem(workspaceDraftKey(namespace, workspace)) !== null
    || storage.getItem(workspaceSubmissionKey(namespace, workspace)) !== null;
}
export function parseStoredWorkspaceCustomer(raw: string): ShopCustomer | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const customer = value as Record<string, unknown>;
    const fields = new Set(["id", "name", "isWalkIn", "phone", "email", "updatedAt"]);
    if (Object.keys(customer).some((field) => !fields.has(field))
      || typeof customer.id !== "string" || typeof customer.name !== "string"
      || typeof customer.isWalkIn !== "boolean" || typeof customer.updatedAt !== "string"
      || (customer.phone !== null && typeof customer.phone !== "string")
      || (customer.email !== null && typeof customer.email !== "string")) return null;
    return customer as ShopCustomer;
  } catch { return null; }
}

export function inspectWorkspaceDiscard(
  storage: Pick<Storage, "getItem">,
  namespace: string,
  workspace: SalesWorkspace,
  validDraft: (raw: string) => boolean,
): { kind: "ready"; keys: string[] } | { kind: "submission" | "unreadable" } {
  const draftKey = workspaceDraftKey(namespace, workspace);
  const customerKey = workspaceCustomerKey(namespace, workspace);
  const walkInKey = workspaceWalkInKey(namespace, workspace);
  const selectionKey = workspaceSelectionKey(namespace);
  let draft: string | null;
  let customer: string | null;
  let walkIn: string | null;
  let selection: string | null;
  let submission: string | null;
  try {
    draft = storage.getItem(draftKey);
    customer = storage.getItem(customerKey);
    walkIn = storage.getItem(walkInKey);
    selection = storage.getItem(selectionKey);
    submission = storage.getItem(workspaceSubmissionKey(namespace, workspace));
  } catch { return { kind: "unreadable" }; }
  if (submission !== null) return { kind: "submission" };
  const parsedWalkIn = walkIn === null ? null : parseStoredWorkspaceCustomer(walkIn);
  if ((draft !== null && !validDraft(draft))
    || (customer !== null && !parseStoredWorkspaceCustomer(customer))
    || (walkIn !== null && (!parsedWalkIn || !parsedWalkIn.isWalkIn))
    || (selection !== null && parseWorkspace(selection) !== workspace)) return { kind: "unreadable" };
  return { kind: "ready", keys: [draftKey, customerKey, walkInKey, selectionKey] };
}
