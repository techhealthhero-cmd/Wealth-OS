import type { Metadata } from "next";

import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Reset password — Wealth OS" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
