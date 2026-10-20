"use client";

import { loadLocalSlipScript } from "./local-slip-assets";

type QRReader = (data: Uint8ClampedArray, width: number, height: number, options: { inversionAttempts: "attemptBoth" }) => { data: string } | null;

export interface SlipImageQRDecoder { decode(image: Blob): Promise<string | null> }
/** Browser-only, no upload or retained object URLs. */
export const localSlipQRDecoder: SlipImageQRDecoder = {
  async decode(image) {
    if (typeof window === "undefined") throw new Error("Slip QR requires a browser");
    await loadLocalSlipScript("/ocr/jsQR.js");
    const jsQR = (window as unknown as { jsQR: QRReader }).jsQR;
    if (!jsQR) throw new Error("Local QR reader unavailable");
    const url = URL.createObjectURL(image);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      try {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
      } finally { canvas.width = canvas.height = 0; }
    } finally { URL.revokeObjectURL(url); }
  },
};
