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
import { CUSTOMER_ACCOUNT_PAGE_SIZE, decodeAccountOrderCursor, decodeAccountPaymentCursor, paginateAccountRows } from "@/features/customer-account/pagination";

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
type PaymentPageRow = PaymentRow & { created_at: string };

const RECENT_LIMITS = { orders: 8, payments: 12 };
const EMPTY_NAVIGATION = { olderCursor: null, newerCursor: null };

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
  rawOrderCursor?: string,
  rawPaymentCursor?: string,
): Promise<CustomerAccountFinancials> {
  await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const orderCursor = decodeAccountOrderCursor(rawOrderCursor, customerId, period);
  const paymentCursor = decodeAccountPaymentCursor(rawPaymentCursor, customerId, period);
  const [summaryResult, ordersResult, paymentsResult] = await Promise.all([
    supabase
      .rpc("get_customer_account_summary", { target_customer_id: customerId })
      .returns<SummaryRow[]>(),
    (period === "recent" ? supabase.rpc("list_customer_account_orders", {
      target_customer_id: customerId, target_limit: RECENT_LIMITS.orders, target_period: period,
    }) : supabase.rpc("list_customer_account_orders_page", {
      target_customer_id: customerId, target_period: period,
      target_cursor_created_at: orderCursor?.createdAt ?? null,
      target_cursor_id: orderCursor?.id ?? null,
      target_direction: orderCursor?.direction ?? "older",
      target_limit: CUSTOMER_ACCOUNT_PAGE_SIZE + 1,
    })).returns<OrderRow[]>(),
    (period === "recent" ? supabase.rpc("list_customer_account_payments", {
      target_customer_id: customerId, target_limit: RECENT_LIMITS.payments, target_period: period,
    }) : supabase.rpc("list_customer_account_payments_page", {
      target_customer_id: customerId, target_period: period,
      target_cursor_paid_at: paymentCursor?.paidAt ?? null,
      target_cursor_created_at: paymentCursor?.createdAt ?? null,
      target_cursor_id: paymentCursor?.id ?? null,
      target_direction: paymentCursor?.direction ?? "older",
      target_limit: CUSTOMER_ACCOUNT_PAGE_SIZE + 1,
    })).returns<PaymentRow[]>(),
  ]);

  const error = summaryResult.error || ordersResult.error || paymentsResult.error;
  if (error) {
    console.error("Customer account financial query failed", error.code ?? "unknown");
    return { orders: [], payments: [], summaries: [], pagination: { orderCursor: null, paymentCursor: null, orders: EMPTY_NAVIGATION, payments: EMPTY_NAVIGATION } };
  }

  const orderRows = Array.isArray(ordersResult.data) ? ordersResult.data as OrderRow[] : [];
  const paymentRows = Array.isArray(paymentsResult.data) ? paymentsResult.data as PaymentRow[] : [];
  const summaryRows = Array.isArray(summaryResult.data) ? summaryResult.data as SummaryRow[] : [];

  const orderPage = period === "recent" ? { items: orderRows, navigation: EMPTY_NAVIGATION }
    : paginateAccountRows(orderRows, orderCursor,
      (row, direction) => ({ createdAt: row.created_at, id: row.id, direction }), customerId, period);
  const paymentPage = period === "recent" ? { items: paymentRows, navigation: EMPTY_NAVIGATION }
    : paginateAccountRows(paymentRows as PaymentPageRow[], paymentCursor,
      (row, direction) => ({ paidAt: row.paid_at, createdAt: row.created_at, id: row.id, direction }), customerId, period);
  return {
    orders: orderPage.items.map(mapOrder),
    payments: paymentPage.items.map(mapPayment),
    summaries: summaryRows.map(mapSummary),
    pagination: {
      orderCursor: orderCursor ? rawOrderCursor ?? null : null,
      paymentCursor: paymentCursor ? rawPaymentCursor ?? null : null,
      orders: orderPage.navigation,
      payments: paymentPage.navigation,
    },
  };
}
