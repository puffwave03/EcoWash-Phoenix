import { isDiscreteServiceUnit } from "@/features/services/types";
import type { PrintLabel, PrintOrderContext } from "@/features/printing/types";
import { createLabelCode } from "@/features/barcode/payload";

export function buildPrintLabels(context: PrintOrderContext): PrintLabel[] {
  const pending = context.items.flatMap((item) => {
    const copies = isDiscreteServiceUnit(item.unitType) ? Math.max(1, Math.trunc(item.quantity)) : 1;
    return Array.from({ length: copies }, (_, copyIndex) => ({
      itemId: item.id,
      serviceName: item.description,
      unitIndex: isDiscreteServiceUnit(item.unitType) ? copyIndex + 1 : 0,
      unitLabel: copies > 1 ? `${copyIndex + 1}/${copies}` : null,
    }));
  });

  return pending.map((label, index) => ({
    ...label,
    codePayload: createLabelCode(context.order.id, label.itemId, label.unitIndex),
    customerName: context.order.customerName,
    dueAt: context.order.dueAt,
    index: index + 1,
    locationName: context.locationName,
    orderNumber: context.order.orderNumber,
    total: pending.length,
  }));
}
