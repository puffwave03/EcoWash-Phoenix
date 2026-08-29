import type { TenantBrandingExperience } from "@/features/branding/types";
import type { OrderLogistics } from "@/features/logistics/types";
import type { Order, OrderItem } from "@/features/orders/types";
import type { Payment, PaymentSummary } from "@/features/payments/types";
import type { PrinterProfileDefaults } from "@/features/printer-settings/types";

export type PrintOrderContext = {
  barcodeEnabled: boolean;
  branding: TenantBrandingExperience;
  createdByName: string | null;
  customerPhone: string | null;
  items: OrderItem[];
  locationName: string | null;
  logistics: OrderLogistics;
  organizationName: string;
  order: Order;
  payments: Payment[];
  paymentSummary: PaymentSummary;
  printerProfiles: PrinterProfileDefaults;
  timezone: string;
};

export type PrintLabel = {
  codePayload: string;
  customerName: string;
  dueAt: string | null;
  index: number;
  locationName: string | null;
  orderNumber: string;
  serviceName: string;
  total: number;
  unitIndex: number;
  unitLabel: string | null;
};
