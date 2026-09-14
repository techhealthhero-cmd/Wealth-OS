import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Not Found — Wealth OS" };

/**
 * Day 8 STEP 4 — catches any unmatched route. Static bilingual text, same
 * reasoning as error.tsx: this can be reached before any session/locale
 * context is known to be in a good state.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">ไม่พบหน้านี้</h1>
        <p className="text-sm text-muted-foreground">Page not found.</p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>
        กลับหน้าหลัก / Home
      </Button>
    </div>
  );
}
