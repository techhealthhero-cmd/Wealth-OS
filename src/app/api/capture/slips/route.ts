import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/observability";
import { todayInTimeZone } from "@/lib/date";
import { getDictionary } from "@/i18n/dictionaries";
import { SCAN_ACCEPTED_TYPES } from "@/lib/capture/scan-upload";
import { SLIP_ENDPOINT_BURST, SLIP_ENDPOINT_MAX_BYTES, readBearerToken, sha256Hex } from "@/lib/capture/slip-inbox";
import { ingestSlipImage, type SlipIngestStatus } from "@/features/slip-inbox/ingest";
import type { AIImageMediaType } from "@/features/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * iPhone Shortcut → slip inbox. One slip image per POST, authenticated by a
 * personal capture token (`Authorization: Bearer wos_slip_…`, created in
 * Profile › ส่งสลิปอัตโนมัติ). There is no session here, so the token lookup
 * and the write use the service-role client — and everything after the
 * lookup is scoped to that token's owner by an explicit user_id filter
 * (ingest.ts). The key can ONLY add slips to its owner's inbox: no reads of
 * balances or transactions are ever returned, and nothing is saved as a
 * transaction until the user confirms it in the app.
 *
 * Body: the image itself (Content-Type image/jpeg|png|webp), or multipart
 * form data with the image in a field named "image" (or "file").
 */

const HTTP_STATUS: Record<SlipIngestStatus, number> = {
  queued: 201,
  already: 200,
  duplicate: 200,
  not_slip: 200,
  limit: 429,
  quota: 429,
  unavailable: 503,
  failed: 500,
};

type Admin = ReturnType<typeof createAdminClient>;

interface Owner {
  tokenId: string;
  userId: string;
  timezone: string;
  locale: "th" | "en";
}

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function resolveOwner(admin: Admin, request: Request): Promise<Owner | null> {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return null;
  const { data } = await admin
    .from("capture_tokens")
    .select("id, user_id")
    .eq("token_hash", sha256Hex(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("timezone, preferred_language")
    .eq("user_id", data.user_id)
    .maybeSingle();
  return {
    tokenId: data.id as string,
    userId: data.user_id as string,
    timezone: (profile?.timezone as string | undefined) ?? "Asia/Bangkok",
    locale: profile?.preferred_language === "en" ? "en" : "th",
  };
}

const unauthorized = () => json({ status: "unauthorized", message: "Invalid or revoked key · รหัสเชื่อมต่อไม่ถูกต้องหรือถูกยกเลิกแล้ว" }, 401);

async function readImage(request: Request): Promise<{ bytes: Uint8Array; mediaType: string } | "too_large" | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  // Multipart adds a little overhead on top of the image itself.
  if (declared > SLIP_ENDPOINT_MAX_BYTES + 16 * 1024) return "too_large";
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type === "multipart/form-data") {
    const form = await request.formData();
    const file = form.get("image") ?? form.get("file");
    if (!(file instanceof File) || file.size === 0) return null;
    if (file.size > SLIP_ENDPOINT_MAX_BYTES) return "too_large";
    return { bytes: new Uint8Array(await file.arrayBuffer()), mediaType: file.type.toLowerCase() };
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return null;
  if (bytes.byteLength > SLIP_ENDPOINT_MAX_BYTES) return "too_large";
  return { bytes, mediaType: type };
}

/** "Test connection" for the Shortcut setup: is this key valid? Returns nothing about the user's money. */
export async function GET(request: Request) {
  const admin = createAdminClient();
  const owner = await resolveOwner(admin, request);
  if (!owner) return unauthorized();
  return json({ status: "ok", message: getDictionary(owner.locale).slipInbox.api.ok }, 200);
}

export async function POST(request: Request) {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    captureError(error, { route: "api/capture/slips", operation: "admin_client" });
    return json({ status: "unavailable", message: "Not available" }, 503);
  }

  const owner = await resolveOwner(admin, request);
  if (!owner) return unauthorized();
  const m = getDictionary(owner.locale).slipInbox.api;

  // Per-key burst limit (same Postgres limiter as the rest of the app; fails open).
  const { data: allowed, error: limitError } = await admin.rpc("check_rate_limit", {
    p_key: `slip-token:${owner.tokenId}`,
    p_window_seconds: SLIP_ENDPOINT_BURST.windowSeconds,
    p_max_count: SLIP_ENDPOINT_BURST.maxRequests,
  });
  if (limitError) captureError(limitError, { route: "api/capture/slips", operation: "check_rate_limit" });
  else if (allowed !== true) return json({ status: "limit", message: m.limit }, 429);

  const image = await readImage(request).catch(() => null);
  if (image === "too_large") return json({ status: "too_large", message: m.tooLarge }, 413);
  if (!image) return json({ status: "invalid", message: m.invalid }, 400);
  if (!(SCAN_ACCEPTED_TYPES as readonly string[]).includes(image.mediaType)) {
    return json({ status: "unsupported", message: m.unsupported }, 415);
  }

  await admin.from("capture_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", owner.tokenId);

  const result = await ingestSlipImage(admin, {
    userId: owner.userId,
    image: { bytes: image.bytes, mediaType: image.mediaType as AIImageMediaType },
    origin: "shortcut",
    tokenId: owner.tokenId,
    today: todayInTimeZone(owner.timezone),
  });
  return json({ status: result.status, message: m[result.status] }, HTTP_STATUS[result.status]);
}
