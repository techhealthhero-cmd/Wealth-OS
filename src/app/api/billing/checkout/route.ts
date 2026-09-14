import { createCheckoutSessionAction } from "@/features/billing/actions";
import type { PlanId } from "@/lib/billing/plans";

/**
 * Thin route-handler wrapper around `createCheckoutSessionAction` (Day 7
 * STEP 8's named route). All real validation/trust-boundary logic lives in
 * the action itself so it stays identical whether called from this route
 * or in the future directly from a Server Component.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const planId = body?.planId;

  if (planId !== "plus" && planId !== "pro") {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  const result = await createCheckoutSessionAction(planId as PlanId);
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ url: result.url });
}
