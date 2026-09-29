"use client";

import { checkOriginalUpload, encodeUnderLimit, type ScanUploadRejection } from "@/lib/capture/scan-upload";

export type PreparedReceiptImage = { ok: true; file: File } | { ok: false; reason: ScanUploadRejection };

/**
 * Downscales a photo (1600px long edge, then smaller/lower quality only if
 * needed) and re-encodes it as JPEG so the upload always fits the Server
 * Action body limit (see scan-upload.ts): faster on mobile data, and it
 * turns iPhone HEIC photos into a format the scanner accepts. Everything
 * happens in the browser; nothing is stored. If the browser can't decode
 * the file, the original is used only when the server would accept it.
 */
export async function prepareReceiptImage(file: File): Promise<PreparedReceiptImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    const blob = await encodeUnderLimit(async ({ maxEdge, quality }) => {
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    });
    if (blob) return { ok: true, file: new File([blob], "receipt.jpg", { type: "image/jpeg" }) };
    const rejection = checkOriginalUpload(file);
    return rejection ? { ok: false, reason: rejection } : { ok: true, file };
  } catch {
    const rejection = checkOriginalUpload(file);
    return rejection ? { ok: false, reason: rejection } : { ok: true, file };
  } finally {
    URL.revokeObjectURL(url);
  }
}
