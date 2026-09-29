import { describe, expect, it } from "vitest";

import {
  SCAN_ENCODE_STEPS,
  SCAN_MAX_UPLOAD_BYTES,
  checkOriginalUpload,
  encodeUnderLimit,
} from "@/lib/capture/scan-upload";

// Regression (Phase 3 audit): the scanner advertised 5 MB, but a Server
// Action body is capped at 1 MB. A detailed square photo still came out at
// ~1.4 MB after the old single 1600px/0.85 pass, and an undecodable HEIC was
// uploaded as-is — both failed with a generic 413 "couldn't read" error.
const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)]);

describe("scan upload limit", () => {
  it("stays under Next's 1 MB Server Action limit with multipart headroom", () => {
    expect(SCAN_MAX_UPLOAD_BYTES).toBeLessThan(1024 * 1024 - 20 * 1024);
  });

  it("uses the first (gentlest) encode step when it already fits", async () => {
    const steps: number[] = [];
    const out = await encodeUnderLimit(async (s) => {
      steps.push(s.maxEdge);
      return blobOf(400 * 1024);
    });
    expect(out?.size).toBe(400 * 1024);
    expect(steps).toEqual([1600]);
  });

  it("steps down until the image fits (the ~1.4 MB square-photo case)", async () => {
    const sizes = [1385, 1100, 760, 500].map((kb) => kb * 1024);
    let i = 0;
    const out = await encodeUnderLimit(async () => blobOf(sizes[i++]));
    expect(out?.size).toBe(760 * 1024);
    expect(i).toBe(3);
  });

  it("returns null instead of an oversized upload when nothing fits", async () => {
    let calls = 0;
    const out = await encodeUnderLimit(async () => {
      calls++;
      return blobOf(2 * 1024 * 1024);
    });
    expect(out).toBeNull();
    expect(calls).toBe(SCAN_ENCODE_STEPS.length);
  });

  it("treats a failed canvas encode as 'try the next step'", async () => {
    let i = 0;
    const out = await encodeUnderLimit(async () => (i++ === 0 ? null : blobOf(300 * 1024)));
    expect(out?.size).toBe(300 * 1024);
  });
});

describe("checkOriginalUpload (browser could not decode the image)", () => {
  it("rejects formats the server won't accept, e.g. HEIC outside Safari", () => {
    expect(checkOriginalUpload({ type: "image/heic", size: 1500 * 1024 })).toBe("unsupported");
    expect(checkOriginalUpload({ type: "application/pdf", size: 10 })).toBe("unsupported");
  });

  it("rejects accepted formats that are over the upload limit", () => {
    expect(checkOriginalUpload({ type: "image/jpeg", size: SCAN_MAX_UPLOAD_BYTES + 1 })).toBe("too_large");
  });

  it("lets a small accepted original through", () => {
    expect(checkOriginalUpload({ type: "image/png", size: 200 * 1024 })).toBeNull();
  });
});
