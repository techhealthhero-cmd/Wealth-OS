"use client";

import { useActionState, useState } from "react";
import {
  Bot,
  Eye,
  EyeOff,
  Gauge,
  Gem,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Target,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n/client";
import type { AccountPrivacyDisplayStyle } from "@/types/database";
import {
  configureAccountPrivacy,
  lockAccountPrivacy,
  unlockAccountPrivacy,
} from "../actions";
import type { AccountPrivacyState } from "../types";

const DISPLAY_STYLES: AccountPrivacyDisplayStyle[] = ["blur", "unavailable", "empty", "custom"];

export function AccountPrivacySettingsCard({ privacy }: { privacy: AccountPrivacyState }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(privacy.enabled);
  const [protectAccounts, setProtectAccounts] = useState(privacy.protectAccounts);
  const [protectAssets, setProtectAssets] = useState(privacy.protectAssets);
  const [protectOverview, setProtectOverview] = useState(privacy.protectOverview);
  const [protectActivity, setProtectActivity] = useState(privacy.protectActivity);
  const [protectPlanning, setProtectPlanning] = useState(privacy.protectPlanning);
  const [protectInsights, setProtectInsights] = useState(privacy.protectInsights);
  const [displayStyle, setDisplayStyle] = useState<AccountPrivacyDisplayStyle>(privacy.displayStyle);
  const [settingsState, settingsAction, isSaving] = useActionState(configureAccountPrivacy, undefined);
  const [unlockState, unlockAction, isUnlocking] = useActionState(unlockAccountPrivacy, undefined);

  if (privacy.enabled && !privacy.isUnlocked) {
    return (
      <Card variant="soft">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle>{t("accountPrivacy.lockedCenterTitle")}</CardTitle>
              <CardDescription>{t("accountPrivacy.lockedCenterDescription")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form action={unlockAction} className="space-y-3">
            <Input
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="••••••"
              aria-label={t("accountPrivacy.currentPin")}
              className="bg-card text-center font-mono tracking-[0.4em]"
              required
            />
            {unlockState?.error ? <p role="alert" className="text-sm text-destructive">{unlockState.error}</p> : null}
            <Button type="submit" variant="outline" className="w-full bg-card" disabled={isUnlocking}>
              <ShieldCheck aria-hidden="true" />
              {isUnlocking ? t("common.loading") : t("accountPrivacy.verifyToManage")}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const scopeOptions = [
    { key: "accounts", checked: protectAccounts, set: setProtectAccounts, icon: WalletCards },
    { key: "assets", checked: protectAssets, set: setProtectAssets, icon: Gem },
    { key: "overview", checked: protectOverview, set: setProtectOverview, icon: Gauge },
    { key: "activity", checked: protectActivity, set: setProtectActivity, icon: ReceiptText },
    { key: "planning", checked: protectPlanning, set: setProtectPlanning, icon: Target },
    { key: "insights", checked: protectInsights, set: setProtectInsights, icon: Bot },
  ] as const;

  function applyStandardPreset() {
    setEnabled(true);
    setProtectAccounts(true);
    setProtectAssets(true);
    setProtectOverview(false);
    setProtectActivity(false);
    setProtectPlanning(false);
    setProtectInsights(false);
  }

  function applyPublicPreset() {
    setEnabled(true);
    setProtectAccounts(true);
    setProtectAssets(true);
    setProtectOverview(true);
    setProtectActivity(true);
    setProtectPlanning(true);
    setProtectInsights(true);
  }

  return (
    <Card variant="soft">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle>{t("accountPrivacy.title")}</CardTitle>
              <CardDescription>{t("accountPrivacy.description")}</CardDescription>
            </div>
          </div>
          <Badge variant={privacy.enabled ? "default" : "outline"} className="shrink-0">
            {privacy.enabled ? t("accountPrivacy.active") : t("accountPrivacy.inactive")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={settingsAction} className="space-y-4">
          <input type="hidden" name="enabled" value={enabled ? "true" : "false"} />
          <input type="hidden" name="protect_accounts" value={protectAccounts ? "true" : "false"} />
          <input type="hidden" name="protect_assets" value={protectAssets ? "true" : "false"} />
          <input type="hidden" name="protect_overview" value={protectOverview ? "true" : "false"} />
          <input type="hidden" name="protect_activity" value={protectActivity ? "true" : "false"} />
          <input type="hidden" name="protect_planning" value={protectPlanning ? "true" : "false"} />
          <input type="hidden" name="protect_insights" value={protectInsights ? "true" : "false"} />

          <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
            <Checkbox
              id="account_privacy_enabled"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor="account_privacy_enabled" className="min-w-0 cursor-pointer font-normal">
              <span className="block font-medium text-foreground">{t("accountPrivacy.enabled")}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {t("accountPrivacy.enabledDescription")}
              </span>
            </Label>
          </div>

          <fieldset className="space-y-2" disabled={!enabled}>
            <legend className="text-sm font-medium">{t("accountPrivacy.protectedSections")}</legend>
            <p className="text-xs text-muted-foreground">{t("accountPrivacy.protectedSectionsDescription")}</p>
            <div className="grid grid-cols-2 gap-2 py-1">
              <Button type="button" variant="outline" size="sm" onClick={applyStandardPreset} disabled={!enabled}>
                {t("accountPrivacy.presets.standard")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={applyPublicPreset} disabled={!enabled}>
                {t("accountPrivacy.presets.public")}
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {scopeOptions.map(({ key, checked, set, icon: Icon }) => (
                <div key={key} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                  <Checkbox
                    id={`privacy_protect_${key}`}
                    checked={checked}
                    onCheckedChange={(value) => set(value === true)}
                    disabled={!enabled}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`privacy_protect_${key}`} className="min-w-0 cursor-pointer font-normal">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className="size-4 text-primary" aria-hidden="true" />
                      {t(`accountPrivacy.sections.${key}`)}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {t(`accountPrivacy.sections.${key}Description`)}
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="account_privacy_style">{t("accountPrivacy.displayStyle")}</Label>
            <Select
              name="display_style"
              value={displayStyle}
              onValueChange={(value) => value && setDisplayStyle(value as AccountPrivacyDisplayStyle)}
            >
              <SelectTrigger id="account_privacy_style" className="w-full bg-card">
                <SelectValue>{(value: string) => t(`accountPrivacy.styles.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DISPLAY_STYLES.map((style) => (
                  <SelectItem key={style} value={style}>{t(`accountPrivacy.styles.${style}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {displayStyle === "custom" ? (
            <div className="space-y-2">
              <Label htmlFor="account_privacy_message">{t("accountPrivacy.customMessage")}</Label>
              <Textarea
                id="account_privacy_message"
                name="custom_message"
                defaultValue={privacy.customMessage ?? ""}
                placeholder={t("accountPrivacy.customMessagePlaceholder")}
                maxLength={80}
                className="bg-card"
              />
            </div>
          ) : (
            <input type="hidden" name="custom_message" value={privacy.customMessage ?? ""} />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account_privacy_pin">
                {privacy.pinConfigured ? t("accountPrivacy.currentPin") : t("accountPrivacy.newPin")}
              </Label>
              <Input
                id="account_privacy_pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="••••••"
                className="bg-card font-mono tracking-[0.35em]"
              />
            </div>
            {!privacy.pinConfigured ? (
              <div className="space-y-2">
                <Label htmlFor="account_privacy_pin_confirmation">{t("accountPrivacy.confirmPin")}</Label>
                <Input
                  id="account_privacy_pin_confirmation"
                  name="pin_confirmation"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="••••••"
                  className="bg-card font-mono tracking-[0.35em]"
                />
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("accountPrivacy.pinHint")}</p>

          {settingsState?.error ? <p role="alert" className="text-sm text-destructive">{settingsState.error}</p> : null}
          {settingsState?.success ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("accountPrivacy.saved")}</p> : null}

          <Button type="submit" className="w-full" disabled={isSaving}>
            <ShieldCheck aria-hidden="true" />
            {isSaving ? t("common.saving") : t("accountPrivacy.save")}
          </Button>
        </form>

        {privacy.enabled ? (
          <div className="space-y-3 border-t border-primary/10 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
                {privacy.isUnlocked ? <Eye className="size-4" aria-hidden="true" /> : <LockKeyhole className="size-4" aria-hidden="true" />}
              </div>
              <div>
                <p className="font-medium">
                  {privacy.isUnlocked ? t("accountPrivacy.unlocked") : t("accountPrivacy.unlockTitle")}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {privacy.isUnlocked ? t("accountPrivacy.securityNote") : t("accountPrivacy.unlockDescription")}
                </p>
              </div>
            </div>

            {privacy.isUnlocked ? (
              <form action={lockAccountPrivacy}>
                <Button type="submit" variant="outline" className="w-full bg-card">
                  <EyeOff aria-hidden="true" />
                  {t("accountPrivacy.lockNow")}
                </Button>
              </form>
            ) : (
              <form action={unlockAction} className="space-y-3">
                <Input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="••••••"
                  aria-label={t("accountPrivacy.currentPin")}
                  className="bg-card text-center font-mono tracking-[0.4em]"
                  required
                />
                {unlockState?.error ? <p role="alert" className="text-sm text-destructive">{unlockState.error}</p> : null}
                <Button type="submit" variant="outline" className="w-full bg-card" disabled={isUnlocking}>
                  <Eye aria-hidden="true" />
                  {isUnlocking ? t("common.loading") : t("accountPrivacy.unlock")}
                </Button>
              </form>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
