import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Real brand favicon, replacing the default Next.js icon (GRAPHICS_PLAN.md
 * P1 #1). Same wallet-with-clasp shape as `BrandMark`, redrawn directly here
 * because `next/og`'s Satori renderer needs its own JSX/SVG tree rather than
 * importing the React component — kept visually identical on purpose.
 */
export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <rect x="3" y="7" width="26" height="20" rx="6" stroke="white" strokeWidth="2.6" />
          <path
            d="M3 14H22a2.5 2.5 0 0 1 2.5 2.5v0A2.5 2.5 0 0 1 22 19H3"
            stroke="white"
            strokeWidth="2.6"
          />
          <circle cx="22" cy="16.5" r="2" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
