import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { PhotoCategory } from "@/features/order-photos/types";
import type { ProductionStatus } from "@/features/orders/types";
import type {
  CustomerPortalAccess,
  CustomerPortalAccessSummary,
  CustomerPortalLogisticsRecord,
  CustomerPortalNextTask,
  CustomerPortalOrder,
  CustomerPortalOrderDetail,
  CustomerPortalOrderFinancial,
  CustomerPortalPayment,
  CustomerPortalOrderRequestOptions,
} from "@/features/portal/types";
import { requireMembership } from "@/lib/auth/require-membership";

type PortalAccessRow = {
  access_id: string;
  customer_id: string;
  customer_email: string | null;
  customer_name: string;
  organization_id: string;
};

type PortalOrderRow = {
  completed_at: string | null;
  created_at: string;
  due_at: string | null;
  id: string;
  order_number: string;
  production_status: ProductionStatus;
  property_name: string | null;
};

type PortalFinancialRow = {
  balance_due: number;
  currency: string;
  discount_amount: number;
  order_id: string;
  payment_status: CustomerPortalOrderFinancial["paymentStatus"];
  subtotal: number;
  total_due: number;
  total_paid: number;
};

type PortalPaymentRow = {
  amount: number;
  currency: string;
  id: string;
  method: CustomerPortalPayment["method"];
  order_id: string;
  paid_at: string;
  status: CustomerPortalPayment["status"];
};

type PortalItemRow = {
  description: string;
  id: string;
  quantity: number;
  unit_type: CustomerPortalOrderDetail["items"][number]["unitType"];
};

type PortalHistoryRow = {
  changed_at: string;
  id: string;
  to_status: ProductionStatus;
};

type PortalLogisticsRow = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  completed_at: string | null;
  contact_phone: string | null;
  country_code: string | null;
  kind: "delivery" | "pickup";
  postal_code: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  status: FulfillmentStatus;
};

type PortalPhotoRow = {
  caption: string | null;
  category: PhotoCategory;
  created_at: string;
  customer_visible: boolean;
  id: string;
  is_active: boolean;
  mime_type: string;
  original_filename: string | null;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
};

type PortalAccessSummaryRow = {
  created_at: string;
  disabled_at: string | null;
  email: string;
  id: string;
  is_active: boolean;
  updated_at: string;
  user_id: string;
};

type PortalTaskRow = {
  kind: "delivery" | "pickup";
  order_id: string;
  order_number: string;
  scheduled_at: string | null;
  status: FulfillmentStatus;
};

type PortalOrderingContextRow = {
  currency: string;
  timezone: string;
};

type PortalOrderServiceRow = {
  amount: number;
  category: string | null;
  currency: string;
  description: string | null;
  id: string;
  name: string;
  unit_type: CustomerPortalOrderRequestOptions["services"][number]["unitType"];
};

type PortalOrderPropertyRow = {
  access_instructions: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  country_code: string | null;
  id: string;
  name: string;
  postal_code: string | null;
};

function mapFinancial(row: PortalFinancialRow): CustomerPortalOrderFinancial {
  return {
    balanceDue: Number(row.balance_due),
    currency: row.currency,
    discountAmount: Number(row.discount_amount),
    orderId: row.order_id,
    paymentStatus: row.payment_status,
    subtotal: Number(row.subtotal),
    totalDue: Number(row.total_due),
    totalPaid: Number(row.total_paid),
  };
}

function mapPortalOrder(
  row: PortalOrderRow,
  financial: CustomerPortalOrderFinancial | null = null,
): CustomerPortalOrder {
  return {
    completedAt: row.completed_at,
    createdAt: row.created_at,
    dueAt: row.due_at,
    financial,
    id: row.id,
    orderNumber: row.order_number,
    productionStatus: row.production_status,
    propertyName: row.property_name,
  };
}

function mapItem(row: PortalItemRow): CustomerPortalOrderDetail["items"][number] {
  return {
    description: row.description,
    id: row.id,
    quantity: row.quantity,
    unitType: row.unit_type,
  };
}

function mapHistory(row: PortalHistoryRow): CustomerPortalOrderDetail["history"][number] {
  return {
    changedAt: row.changed_at,
    id: row.id,
    toStatus: row.to_status,
  };
}

function mapLogistics(row: PortalLogisticsRow | null): CustomerPortalLogisticsRecord | null {
  if (!row) return null;

  return {
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    completedAt: row.completed_at,
    contactPhone: row.contact_phone,
    countryCode: row.country_code,
    postalCode: row.postal_code,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    status: row.status,
  };
}

async function signedPortalPhoto(row: PortalPhotoRow) {
  const supabase = await createSupabaseServerClient();
  let signedUrl: string | null = null;

  if (row.is_active && row.customer_visible) {
    const result = await supabase.storage
      .from(row.storage_bucket)
      .createSignedUrl(row.storage_path, 600);
    signedUrl = result.data?.signedUrl ?? null;
    if (result.error && result.error.message !== "Object not found") {
      console.error("Portal photo signed URL failed", result.error.message);
    }
  }

  return {
    caption: row.caption,
    category: row.category,
    createdAt: row.created_at,
    customerVisible: row.customer_visible,
    id: row.id,
    isActive: row.is_active,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    signedUrl,
    sizeBytes: row.size_bytes,
    uploadedByName: null,
  };
}

export async function requireCustomerPortalAccess(locale: string): Promise<CustomerPortalAccess> {
  await requireAuth(locale);
  const supabase = await createSupabaseServerClient();
  const { data: access, error } = await supabase
    .rpc("customer_portal_current_access")
    .maybeSingle<PortalAccessRow>();

  if (error || !access) redirect(`/${locale}/portal/access`);

  return {
    customerId: access.customer_id,
    customerName: access.customer_name,
    email: access.customer_email,
    id: access.access_id,
    organizationId: access.organization_id,
  };
}

export async function listCustomerPortalOrders(locale: string): Promise<CustomerPortalOrder[]> {
  await requireCustomerPortalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const [ordersResult, financialResult] = await Promise.all([
    supabase.rpc("list_customer_portal_orders").returns<PortalOrderRow[]>(),
    supabase.rpc("list_customer_portal_order_financials").returns<PortalFinancialRow[]>(),
  ]);

  if (ordersResult.error || !ordersResult.data) {
    console.error("Portal order list failed", ordersResult.error?.code);
    return [];
  }

  if (financialResult.error) {
    console.error("Portal order financials failed", financialResult.error.code);
  }

  const financials = new Map(
    ((financialResult.data ?? []) as PortalFinancialRow[]).map((row) => {
      const financial = mapFinancial(row);
      return [financial.orderId, financial] as const;
    }),
  );

  return (ordersResult.data as PortalOrderRow[]).map((row) => (
    mapPortalOrder(row, financials.get(row.id) ?? null)
  ));
}

function mapPortalTask(row: PortalTaskRow): CustomerPortalNextTask | null {
  if (!row.scheduled_at) return null;

  return {
    kind: row.kind,
    orderId: row.order_id,
    orderNumber: row.order_number,
    scheduledAt: row.scheduled_at,
    status: row.status,
  };
}

export async function getNextCustomerPortalTask(locale: string): Promise<CustomerPortalNextTask | null> {
  await requireCustomerPortalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("list_customer_portal_next_tasks")
    .returns<PortalTaskRow[]>();

  if (error) console.error("Portal next task failed", error.code);

  return ((data ?? []) as PortalTaskRow[]).flatMap((row) => {
    const task = mapPortalTask(row);

    return task ? [task] : [];
  })[0] ?? null;
}

export async function getCustomerPortalOrderDetail(
  locale: string,
  orderId: string,
): Promise<CustomerPortalOrderDetail> {
  await requireCustomerPortalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .rpc("get_customer_portal_order", { target_order_id: orderId })
    .maybeSingle<PortalOrderRow>();

  if (orderError || !order) notFound();

  const [itemsResult, historyResult, logisticsResult, photosResult, financialResult, paymentsResult] = await Promise.all([
    supabase
      .rpc("list_customer_portal_order_items", { target_order_id: orderId })
      .returns<PortalItemRow[]>(),
    supabase
      .rpc("list_customer_portal_order_history", { target_order_id: orderId })
      .returns<PortalHistoryRow[]>(),
    supabase
      .rpc("list_customer_portal_logistics", { target_order_id: orderId })
      .returns<PortalLogisticsRow[]>(),
    supabase
      .rpc("list_customer_portal_order_photos", { target_order_id: orderId })
      .returns<PortalPhotoRow[]>(),
    supabase
      .rpc("list_customer_portal_order_financials")
      .returns<PortalFinancialRow[]>(),
    supabase
      .rpc("list_customer_portal_order_payments", { target_order_id: orderId })
      .returns<PortalPaymentRow[]>(),
  ]);

  if (itemsResult.error) console.error("Portal order items failed", itemsResult.error.code);
  if (historyResult.error) console.error("Portal order history failed", historyResult.error.code);
  if (logisticsResult.error) console.error("Portal logistics failed", logisticsResult.error.code);
  if (photosResult.error) console.error("Portal photos failed", photosResult.error.code);
  if (financialResult.error) console.error("Portal order financials failed", financialResult.error.code);
  if (paymentsResult.error) console.error("Portal order payments failed", paymentsResult.error.code);
  const logisticsRows = (logisticsResult.data ?? []) as PortalLogisticsRow[];
  const pickup = logisticsRows.find((record) => record.kind === "pickup") ?? null;
  const delivery = logisticsRows.find((record) => record.kind === "delivery") ?? null;

  return {
    ...mapPortalOrder(
      order,
      ((financialResult.data ?? []) as PortalFinancialRow[])
        .filter((row) => row.order_id === orderId)
        .map(mapFinancial)[0] ?? null,
    ),
    history: ((historyResult.data ?? []) as PortalHistoryRow[]).map(mapHistory),
    items: ((itemsResult.data ?? []) as PortalItemRow[]).map(mapItem),
    logistics: {
      delivery: mapLogistics(delivery),
      pickup: mapLogistics(pickup),
    },
    photos: await Promise.all(((photosResult.data ?? []) as PortalPhotoRow[]).map(signedPortalPhoto)),
    payments: ((paymentsResult.data ?? []) as PortalPaymentRow[]).map((payment) => ({
      amount: Number(payment.amount),
      currency: payment.currency,
      id: payment.id,
      method: payment.method,
      orderId: payment.order_id,
      paidAt: payment.paid_at,
      status: payment.status,
    })),
  };
}

export async function getCustomerPortalOrderRequestOptions(
  locale: string,
): Promise<CustomerPortalOrderRequestOptions> {
  await requireCustomerPortalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const [contextResult, servicesResult, propertiesResult] = await Promise.all([
    supabase
      .rpc("get_customer_portal_ordering_context")
      .maybeSingle<PortalOrderingContextRow>(),
    supabase
      .rpc("list_customer_portal_services")
      .returns<PortalOrderServiceRow[]>(),
    supabase
      .rpc("list_customer_portal_properties")
      .returns<PortalOrderPropertyRow[]>(),
  ]);

  if (contextResult.error) console.error("Portal ordering context failed", contextResult.error.code);
  if (servicesResult.error) console.error("Portal ordering services failed", servicesResult.error.code);
  if (propertiesResult.error) console.error("Portal ordering properties failed", propertiesResult.error.code);

  return {
    context: contextResult.data
      ? {
          currency: contextResult.data.currency,
          timeZone: contextResult.data.timezone,
        }
      : null,
    properties: ((propertiesResult.data ?? []) as PortalOrderPropertyRow[]).map((property) => ({
      accessInstructions: property.access_instructions,
      addressLine1: property.address_line1,
      addressLine2: property.address_line2,
      city: property.city,
      contactName: property.contact_name,
      contactPhone: property.contact_phone,
      countryCode: property.country_code,
      id: property.id,
      name: property.name,
      postalCode: property.postal_code,
    })),
    services: ((servicesResult.data ?? []) as PortalOrderServiceRow[]).map((service) => ({
      amount: Number(service.amount),
      category: service.category,
      currency: service.currency,
      description: service.description,
      id: service.id,
      name: service.name,
      unitType: service.unit_type,
    })),
  };
}

export async function getCustomerPortalAccessSummary(
  locale: string,
  customerId: string,
): Promise<CustomerPortalAccessSummary | null> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_portal_access")
    .select("id, email, is_active, created_at, disabled_at, updated_at, user_id")
    .eq("organization_id", membership.organization.id)
    .eq("customer_id", customerId)
    .maybeSingle<PortalAccessSummaryRow>();

  if (error) {
    console.error("Customer portal access summary failed", error.code);
    return null;
  }

  let lastSignInAt: string | null = null;

  if (data && hasSupabaseAdminConfig()) {
    try {
      const admin = createSupabaseAdminClient();
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(data.user_id);

      if (authError) {
        console.error("Customer portal auth summary failed", authError.code ?? authError.status ?? "unknown");
      } else {
        lastSignInAt = authUser.user?.last_sign_in_at ?? null;
      }
    } catch (authSummaryError) {
      console.error("Customer portal auth summary configuration failed", authSummaryError);
    }
  }

  return data
    ? {
        disabledAt: data.disabled_at,
        email: data.email,
        id: data.id,
        invitedAt: data.created_at,
        isActive: data.is_active,
        lastSignInAt,
        updatedAt: data.updated_at,
      }
    : null;
}
