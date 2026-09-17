"use client";

import { useActionState } from "react";
import Link from "next/link";

import { login, signInWithGoogle } from "@/features/auth/actions";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ callbackError }: { callbackError?: string }) {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(login, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.login")}</CardTitle>
        <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {callbackError ? (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {callbackError}
          </p>
        ) : null}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:underline">
                {t("auth.forgotPassword")}
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("auth.loggingIn") : t("auth.login")}
          </Button>
        </form>

        <div className="mt-4">
          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full">
              {t("auth.signInWithGoogle")}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-medium text-foreground hover:underline">
            {t("auth.signup")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
