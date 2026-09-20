export type DailyCloseResultStatus = "blocked" | "created" | "existing" | "validation";

export type DailyCloseBlockerResult = {
  code: string;
  count: number;
};

export type DailyCloseRequest = {
  businessDate: string;
  idempotencyKey: string;
  locationId: string | null;
  note?: string | null;
};

export type DailyCloseResult = {
  blockerCodes: string[];
  blockers: DailyCloseBlockerResult[];
  closeId: string | null;
  code: string | null;
  snapshotHash: string | null;
  status: DailyCloseResultStatus;
};

export type PersistedDailyClose = {
  businessDate: string;
  businessDayEndExclusive: string;
  businessDayStart: string;
  calculationVersion: string;
  closeNote: string | null;
  closedAt: string;
  closedBy: string;
  createdAt: string;
  id: string;
  locationId: string | null;
  organizationId: string;
  requestFingerprint: string;
  snapshot: unknown;
  snapshotHash: string;
  snapshotSchemaVersion: number;
  tenantTimezone: string;
};

export type PersistedDailyCloseHistoryItem = {
  businessDate: string;
  closeNote: string | null;
  closedAt: string;
  id: string;
  locationId: string | null;
  locationName: string | null;
  snapshotHash: string;
  tenantTimezone: string;
};

export type PersistedDailyCloseWithScope = PersistedDailyClose & {
  locationName: string | null;
};
