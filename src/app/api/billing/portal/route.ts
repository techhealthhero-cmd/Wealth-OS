import { createPortalSessionAction } from "@/features/billing/actions";

export async function POST() {
  const result = await createPortalSessionAction();
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ url: result.url });
}
