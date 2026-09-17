"use client";

import { useActionState } from "react";

import { completeOnboarding } from "@/features/profile/actions";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STARTING_ACCOUNT_TYPES = ["cash", "bank"] as const;

export function OnboardingForm({ defaultDisplayName }: { defaultDisplayName?: string | null }) {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(completeOnboarding, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("onboarding.welcome")}</CardTitle>
        <CardDescription>{t("onboarding.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">{t("onboarding.nameLabel")}</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={defaultDisplayName ?? ""}
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">{t("onboarding.accountSectionTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("onboarding.accountSectionHint")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="starting_account_type">{t("onboarding.accountTypeLabel")}</Label>
                <Select name="starting_account_type" defaultValue="cash">
                  <SelectTrigger id="starting_account_type">
                    <SelectValue>{(value: string) => t(`accounts.types.${value}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STARTING_ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`accounts.types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="starting_balance">{t("onboarding.balanceLabel")}</Label>
                <Input id="starting_balance" name="starting_balance" type="number" step="any" />
              </div>
            </div>
          </div>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("onboarding.finishing") : t("onboarding.finish")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
