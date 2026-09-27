import type { OrderStorageMode, WarehouseMovement } from "@/features/warehouse/types";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

export type WarehouseMovementText = {
  title: string;
  empty: string;
  entered: string;
  moved: string;
  to: string;
  updated: string;
  exited: string;
  operator: string;
  packages: string;
  storageMode: string;
  note: string;
  sources: Record<WarehouseMovement["source"], string>;
  modes: Record<OrderStorageMode, string>;
};

export function WarehouseMovementHistory({
  history,
  locale,
  text,
  timeZone,
}: {
  history: WarehouseMovement[];
  locale: string;
  text: WarehouseMovementText;
  timeZone: string;
}) {
  return (
    <div className="rounded-card border border-border bg-white p-4 sm:p-5">
      <h4 className="font-semibold text-primary">{text.title}</h4>
      {history.length === 0 ? <p className="mt-2 text-sm text-muted">{text.empty}</p> : (
        <ol className="mt-4 space-y-4 border-l-2 border-primary-soft pl-4">
          {history.map((movement) => {
            const description = movement.movementType === "entered"
              ? `${text.entered} ${movement.toPositionLabel ?? "—"}`
              : movement.movementType === "moved"
                ? `${text.moved} ${movement.fromPositionLabel ?? "—"} ${text.to} ${movement.toPositionLabel ?? "—"}`
                : movement.movementType === "updated"
                  ? `${text.updated} · ${movement.toPositionLabel ?? "—"}`
                  : `${text.exited} · ${text.sources[movement.source]}`;
            const packagesChanged = movement.fromPackageCount !== null
              && movement.toPackageCount !== null
              && movement.fromPackageCount !== movement.toPackageCount;
            const modeChanged = movement.fromStorageMode !== null
              && movement.toStorageMode !== null
              && movement.fromStorageMode !== movement.toStorageMode;
            return (
              <li className="space-y-1 text-sm" key={movement.id}>
                <time className="font-semibold text-muted" dateTime={movement.occurredAt}>
                  {formatOrganizationDateTime(movement.occurredAt, locale, timeZone)}
                </time>
                <p className="font-semibold text-foreground">{description}</p>
                {movement.movementType !== "exited" ? <p className="text-muted">{text.sources[movement.source]}</p> : null}
                {packagesChanged ? <p className="text-muted">{text.packages}: {movement.fromPackageCount} → {movement.toPackageCount}</p> : null}
                {modeChanged ? <p className="text-muted">{text.storageMode}: {text.modes[movement.fromStorageMode!]} → {text.modes[movement.toStorageMode!]}</p> : null}
                {movement.actorName ? <p className="text-muted">{text.operator}: {movement.actorName}</p> : null}
                {movement.note ? <p className="text-muted">{text.note}: {movement.note}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
