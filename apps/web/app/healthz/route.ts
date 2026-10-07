// Liveness probe for the container HEALTHCHECK and the load balancer. It must answer without a
// session, so it is excluded from the auth middleware matcher (see middleware.ts).
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
