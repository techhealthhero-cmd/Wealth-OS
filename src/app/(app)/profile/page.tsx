import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { ProfileForm } from "@/features/profile/components/profile-form";

export const metadata: Metadata = { title: "Profile — Wealth OS" };

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-lg">
      <ProfileForm profile={profile} />
    </div>
  );
}
