import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/profile/queries";
import { logNav } from "@/lib/dev-diagnostics";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/illustrations";
import { Artwork } from "@/components/shared/artwork";

// The closed green planner from Codex's transparent splash master (2026-10-18,
// scripts/artwork/crop-brand-art.mjs) — the same journal the app opens into.
const BRAND_PLANNER = "/artwork/brand/planner-cutout.webp";

// Hand-drawn gouache pillars (2026-10-15), cut from the onboarding pillars
// sheet by scripts/artwork/crop-pillar-art.mjs.
const PILLARS = [
  { art: "/artwork/pillars/track.webp", label: "Track" },
  { art: "/artwork/pillars/plan.webp", label: "Plan" },
  { art: "/artwork/pillars/earn.webp", label: "Earn" },
  { art: "/artwork/pillars/grow.webp", label: "Grow" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    logNav({ from: "/", to: "/dashboard", reason: "already signed in", source: "app/page.tsx" });
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <div className="flex items-center gap-2 text-2xl font-semibold text-primary">
        <BrandMark size={32} />
        <span className="text-foreground">Wealth OS</span>
      </div>

      <Artwork src={BRAND_PLANNER} square priority className="-my-2 w-48 drop-shadow-[0_10px_14px_rgba(30,18,6,0.22)] sm:w-56" />

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
        className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-3 sm:gap-x-4"
        aria-label="Track, Plan, Earn, Grow"
      >
        {PILLARS.map((pillar, index) => (
          <li key={pillar.label} className="flex items-center gap-1.5 sm:gap-4">
            <div className="flex flex-col items-center gap-1.5">
              {/* Plain <img>: small pre-sized local WebP, like CategoryIcon. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pillar.art}
                alt=""
                aria-hidden="true"
                width={128}
                height={128}
                decoding="async"
                draggable={false}
                className="size-14 select-none sm:size-20"
              />
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
