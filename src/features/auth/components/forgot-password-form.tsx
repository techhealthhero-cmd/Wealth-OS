"use client";

import { useActionState } from "react";
import Link from "next/link";

import { forgotPassword } from "@/features/auth/actions";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(forgotPassword, undefined);
  const submitted = state !== undefined && !state.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.resetPassword")}</CardTitle>
        <CardDescription>{t("auth.forgotPasswordSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <p className="text-sm text-muted-foreground">{t("auth.resetLinkSentMessage")}</p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
