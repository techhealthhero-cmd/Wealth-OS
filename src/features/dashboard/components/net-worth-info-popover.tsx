"use client";

import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { asTrigger } from "@/lib/as-trigger";

/**
 * The whole hero card is a ClickableCard (net-worth-hero.tsx) — `data-stop-
 * navigation` here is what that outer click handler checks via closest() to
 * exclude a tap on this info icon from also navigating the card. (A plain
 * `<Link>` + stopPropagation on the trigger's own onClick was tried first:
 * Base UI's `render` prop merges/overrides a supplied element's props with
 * its own internal handlers, so the caller-supplied stopPropagation handler
 * was silently dropped and the Link still navigated — confirmed via a live
 * Playwright click test.)
 */
export function NetWorthInfoPopover({ label, explanation, tone }: { label: string; explanation: string; tone: "on-dark" | "default" }) {
  return (
    <span data-stop-navigation className="inline-flex">
      <Popover>
        <PopoverTrigger
          {...asTrigger(
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={label}
              className={tone === "on-dark" ? "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground" : "text-muted-foreground"}
            >
              <Info aria-hidden="true" />
            </Button>
          )}
        />
        {/* PopoverContent renders via a portal (outside this card's real DOM
            subtree) — its own data-stop-navigation is needed too, since a
            tap inside the open bubble wouldn't otherwise be found by the
            outer ClickableCard's closest() search from that portaled
            location. */}
        <PopoverContent data-stop-navigation>{explanation}</PopoverContent>
      </Popover>
    </span>
  );
}
