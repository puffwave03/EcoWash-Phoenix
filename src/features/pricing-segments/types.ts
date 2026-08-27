import type { CatalogSegmentAdminSettings } from "@/features/catalog-segments/types";

export type SegmentPrice = {
  amount: number;
  currency: string;
  id: string;
  isActive: boolean;
  locationId: string | null;
  segmentId: string;
  serviceId: string;
  validFrom: string;
  validTo: string | null;
};

export type SegmentPriceLocation = { id: string; name: string };

export type SegmentPricingSettings = CatalogSegmentAdminSettings & {
  currency: string;
  locations: SegmentPriceLocation[];
  prices: SegmentPrice[];
  today: string;
};

export type SegmentPriceActionState = {
  fieldErrors: Record<string, string>;
  formError: "duplicate" | "generic" | "migration" | "overlap" | null;
  success: boolean;
};
