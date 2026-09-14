import Link from "next/link";

import { LockedBadge } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface LockedFeatureCardProps {
  title: string;
  description: string;
  ctaLabel: string;
}

/**
 * Contextual paywall (Day 7 STEP 11) — replaces a gated page's real content
 * when the signed-in user's plan lacks the feature. First real use of
 * `LockedBadge` (previously built in GRAPHICS_PLAN.md's icon set but never
 * wired to any page). Deliberately a single inline card, not a full-screen
 * modal/interstitial — "avoid dark patterns... do not repeatedly block
 * users with full-screen upgrade modals."
 */
export function LockedFeatureCard({ title, description, ctaLabel }: LockedFeatureCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <LockedBadge size={56} />
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        <Button nativeButton={false} render={<Link href="/pricing" />} size="sm">
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
