import { NextResponse, type NextRequest } from "next/server";
import { getOnlinePaymentProvider } from "@/features/online-payments/providers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type WebhookRouteContext = {
  params: Promise<{ provider: string }>;
};

export async function POST(request: NextRequest, context: WebhookRouteContext) {
  const { provider: providerName } = await context.params;
  const provider = getOnlinePaymentProvider(providerName);
  if (!provider.configured || provider.name !== providerName) {
    return NextResponse.json({ received: false }, { status: 404 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = await provider.validateWebhook(rawBody, request.headers);
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (event.status === "confirmed") {
    if (event.amount === null || !event.currency || !event.paymentReference) {
      return NextResponse.json({ received: false }, { status: 400 });
    }
    const { error } = await admin.rpc("settle_online_payment_attempt", {
      target_amount: event.amount,
      target_currency: event.currency,
      target_paid_at: event.paidAt,
      target_provider: provider.name,
      target_provider_event_id: event.eventId,
      target_provider_payment_reference: event.paymentReference,
      target_provider_session_id: event.sessionId,
    });
    if (error) {
      console.error("Online payment settlement failed", error.code);
      return NextResponse.json({ received: false }, { status: 500 });
    }
  } else {
    const { error } = await admin.rpc("record_online_payment_attempt_outcome", {
      target_failure_code: event.failureCode,
      target_provider: provider.name,
      target_provider_event_id: event.eventId,
      target_provider_session_id: event.sessionId,
      target_status: event.status,
    });
    if (error) {
      console.error("Online payment outcome failed", error.code);
      return NextResponse.json({ received: false }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
