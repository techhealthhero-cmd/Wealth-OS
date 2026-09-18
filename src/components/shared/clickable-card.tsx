"use client";

import { useRouter } from "next/navigation";

/**
 * A card whose whole surface navigates on click/Enter — except any
 * descendant marked `data-stop-navigation` (e.g. a nested popover trigger),
 * which is excluded via a closest() check on the click target rather than
 * relying on event.stopPropagation() at the nested element. Tried that
 * first with a real `<Link>` wrapper: Base UI's `render` prop merges/
 * overrides a supplied element's own onClick with its internal handler, so
 * a caller-supplied stopPropagation handler on the nested trigger was
 * silently dropped and the Link still navigated (confirmed via a live
 * Playwright click test). Checking the target at the OUTER handler instead
 * doesn't depend on what the nested library does with props internally.
 *
 * Not a real `<a>`, so native middle-click/"open in new tab" doesn't work
 * here — role="link" + Enter-key handling keeps it a real, focusable,
 * keyboard-operable target instead.
 */
export function ClickableCard({
  href,
  children,
  className,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();

  function handleActivate(e: React.MouseEvent | React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("[data-stop-navigation]")) return;
    router.push(href);
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      className={className}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleActivate(e);
      }}
    >
      {children}
    </div>
  );
}
