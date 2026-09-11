import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { OnboardingForm } from "@/features/profile/components/onboarding-form";
import { IllustrationFrame, WelcomeIllustration } from "@/components/illustrations";

export const metadata: Metadata = { title: "Welcome — Wealth OS" };

export default async function OnboardingPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 py-12">
      <IllustrationFrame size={170}>
        <WelcomeIllustration size={130} />
      </IllustrationFrame>
      <div className="w-full max-w-md">
        <OnboardingForm defaultDisplayName={profile.display_name} />
      </div>
    </div>
  );
}
