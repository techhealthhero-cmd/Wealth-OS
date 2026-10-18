import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Hand-drawn chart, shield and coin jar from the Brand & Marketing sheet
// (scripts/artwork/crop-brand-art.mjs writes this PNG copy for Satori).
const socialArt = `data:image/png;base64,${await readFile(
  join(process.cwd(), "public/artwork/brand/social.png"),
  "base64"
)}`;

/**
 * Default Open Graph / link-preview image for the whole app (GRAPHICS_PLAN.md
 * P1), in the app's own notebook palette (warm paper, ink-green mark): the
 * brand mark and tagline on the left, the gouache "steady growth" drawing on
 * the right — no gradient/photo, no figures that could read as a promised
 * return.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: "#f7efdf",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 96,
                height: 96,
                borderRadius: 24,
                background: "#204d3d",
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
            <div style={{ fontSize: 72, fontWeight: 700, color: "#26332d", display: "flex" }}>Wealth OS</div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 36,
              lineHeight: 1.35,
              color: "#5f6862",
              marginTop: 36,
            }}
          >
            <span>Know your money.</span>
            <span>Grow your income.</span>
            <span>Build your wealth.</span>
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={socialArt}
          alt=""
          width={400}
          height={400}
          style={{ transform: "rotate(2deg)", boxShadow: "0 18px 40px -18px rgba(30, 40, 60, 0.45)", borderRadius: 58 }}
        />
      </div>
    ),
    { ...size }
  );
}
