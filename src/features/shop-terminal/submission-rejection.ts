type RpcError = { code?: string | null; message?: string | null } | null;

// Each entry is raised after submit_shop_terminal_order acquires its per-key
// transaction lock. PostgreSQL rolls back the complete order/payment statement.
const AFTER_LOCK_REJECTIONS = new Map<string, string>([
  ["55000:daily_close_business_day_closed", "closedDay"],
  ["55000:pos_session_not_open", "till"],
  ["42501:pos_session_not_assigned", "till"],
  ["42501:pos_location_mismatch", "till"],
  ["42501:shop_terminal_staff_discount_denied", "discount"],
  ["22023:shop_terminal_production_assignee_invalid", "validation"],
  ["22023:shop_terminal_delivery_assignee_invalid", "validation"],
  ["22023:shop_terminal_item_invalid", "validation"],
  ["42501:shop_terminal_service_not_eligible", "validation"],
  ["22023:shop_terminal_payment_invalid", "validation"],
  ["22023:shop_terminal_payment_total_mismatch", "validation"],
  ["22023:pos_payment_invalid", "validation"],
]);

export function classifyDefinitiveTerminalRejection(error: RpcError): string | null {
  if (!error?.code || !error.message) return null;
  return AFTER_LOCK_REJECTIONS.get(`${error.code}:${error.message}`) ?? null;
}

export function canCorrectRejectedSubmission(proof: "before_rpc" | "after_lock" | undefined, firstDispatch: boolean) {
  return proof === "after_lock" || (proof === "before_rpc" && firstDispatch);
}
