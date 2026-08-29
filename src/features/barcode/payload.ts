const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_UNIT_INDEX = 999_999;

export type PhoenixCode =
  | { kind: "order"; orderId: string }
  | { itemId: string; kind: "label"; orderId: string; unitIndex: number };

function normalizedUuid(value: string) {
  if (!UUID_PATTERN.test(value)) throw new Error("Invalid Phoenix reference UUID");
  return value.toLowerCase();
}

export function createOrderCode(orderId: string) {
  return `PHX1:O:${normalizedUuid(orderId)}`;
}

export function createLabelCode(orderId: string, itemId: string, unitIndex: number) {
  if (!Number.isSafeInteger(unitIndex) || unitIndex < 0 || unitIndex > MAX_UNIT_INDEX) {
    throw new Error("Invalid Phoenix label unit index");
  }
  return `PHX1:L:${normalizedUuid(orderId)}:${normalizedUuid(itemId)}:${unitIndex}`;
}

export function parsePhoenixCode(raw: string): PhoenixCode | null {
  const value = raw.trim();
  const parts = value.split(":");
  try {
    if (parts.length === 3 && parts[0] === "PHX1" && parts[1] === "O") {
      return { kind: "order", orderId: normalizedUuid(parts[2]) };
    }
    if (parts.length === 5 && parts[0] === "PHX1" && parts[1] === "L" && /^\d+$/.test(parts[4])) {
      const unitIndex = Number(parts[4]);
      if (!Number.isSafeInteger(unitIndex) || unitIndex > MAX_UNIT_INDEX) return null;
      return {
        itemId: normalizedUuid(parts[3]),
        kind: "label",
        orderId: normalizedUuid(parts[2]),
        unitIndex,
      };
    }
  } catch {
    return null;
  }
  return null;
}
