// SECURITY-PORTAL-PREVIEW-CONTAINMENT-001C: disabled independently of flags
// and signatures. This endpoint must not access Auth or create sessions.
export function GET() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
