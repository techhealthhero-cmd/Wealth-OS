"use client";

import { useActionState } from "react";

import { updateProfile } from "@/features/profile/actions";
import type { Profile } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PROFILE_CURRENCY_CODES,
  PROFILE_TIMEZONES,
  isProfileCurrencyCode,
  isProfileTimezone,
  timezoneLabelKey,
} from "@/lib/validation/profile-options";
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

  // A value saved before these lists existed is shown as an extra option
  // (raw value as its label) so the form never silently drops it.
  const legacyCurrency = isProfileCurrencyCode(profile.currency_code) ? null : profile.currency_code;
  const legacyTimezone = isProfileTimezone(profile.timezone) ? null : profile.timezone;

  const currencyLabel = (code: string) =>
    isProfileCurrencyCode(code) ? `${code} — ${t(`profileForm.currencies.${code}`)}` : code;
  const timezoneLabel = (zone: string) =>
    isProfileTimezone(zone) ? t(timezoneLabelKey(zone)) : zone;

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
            <Select name="currency_code" defaultValue={profile.currency_code}>
              <SelectTrigger id="currency_code" className="w-full">
                <SelectValue className="leading-relaxed">
                  {(value: string) => currencyLabel(value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {PROFILE_CURRENCY_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {currencyLabel(code)}
                  </SelectItem>
                ))}
                {legacyCurrency ? (
                  <SelectItem value={legacyCurrency}>{legacyCurrency}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{t("profileForm.timezoneLabel")}</Label>
            <Select name="timezone" defaultValue={profile.timezone}>
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue className="leading-relaxed">
                  {(value: string) => timezoneLabel(value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {PROFILE_TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {timezoneLabel(zone)}
                  </SelectItem>
                ))}
                {legacyTimezone ? (
                  <SelectItem value={legacyTimezone}>{legacyTimezone}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
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
