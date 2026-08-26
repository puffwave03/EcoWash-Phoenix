import {
  CUSTOMER_ACCOUNT_PERIODS,
  type CustomerAccountPeriod,
} from "@/features/customer-account/types";

export function parseCustomerAccountPeriod(value: string | undefined): CustomerAccountPeriod {
  return CUSTOMER_ACCOUNT_PERIODS.includes(value as CustomerAccountPeriod)
    ? (value as CustomerAccountPeriod)
    : "recent";
}
