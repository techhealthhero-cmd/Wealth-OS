"use client";

import { useEffect, useId } from "react";
import { Minus, X } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { useMinimizableForm } from "./minimizable-form-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MinimizableFormShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * A custom modal shell — deliberately NOT built on the shadcn `Dialog`/
 * `Sheet` primitives (see minimizable-form-context.tsx's doc comment for
 * why: Base UI's Dialog unmounts its content on close, which would lose
 * whatever the user had typed). Visually matches `Dialog` (same classes,
 * copied from src/components/ui/dialog.tsx) so a form adopting this shell
 * looks identical to before.
 *
 * Escape and backdrop click both MINIMIZE rather than close — this
 * component's whole purpose is to never silently discard a draft the
 * ordinary way a modal would. The header's explicit "X" is the only close
 * action, matching the close behavior the retrofitted form already had.
 *
 * Known, deliberate simplification: basic aria-modal/labelledby semantics,
 * not a full keyboard focus trap — reasonable for this first pass of new,
 * carefully-scoped infrastructure rather than a wholesale a11y rewrite.
 */
export function MinimizableFormShell({ title, onClose, children, className }: MinimizableFormShellProps) {
  const { minimize, minimized } = useMinimizableForm();
  const { t } = useTranslation();
  const titleId = useId();

  useEffect(() => {
    if (minimized) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [minimized]);

  useEffect(() => {
    if (minimized) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") minimize();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [minimized, minimize]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        onClick={minimize}
        className="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs"
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p id={titleId} className="font-heading text-base leading-tight font-medium">
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("common.minimizeForm")}
              onClick={minimize}
            >
              <Minus aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.close")} onClick={onClose}>
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
