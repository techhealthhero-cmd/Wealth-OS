"use client";

import { useEffect } from "react";

import { captureError } from "@/lib/observability";

/**
 * Root-layout error boundary (Day 8 STEP 4). Only fires when the ROOT
 * layout itself throws (e.g. the font loader, or `getClientEnv()` inside
 * `src/app/layout.tsx`) — `error.tsx` handles everything else. Must render
 * its own `<html>`/`<body>` since the root layout that would normally
 * provide them never mounted.
 *
 * No Tailwind classes here on purpose: if the root layout failed, there's
 * no guarantee the CSS pipeline that layout wires up is in a working state
 * either. Inline styles only, so this page is the one part of the app that
 * never depends on anything else in the app succeeding first.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureError(error, { route: "root-error-boundary", extra: { digest: error.digest ?? null } });
  }, [error]);

  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>ระบบขัดข้อง</h1>
            <p style={{ fontSize: 14, color: "#666", margin: "4px 0 0" }}>
              The application failed to load. Please try again.
            </p>
          </div>
          {process.env.NODE_ENV !== "production" ? (
            <pre
              style={{
                maxWidth: 560,
                overflowX: "auto",
                background: "#f4f4f5",
                padding: 12,
                borderRadius: 8,
                textAlign: "left",
                fontSize: 12,
                color: "#666",
              }}
            >
              {error.message}
            </pre>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#2a78d6",
              color: "white",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ลองใหม่ / Retry
          </button>
        </div>
      </body>
    </html>
  );
}
