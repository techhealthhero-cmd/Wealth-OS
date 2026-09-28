"use client";

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Downscales a photo to at most 1600px on its long edge and re-encodes it
 * as JPEG before upload: faster on mobile data, well under the 5MB scan
 * limit, and it turns iPhone HEIC photos into a format the scanner accepts.
 * Everything happens in the browser; nothing is stored. Falls back to the
 * original file if the browser can't decode it.
 */
export async function prepareReceiptImage(file: File): Promise<File> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode"));
        el.src = url;
      });
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
      if (!blob) return file;
      return new File([blob], "receipt.jpg", { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return file;
  }
}
