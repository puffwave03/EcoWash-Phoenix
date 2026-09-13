import { accountingPeriodBounds } from "@/features/accounting/summary";
import { addLocalDays, resolveAccountingPeriod } from "@/features/accounting/workspace";

const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isBusinessDate(value: string) {
  return BUSINESS_DATE.test(value) && addLocalDays(value, 0) === value;
}

export type DailyCloseBusinessDay = {
  businessDate: string;
  currentBusinessDate: string;
  end: Date;
  isFuture: boolean;
  start: Date;
};

export function resolveDailyCloseBusinessDay(
  input: string | undefined,
  timeZone: string,
  now = new Date(),
): DailyCloseBusinessDay {
  const current = resolveAccountingPeriod("today", undefined, undefined, timeZone, now).period.startDate;
  const businessDate = input && isBusinessDate(input) ? input : current;
  const period = { startDate: businessDate, endDateExclusive: addLocalDays(businessDate, 1) };
  const bounds = accountingPeriodBounds(period, timeZone);

  return {
    businessDate,
    currentBusinessDate: current,
    end: new Date(new Date(bounds.end).getTime() - 1),
    isFuture: businessDate > current,
    start: new Date(bounds.start),
  };
}

export function isInBusinessDay(value: string | null, day: DailyCloseBusinessDay) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();

  return timestamp >= day.start.getTime() && timestamp <= day.end.getTime();
}

export function attentionCutoff(day: DailyCloseBusinessDay, now = new Date()) {
  return new Date(Math.min(day.end.getTime(), now.getTime()));
}
