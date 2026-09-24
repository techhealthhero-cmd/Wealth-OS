import { AlertCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Reported (production-hardening audit): the dashboard's 3 headline cards
 * (NetWorthHero, WealthOverview, GoalProgressCard) each catch their own
 * data-fetch error and rendered `null` on failure — meaning the app's own
 * "one screen = one primary purpose" flagship card just silently vanished,
 * with zero visible signal, on a real fetch error. A route-level
 * `error.tsx` can't catch this (the error is already caught internally,
 * never re-thrown), so this is a small, shared inline replacement for
 * `null` on that caught-error path — reused by all three rather than three
 * bespoke JSX blocks.
 */
export function InlineLoadError({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {message}
      </CardContent>
    </Card>
  );
}
