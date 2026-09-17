"use client";

import { useActionState } from "react";

import { resetPassword } from "@/features/auth/actions";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetPasswordForm() {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(resetPassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.newPasswordTitle")}</CardTitle>
        <CardDescription>{t("auth.newPasswordSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.newPasswordLabel")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">{t("auth.confirmPassword")}</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("common.saving") : t("auth.saveNewPassword")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
