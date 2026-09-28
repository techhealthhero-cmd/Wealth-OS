"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "@/i18n/client";
import { getAiOverlayData, type AiOverlayData } from "@/features/ai/actions/get-overlay-data";
import { AICoachChat } from "./ai-coach-chat";

/**
 * Requested: the floating AI button should open like a chat widget on top
 * of the current page instead of navigating away to the full /ai page —
 * "หน้าต่างลอยขึ้นมา" (a floating window), landing on a bottom sheet as the
 * closest existing pattern in this app.
 *
 * Deliberately just the chat itself, not the full /ai page's surrounding
 * cards (financial snapshot, next-best-action, insights, monthly health
 * check) — those assume a full page's worth of space and are still one tap
 * away on /ai; a floating widget opened from anywhere is meant to be quick
 * ask-anything access, not a second copy of the dashboard.
 *
 * Data is fetched lazily via getAiOverlayData() only once actually opened
 * (see that action's own doc comment for why), not passed down from
 * (app)/layout.tsx — most page views never open this.
 *
 * Known limitation: AICoachChat's "stop auto-scrolling once the user
 * scrolls up mid-reply" behavior is based on `window.scroll`, which this
 * sheet's own internal scroll container doesn't trigger — inside the
 * overlay it just always stays following the latest message. Not a
 * functional break (the chat still works, sends, and streams correctly),
 * just a smaller nicety that only really matters on very long replies.
 */
export function AiAssistantSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiOverlayData | null>(null);

  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    getAiOverlayData().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* `!h-[85vh]` (important) is deliberate, not decoration: SheetContent's
          own `data-[side=bottom]:h-auto` is a data-attribute selector, more
          specific than a plain height utility, so a bare `h-[85vh]` here
          silently lost to it — confirmed locally (the sheet grew to fit all
          of AICoachChat's content, taller than the viewport, pushing the
          header above the visible screen entirely). `!` forces this to win
          regardless of that specificity difference. */}
      <SheetContent side="bottom" className="!h-[85vh] flex flex-col p-0 sm:max-w-none">
        <SheetHeader className="flex-row items-center justify-between border-b pr-12">
          <SheetTitle>{t("aiCoach.title")}</SheetTitle>
          {/* The overlay is deliberately just the chat (see doc comment
              above) — this is the way back to the full /ai page's extra
              cards (snapshot, insights, health check) for anyone who wants
              them. */}
          <Link
            href="/ai"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />
            {t("aiCoach.openFullPage")}
          </Link>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {data ? (
            <AICoachChat
              initialConversationId={data.initialConversationId}
              initialMessages={data.initialMessages}
              historyEnabled={data.historyEnabled}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
