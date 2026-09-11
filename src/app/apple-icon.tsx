import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS (Add to Home Screen). Same mark as `icon.tsx`, scaled up. */
export default function AppleIcon() {
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
        <svg width="112" height="112" viewBox="0 0 32 32" fill="none">
          <rect x="3" y="7" width="26" height="20" rx="6" stroke="white" strokeWidth="2.2" />
          <path
            d="M3 14H22a2.5 2.5 0 0 1 2.5 2.5v0A2.5 2.5 0 0 1 22 19H3"
            stroke="white"
            strokeWidth="2.2"
          />
          <circle cx="22" cy="16.5" r="1.9" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
