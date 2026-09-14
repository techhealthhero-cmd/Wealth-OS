import { ImageResponse } from "next/og";

/** PWA manifest icon (512×512 — the Android/Chrome splash-screen size). See icon-192/route.tsx for why this is a plain Route Handler. */
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
        <svg width="352" height="352" viewBox="0 0 32 32" fill="none">
          <rect x="3" y="7" width="26" height="20" rx="6" stroke="white" strokeWidth="2.2" />
          <path
            d="M3 14H22a2.5 2.5 0 0 1 2.5 2.5v0A2.5 2.5 0 0 1 22 19H3"
            stroke="white"
            strokeWidth="2.2"
          />
          <circle cx="22" cy="16.5" r="2" fill="white" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
