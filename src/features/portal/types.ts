import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { OrderPhoto } from "@/features/order-photos/types";
import type {
  DerivedPaymentStatus,
  PaymentMethod,
  PaymentRecordStatus,
} from "@/features/payments/types";
import type { ServiceUnitType } from "@/features/services/types";

export type CustomerPortalAccess = {
  customerId: string;
  customerName: string;
  email: string | null;
  id: string;
  organizationId: string;
};

export type CustomerPortalOrder = {
  completedAt: string | null;
  createdAt: string;
  dueAt: string | null;
  id: string;
  financial: CustomerPortalOrderFinancial | null;
  orderNumber: string;
  productionStatus: ProductionStatus;
  propertyName: string | null;
};

export type CustomerPortalOrderFinancial = {
  balanceDue: number;
  currency: string;
  discountAmount: number;
  orderId: string;
  paymentStatus: DerivedPaymentStatus;
  subtotal: number;
  totalDue: number;
  totalPaid: number;
};

export type CustomerPortalPayment = {
  amount: number;
  currency: string;
  id: string;
  method: PaymentMethod;
  orderId: string;
  paidAt: string;
  status: PaymentRecordStatus;
};

export type CustomerPortalLogisticsRecord = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  completedAt: string | null;
  contactPhone: string | null;
  countryCode: string | null;
  postalCode: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  status: FulfillmentStatus;
};

export type CustomerPortalLogistics = {
  delivery: CustomerPortalLogisticsRecord | null;
  pickup: CustomerPortalLogisticsRecord | null;
};

export type CustomerPortalOrderItem = {
  description: string;
  id: string;
  quantity: number;
  unitType: ServiceUnitType;
};

export type CustomerPortalHistoryEvent = {
  changedAt: string;
  id: string;
  toStatus: ProductionStatus;
};

export type CustomerPortalOrderDetail = CustomerPortalOrder & {
  history: CustomerPortalHistoryEvent[];
  items: CustomerPortalOrderItem[];
  logistics: CustomerPortalLogistics;
  photos: OrderPhoto[];
  payments: CustomerPortalPayment[];
};

export type CustomerPortalNextTask = {
  kind: "delivery" | "pickup";
  orderId: string;
  orderNumber: string;
  scheduledAt: string;
  status: FulfillmentStatus;
};

export type CustomerPortalAccessSummary = {
  email: string;
  disabledAt: string | null;
  invitedAt: string;
  id: string;
  lastSignInAt: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type CustomerPortalActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
  success: boolean;
  successKey?: string | null;
};

export type CustomerPortalOrderingContext = {
  currency: string;
  timeZone: string;
};

export type CustomerPortalOrderService = {
  amount: number;
  category: string | null;
  currency: string;
  description: string | null;
  id: string;
  name: string;
  portalFeatured: boolean;
  portalImagePath: string | null;
  priceIsFrom: boolean;
  unitType: ServiceUnitType;
};

export type CustomerPortalOrderProperty = {
  accessInstructions: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  contactName: string | null;
  contactPhone: string | null;
  countryCode: string | null;
  id: string;
  name: string;
  postalCode: string | null;
};

export type CustomerPortalOrderRequestOptions = {
  context: CustomerPortalOrderingContext | null;
  properties: CustomerPortalOrderProperty[];
  services: CustomerPortalOrderService[];
};

export type CustomerPortalOrderRequestError =
  | "generic"
  | "invalidQuantity"
  | "pickupPast"
  | "property"
  | "requestedPickupAt"
  | "services";

export type CustomerPortalOrderRequestState = {
  fieldErrors: Record<string, string>;
  formError: CustomerPortalOrderRequestError | null;
};
