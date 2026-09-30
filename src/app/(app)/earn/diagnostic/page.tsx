import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DiagnosticFlowLoader } from "@/features/earn/components/v2/diagnostic-flow-loader";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default async function EarnDiagnosticPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Draft key is per user so a shared device never mixes two people's answers.
  return <DiagnosticFlowLoader draftKey={`wealthos.earn.diagnostic.v1.${user.id}`} />;
}
