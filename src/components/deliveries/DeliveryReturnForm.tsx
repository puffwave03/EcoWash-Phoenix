import type { WarehousePosition } from "@/features/warehouse/types";

export type DeliveryReturnText = {
  returnDelivery: string;
  returnReason: string;
  returnPosition: string;
  noReturnPositions: string;
  returnError: string;
};

export function DeliveryReturnForm({
  action,
  deliveryId,
  positions,
  text,
}: {
  action: (formData: FormData) => Promise<void>;
  deliveryId: string;
  positions: WarehousePosition[];
  text: DeliveryReturnText;
}) {
  const eligible = positions.filter((position) => position.isActive && !position.isDefaultInbound);
  const suggested = eligible.find((position) => position.isDefaultDeliveryStaging);
  if (!eligible.length) return <p className="text-sm text-muted">{text.noReturnPositions}</p>;

  return (
    <form action={action} className="space-y-3 rounded-control border border-border p-3">
      <input name="recordId" type="hidden" value={deliveryId} />
      <label className="block text-sm font-semibold text-primary" htmlFor={`return-reason-${deliveryId}`}>{text.returnReason}</label>
      <input className="min-h-11 w-full rounded-control border border-border px-3 text-sm" id={`return-reason-${deliveryId}`} maxLength={500} name="reason" required />
      <label className="block text-sm font-semibold text-primary" htmlFor={`return-position-${deliveryId}`}>{text.returnPosition}</label>
      <select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm" defaultValue={suggested?.id ?? ""} id={`return-position-${deliveryId}`} name="positionId" required>
        <option disabled value="">{text.returnPosition}</option>
        {eligible.map((position) => <option key={position.id} value={position.id}>{position.code}{position.name ? ` · ${position.name}` : ""}</option>)}
      </select>
      <button className="min-h-11 w-full rounded-control border border-primary/30 px-4 text-sm font-semibold text-primary" type="submit">{text.returnDelivery}</button>
    </form>
  );
}
