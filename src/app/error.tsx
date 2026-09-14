"use client";

import { useEffect } from "react";
import Link from "next/link";

import { captureError } from "@/lib/observability";
import { Button } from "@/components/ui/button";

/**
 * Segment-level error boundary (Day 8 STEP 4). Catches any error thrown
 * while rendering a page/layout under `src/app` that doesn't have its own,
 * more specific `error.tsx`.
 *
 * Deliberately does NOT use the `useTranslation()` i18n hook or any other
 * app machinery beyond the most basic UI primitives — this boundary must
 * still render correctly even when the failure originated in a layout that
 * would normally provide that context (e.g. `(app)/layout.tsx`'s
 * `I18nProvider`, if `getProfile()` itself threw). Static bilingual text,
 * Thai-first per CLAUDE.md, is the more robust choice here.
 *
 * Never renders `error.message`/`error.stack` in production — only in dev,
 * where seeing the real error without digging through server logs is worth
 * more than strict production-parity in the one place that's guaranteed to
 * only ever appear when something has already gone wrong.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureError(error, { route: "app-error-boundary", extra: { digest: error.digest ?? null } });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">เกิดข้อผิดพลาดบางอย่าง</h1>
        <p className="text-sm text-muted-foreground">Something went wrong. Please try again.</p>
      </div>
      {process.env.NODE_ENV !== "production" ? (
        <pre className="max-w-lg overflow-x-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={() => reset()}>ลองใหม่ / Retry</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
          กลับหน้าหลัก / Home
        </Button>
      </div>
    </div>
  );
}
