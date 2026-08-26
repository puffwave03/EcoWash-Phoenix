export const CUSTOMER_LIFECYCLE_BLOCKING_REASONS = [
  "active_customer",
  "properties",
  "portal_access",
  "orders",
  "order_history",
  "payments",
  "operational_history",
  "media",
  "segment_assignment",
] as const;

export type CustomerLifecycleBlockingReason = (typeof CUSTOMER_LIFECYCLE_BLOCKING_REASONS)[number];

export type CustomerLifecycleEligibility = {
  blockingReasons: CustomerLifecycleBlockingReason[];
  canAnonymize: boolean;
  canDeactivate: boolean;
  canHardDelete: boolean;
  canReactivate: boolean;
  customerId: string;
  deliveryCount: number;
  hasSegmentAssignment: boolean;
  isActive: boolean;
  orderCount: number;
  orderHistoryCount: number;
  orderItemCount: number;
  paymentCount: number;
  photoCount: number;
  pickupCount: number;
  portalAccessCount: number;
  propertyCount: number;
};
