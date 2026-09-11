import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default Open Graph / link-preview image for the whole app (GRAPHICS_PLAN.md
 * P1 — previously nothing was configured, so any shared link had no preview
 * image at all). Flat, brand-blue-on-white, no gradient/photo — same
 * restraint as every other asset in the system.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fcfcfb",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "#2a78d6",
            opacity: 0.07,
            top: -140,
            right: -120,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#2a78d6",
            }}
          >
            <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
              <rect x="3" y="7" width="26" height="20" rx="6" stroke="white" strokeWidth="2.2" />
              <path
                d="M3 14H22a2.5 2.5 0 0 1 2.5 2.5v0A2.5 2.5 0 0 1 22 19H3"
                stroke="white"
                strokeWidth="2.2"
              />
              <circle cx="22" cy="16.5" r="1.9" fill="white" />
            </svg>
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#0b0b0b", display: "flex" }}>
            Wealth OS
          </div>
        </div>

        <div style={{ fontSize: 32, color: "#52514e", marginTop: 28, display: "flex" }}>
          Know your money. Grow your income. Build your wealth.
        </div>
      </div>
    ),
    { ...size }
  );
}
