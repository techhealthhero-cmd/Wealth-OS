"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

const DATA_STALE_AFTER_MS = 60_000;
const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "development";

/**
 * iOS can restore an installed PWA from the back/forward cache with its
 * complete old DOM and JavaScript heap. Data freshness and application-file
 * freshness are intentionally handled differently here:
 *
 * - same build: router.refresh() gets current RSC/financial data without
 *   discarding browser or Next static-asset caches;
 * - changed build: a document reload lets Next's content-hashed assets move
 *   atomically to the current deployment.
 */
export function AppFreshness() {
  const router = useRouter();
  const backgroundedAt = useRef<number | null>(null);
  const checking = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    async function reconcile({ refreshData }: { refreshData: boolean }) {
      if (checking.current) return;
      checking.current = true;
      try {
        const response = await fetch("/api/app-version", { cache: "no-store", headers: { Accept: "application/json" } });
        if (response.ok) {
          const payload = (await response.json()) as { version?: string };
          if (payload.version && payload.version !== CLIENT_VERSION) {
            window.location.reload();
            return;
          }
        }
        if (refreshData) startTransition(() => router.refresh());
      } catch {
        // Being offline must not destroy the current screen. A data refresh
        // is still safe: Next will keep the existing UI if it cannot finish.
        if (refreshData) startTransition(() => router.refresh());
      } finally {
        checking.current = false;
      }
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void reconcile({ refreshData: true });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        backgroundedAt.current = Date.now();
        return;
      }
      const hiddenAt = backgroundedAt.current;
      backgroundedAt.current = null;
      if (hiddenAt !== null && Date.now() - hiddenAt >= DATA_STALE_AFTER_MS) {
        void reconcile({ refreshData: true });
      }
    }

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
