import type { ServiceUnitType } from "@/features/services/types";

export type ShopCustomer = {
  email: string | null;
  id: string;
  isWalkIn: boolean;
  name: string;
  phone: string | null;
  updatedAt: string;
};

export type ShopService = {
  amount: number;
  category: string | null;
  categoryKey: string | null;
  code: string | null;
  currency: string;
  description: string | null;
  id: string;
  imageUrl: string | null;
  name: string;
  priceIsFrom: boolean;
  pricingSegmentName: string | null;
  pricingSource: "base" | "segment";
  unitType: ServiceUnitType;
};

export type ShopCatalogSelection = {
  segmentName: string | null;
  services: ShopService[];
};

export type ShopRecentOrder = {
  customerName: string;
  id: string;
  orderNumber: string;
  total: number;
};

export type ShopOrderResult = {
  customerId: string;
  customerName: string;
  discountAmount: number;
  dueAt: string | null;
  isWalkIn: boolean;
  orderId: string;
  orderNumber: string;
  outstanding: number;
  paid: number;
  subtotal: number;
  total: number;
};

export type ShopSubmitState = {
  error: string | null;
  result: ShopOrderResult | null;
};

export type ShopCustomerState = {
  customer: ShopCustomer | null;
  error: string | null;
};

export type ShopCodeResolveResult = {
  error: "invalid" | "not_found" | null;
  orderId: string | null;
  orderNumber: string | null;
};
