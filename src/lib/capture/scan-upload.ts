/**
 * Upload limits for receipt/slip scans, shared by the browser (image prep)
 * and the server action.
 *
 * The scan image travels through a Server Action, and Next.js caps an
 * action's raw request body at 1 MB by default (verified in Next 16.3.4's
 * action-handler; `serverActions.bodySizeLimit` is not raised here on
 * purpose — it would apply to every action). The limit counts multipart
 * overhead too, so uploads are kept to 900 KB. Anything larger used to fail
 * with a generic "couldn't read the slip" (HTTP 413) instead of a useful
 * message.
 */
export const SCAN_MAX_UPLOAD_BYTES = 900 * 1024;

export const SCAN_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Re-encode attempts, gentlest first: long-edge pixels + JPEG quality. */
export const SCAN_ENCODE_STEPS: readonly { maxEdge: number; quality: number }[] = [
  { maxEdge: 1600, quality: 0.85 },
  { maxEdge: 1600, quality: 0.7 },
  { maxEdge: 1280, quality: 0.7 },
  { maxEdge: 1024, quality: 0.6 },
];

/**
 * Tries each encode step until one fits under `maxBytes`. `encode` does the
 * actual (canvas) work and may return null if the browser can't encode.
 * Returns null when no step fits — the caller then tells the user instead
 * of uploading something the server will reject.
 */
export async function encodeUnderLimit(
  encode: (step: { maxEdge: number; quality: number }) => Promise<Blob | null>,
  maxBytes: number = SCAN_MAX_UPLOAD_BYTES
): Promise<Blob | null> {
  for (const step of SCAN_ENCODE_STEPS) {
    const blob = await encode(step);
    if (blob && blob.size <= maxBytes) return blob;
  }
  return null;
}

export type ScanUploadRejection = "unsupported" | "too_large";

/**
 * When the browser can't decode an image (e.g. HEIC outside Safari), the
 * original file can only be sent if the server would accept it as-is.
 */
export function checkOriginalUpload(file: { type: string; size: number }): ScanUploadRejection | null {
  if (!(SCAN_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "unsupported";
  if (file.size > SCAN_MAX_UPLOAD_BYTES) return "too_large";
  return null;
}
