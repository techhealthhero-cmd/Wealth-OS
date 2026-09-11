import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Sparkles, Target, TrendingUp } from "lucide-react";

import { getCurrentUser } from "@/features/profile/queries";
import { Button } from "@/components/ui/button";
import { BrandMark, IllustrationFrame, WelcomeIllustration } from "@/components/illustrations";

const PILLARS = [
  { icon: Eye, label: "Track" },
  { icon: Target, label: "Plan" },
  { icon: TrendingUp, label: "Earn" },
  { icon: Sparkles, label: "Grow" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <div className="flex items-center gap-2 text-2xl font-semibold text-primary">
        <BrandMark size={32} />
        <span className="text-foreground">Wealth OS</span>
      </div>

      <IllustrationFrame size={220} className="-my-2">
        <WelcomeIllustration size={160} />
      </IllustrationFrame>

      <div className="max-w-md space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your money, finally organized.
        </h1>
        <p className="text-muted-foreground">
          Track accounts, transactions, and cash flow in one clean, trustworthy place.
        </p>
      </div>
      <div className="flex gap-3">
        <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
          Get started
        </Button>
        <Button variant="outline" size="lg" nativeButton={false} render={<Link href="/login" />}>
          Log in
        </Button>
      </div>

      <ol
        className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 sm:gap-x-6"
        aria-label="Track, Plan, Earn, Grow"
      >
        {PILLARS.map((pillar, index) => (
          <li key={pillar.label} className="flex items-center gap-2 sm:gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
                <pillar.icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{pillar.label}</span>
            </div>
            {index < PILLARS.length - 1 ? (
              <span className="text-muted-foreground/40" aria-hidden="true">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </main>
  );
}
