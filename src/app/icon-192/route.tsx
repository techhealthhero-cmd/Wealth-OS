import { ImageResponse } from "next/og";

/**
 * PWA manifest icon (192×192 — the Android/Chrome "any" install-prompt
 * size). Same brand mark as `icon.tsx`/`apple-icon.tsx`, kept visually
 * identical on purpose. A plain Route Handler rather than the `icon.tsx`
 * special-file convention because Next.js only auto-wires one favicon size
 * from that convention — `manifest.ts` needs a stable, explicitly-sized URL
 * to point at instead.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a78d6",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 32 32" fill="none">
          <rect x="3" y="7" width="26" height="20" rx="6" stroke="white" strokeWidth="2.4" />
          <path
            d="M3 14H22a2.5 2.5 0 0 1 2.5 2.5v0A2.5 2.5 0 0 1 22 19H3"
            stroke="white"
            strokeWidth="2.4"
          />
          <circle cx="22" cy="16.5" r="2" fill="white" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
