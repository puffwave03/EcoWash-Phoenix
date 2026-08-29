import { isDiscreteServiceUnit } from "@/features/services/types";
import type { PrintLabel, PrintOrderContext } from "@/features/printing/types";

export function buildPrintLabels(context: PrintOrderContext): PrintLabel[] {
  const pending = context.items.flatMap((item) => {
    const copies = isDiscreteServiceUnit(item.unitType) ? Math.max(1, Math.trunc(item.quantity)) : 1;
    return Array.from({ length: copies }, (_, copyIndex) => ({
      serviceName: item.description,
      unitLabel: copies > 1 ? `${copyIndex + 1}/${copies}` : null,
    }));
  });

  return pending.map((label, index) => ({
    ...label,
    customerName: context.order.customerName,
    dueAt: context.order.dueAt,
    index: index + 1,
    locationName: context.locationName,
    orderNumber: context.order.orderNumber,
    total: pending.length,
  }));
}
