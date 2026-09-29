import { Link } from "@/i18n/navigation";
import type { OrderStorageMode, ReadyWarehousePlacement } from "@/features/warehouse/types";

export type ReadyWarehouseText = {
  title: string;
  position: string;
  choosePosition: string;
  packageCount: string;
  storageMode: string;
  missingStorage: string;
  noFinalPositions: string;
  invalidPosition: string;
  invalidValues: string;
  transitionFailed: string;
  contactManager: string;
  configurePositions: string;
  modes: Record<OrderStorageMode, string>;
};

const storageModes: OrderStorageMode[] = ["folded", "hanging", "mixed", "other"];
const fieldClass = "min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground";

export function ReadyWarehouseFields({
  canConfigure,
  error,
  locale,
  placement,
  text,
}: {
  canConfigure: boolean;
  error?: string;
  locale: string;
  placement: ReadyWarehousePlacement;
  text: ReadyWarehouseText;
}) {
  const existingPosition = placement.positions.some((position) => position.id === placement.assignment?.positionId)
    ? placement.assignment!.positionId
    : "";
  const selectedPosition = placement.positions.find((position) => position.id === placement.suggestedPositionId)?.id
    ?? existingPosition;
  const errorText = error === "missing-storage" ? text.missingStorage
    : error === "no-positions" ? text.noFinalPositions
      : error === "invalid-position" ? text.invalidPosition
        : error === "invalid-values" ? text.invalidValues
          : error === "transition-failed" ? text.transitionFailed : null;

  return (
    <section className="space-y-3 rounded-control border border-primary/20 bg-primary-soft/40 p-4" aria-label={text.title}>
      <h4 className="font-semibold text-primary">{text.title}</h4>
      {errorText ? <p className="rounded-control border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900" role="alert">{errorText}</p> : null}
      {!placement.assignment ? <p className="text-sm text-amber-900">{text.missingStorage}</p>
        : placement.positions.length === 0 ? <p className="text-sm text-amber-900">{text.noFinalPositions}</p>
          : (
            <>
              <label className="block space-y-2 text-sm font-semibold text-primary">
                <span>{text.position}</span>
                <select className={fieldClass} defaultValue={selectedPosition} name="finalPositionId" required>
                  <option disabled value="">{text.choosePosition}</option>
                  {placement.positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.code}{position.name ? ` · ${position.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2 text-sm font-semibold text-primary">
                  <span>{text.packageCount}</span>
                  <input className={fieldClass} defaultValue={placement.assignment.packageCount} min="1" name="finalPackageCount" required step="1" type="number" />
                </label>
                <label className="block space-y-2 text-sm font-semibold text-primary">
                  <span>{text.storageMode}</span>
                  <select className={fieldClass} defaultValue={placement.assignment.storageMode} name="finalStorageMode" required>
                    {storageModes.map((mode) => <option key={mode} value={mode}>{text.modes[mode]}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}
      {placement.assignment && placement.positions.length === 0 ? (
        canConfigure
          ? <Link className="inline-block text-sm font-semibold text-primary underline" href="/app/settings/warehouse" locale={locale}>{text.configurePositions}</Link>
          : <p className="text-sm text-muted">{text.contactManager}</p>
      ) : null}
    </section>
  );
}
