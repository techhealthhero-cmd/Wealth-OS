"use client";

import { useActionState } from "react";

import { updateProfile } from "@/features/profile/actions";
import type { Profile } from "@/types/database";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(updateProfile, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profileForm.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">{t("auth.displayName")}</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferred_language">{t("profileForm.languageLabel")}</Label>
            <Select name="preferred_language" defaultValue={profile.preferred_language}>
              <SelectTrigger id="preferred_language">
                <SelectValue>
                  {(value: string) =>
                    value === "th" ? t("profileForm.languageThai") : t("profileForm.languageEnglish")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="th">{t("profileForm.languageThai")}</SelectItem>
                <SelectItem value="en">{t("profileForm.languageEnglish")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency_code">{t("accounts.currency")}</Label>
            <Input
              id="currency_code"
              name="currency_code"
              defaultValue={profile.currency_code}
              maxLength={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{t("profileForm.timezoneLabel")}</Label>
            <Input id="timezone" name="timezone" defaultValue={profile.timezone} required />
          </div>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state && !state.error ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("profileForm.saved")}</p>
          ) : null}

          <Button type="submit" disabled={isPending}>
            {isPending ? t("common.saving") : t("profileForm.saveChanges")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
