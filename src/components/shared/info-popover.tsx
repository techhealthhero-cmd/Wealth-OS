"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Artwork } from "@/components/shared/artwork";
import { asTrigger } from "@/lib/as-trigger";
import { cn } from "@/lib/utils";

/**
 * Generic "what is this?" info bubble for a section/page header — same
 * Popover + Info-icon pattern net-worth-info-popover.tsx pioneered, extracted
 * here since it isn't specific to the Net Worth card (no ClickableCard to
 * guard against, no on-dark tone variant needed).
 */
export function InfoPopover({ label, explanation, className }: { label: string; explanation: ReactNode; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        {...asTrigger(
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className={cn("text-muted-foreground", className)}
          >
            <Info aria-hidden="true" />
          </Button>
        )}
      />
      <PopoverContent>
        {/* Hand-drawn busy page turned into clear cards — "here's what this means" (2026-10-15). */}
        <Artwork src="/artwork/ai/explain.webp" square className="mb-1 size-12" />
        {explanation}
      </PopoverContent>
    </Popover>
  );
}
