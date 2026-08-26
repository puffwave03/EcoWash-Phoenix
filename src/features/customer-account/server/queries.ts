import "server-only";

import type {
  CustomerAccountFinancials,
  CustomerAccountOrder,
  CustomerAccountPayment,
  CustomerAccountPeriod,
  CustomerAccountSummary,
} from "@/features/customer-account/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SummaryRow = {
  average_order_value: number;
  confirmed_payments: number;
  currency: string;
  gross_order_value: number;
  last_order_at: string | null;
  last_payment_at: string | null;
  net_paid: number;
  order_count: number;
  outstanding_balance: number;
  outstanding_order_count: number;
  outstanding_order_value: number | null;
  refunded_payments: number;
};

type OrderRow = {
  balance_due: number;
  created_at: string;
  currency: string;
  id: string;
  order_number: string;
  payment_status: CustomerAccountOrder["paymentStatus"];
  production_status: CustomerAccountOrder["productionStatus"];
  property_id: string | null;
  property_name: string | null;
  total: number;
  total_paid: number;
};

type PaymentRow = {
  amount: number;
  currency: string;
  id: string;
  method: CustomerAccountPayment["method"];
  order_id: string;
  order_number: string;
  paid_at: string;
  refunded_from_payment_id: string | null;
  status: CustomerAccountPayment["status"];
};

const PERIOD_LIMITS: Record<CustomerAccountPeriod, { orders: number; payments: number }> = {
  all: { orders: 100, payments: 100 },
  recent: { orders: 8, payments: 12 },
  year: { orders: 50, payments: 50 },
};

function number(value: number | string | null) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function mapSummary(row: SummaryRow): CustomerAccountSummary {
  return {
    averageOrderValue: number(row.average_order_value),
    confirmedPayments: number(row.confirmed_payments),
    currency: row.currency,
    grossOrderValue: number(row.gross_order_value),
    lastOrderAt: row.last_order_at,
    lastPaymentAt: row.last_payment_at,
    netPaid: number(row.net_paid),
    orderCount: number(row.order_count),
    outstandingBalance: number(row.outstanding_balance),
    outstandingOrderCount: number(row.outstanding_order_count),
    outstandingOrderValue: number(row.outstanding_order_value),
    refundedPayments: number(row.refunded_payments),
  };
}

function mapOrder(row: OrderRow): CustomerAccountOrder {
  return {
    balanceDue: number(row.balance_due),
    createdAt: row.created_at,
    currency: row.currency,
    id: row.id,
    orderNumber: row.order_number,
    paymentStatus: row.payment_status,
    productionStatus: row.production_status,
    propertyId: row.property_id,
    propertyName: row.property_name,
    total: number(row.total),
    totalPaid: number(row.total_paid),
  };
}

function mapPayment(row: PaymentRow): CustomerAccountPayment {
  return {
    amount: number(row.amount),
    currency: row.currency,
    id: row.id,
    method: row.method,
    orderId: row.order_id,
    orderNumber: row.order_number,
    paidAt: row.paid_at,
    refundedFromPaymentId: row.refunded_from_payment_id,
    status: row.status,
  };
}

export async function getCustomerAccountFinancials(
  locale: string,
  customerId: string,
  period: CustomerAccountPeriod,
): Promise<CustomerAccountFinancials> {
  await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const limits = PERIOD_LIMITS[period];
  const [summaryResult, ordersResult, paymentsResult] = await Promise.all([
    supabase
      .rpc("get_customer_account_summary", { target_customer_id: customerId })
      .returns<SummaryRow[]>(),
    supabase
      .rpc("list_customer_account_orders", {
        target_customer_id: customerId,
        target_limit: limits.orders,
        target_period: period,
      })
      .returns<OrderRow[]>(),
    supabase
      .rpc("list_customer_account_payments", {
        target_customer_id: customerId,
        target_limit: limits.payments,
        target_period: period,
      })
      .returns<PaymentRow[]>(),
  ]);

  const error = summaryResult.error || ordersResult.error || paymentsResult.error;
  if (error) {
    console.error("Customer account financial query failed", error.code ?? "unknown");
    return { orders: [], payments: [], summaries: [] };
  }

  const orderRows = Array.isArray(ordersResult.data) ? ordersResult.data as OrderRow[] : [];
  const paymentRows = Array.isArray(paymentsResult.data) ? paymentsResult.data as PaymentRow[] : [];
  const summaryRows = Array.isArray(summaryResult.data) ? summaryResult.data as SummaryRow[] : [];

  return {
    orders: orderRows.map(mapOrder),
    payments: paymentRows.map(mapPayment),
    summaries: summaryRows.map(mapSummary),
  };
}
