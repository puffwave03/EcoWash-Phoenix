type DatabaseError = { message?: string | null } | null | undefined;

export function isBusinessDayClosedError(error: DatabaseError) {
  return error?.message?.includes("daily_close_business_day_closed") ?? false;
}
