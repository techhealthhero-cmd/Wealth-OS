import type { LucideIcon } from "lucide-react";

import { IllustrationFrame } from "@/components/illustrations";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
} & (
  | { icon: LucideIcon; illustration?: never }
  | { icon?: never; illustration: React.ReactNode }
);

export function EmptyState({ title, description, action, ...visual }: EmptyStateProps) {
  return (
    // Mobile overflow fix (real-device iPhone finding, 2026-09): this is a
    // `flex-col items-center` container, so its children are sized by
    // shrink-to-fit/fit-content, not stretched to the container's actual
    // available width. The text wrapper below previously relied on that
    // fit-content sizing to keep a `max-w-sm` (384px — wider than a 375px
    // viewport on its own) paragraph within bounds; `w-full` on the
    // wrapper removes that ambiguity entirely by giving the paragraph a
    // real 100%-of-parent block width to wrap within, instead of asking
    // flex sizing to get it right implicitly.
    <div className="flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-16 text-center">
      {"illustration" in visual && visual.illustration ? (
        <IllustrationFrame size={180}>{visual.illustration}</IllustrationFrame>
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
          {"icon" in visual && visual.icon ? (
            <visual.icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          ) : null}
        </div>
      )}
      <div className="w-full min-w-0 max-w-sm space-y-1">
        <p className="break-words font-medium">{title}</p>
        {description ? (
          <p className="w-full break-words text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
