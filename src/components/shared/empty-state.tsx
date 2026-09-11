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
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      {"illustration" in visual && visual.illustration ? (
        <IllustrationFrame size={180}>{visual.illustration}</IllustrationFrame>
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {"icon" in visual && visual.icon ? (
            <visual.icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          ) : null}
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
