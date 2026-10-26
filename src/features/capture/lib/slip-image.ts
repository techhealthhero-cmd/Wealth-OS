"use client";

/**
 * Gallery photos are often HEIC or stored sideways (EXIF). The OCR worker
 * decodes the bytes it is given and does not apply phone orientation, and it
 * frequently cannot decode HEIC. Drawing here uses the browser's image
 * decoder (WebKit paints HEIC and honors EXIF) and hands the worker a PNG.
 * Nothing is uploaded or stored. If decoding fails, the original blob is used.
 */
export async function prepareSlipImage(file: Blob): Promise<Blob> {
  if (typeof document === "undefined") return file;
  const url = URL.createObjectURL(file);
  try {
    let source: CanvasImageSource | null = null;
    let width = 0;
    let height = 0;
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        source = bitmap;
        width = bitmap.width;
        height = bitmap.height;
      } catch { /* Fall through to <img>, which is the WebKit HEIC path. */ }
    }
    if (!source) {
      const img = new Image();
      img.src = url;
      await img.decode();
      source = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    }
    if (!width || !height) return file;
    const edge = Math.max(width, height);
    const scale = edge > 2000 ? 2000 / edge : edge < 800 ? Math.min(2, 1600 / edge) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      return blob ?? file;
    } finally {
      if ("close" in source && typeof source.close === "function") source.close();
      canvas.width = canvas.height = 0;
    }
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
