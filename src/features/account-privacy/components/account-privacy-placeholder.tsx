import { CircleSlash2, CloudOff, EyeOff, Gem, WalletCards } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AccountPrivacyState } from "../types";

export function AccountPrivacyPlaceholder({
  privacy,
  copy,
  section = "accounts",
}: {
  privacy: AccountPrivacyState;
  copy: Dictionary["accountPrivacy"];
  section?: "accounts" | "assets" | "generic";
}) {
  const isAssets = section === "assets";
  const isGeneric = section === "generic";
  const blurMessage = isGeneric ? copy.genericProtectedTitle : isAssets ? copy.assetBlurMessage : copy.blurMessage;
  const blurDescription = isGeneric
    ? copy.genericProtectedDescription
    : isAssets
      ? copy.assetBlurDescription
      : copy.blurDescription;

  if (privacy.displayStyle === "blur") {
    return (
      <div className="relative space-y-3 overflow-hidden rounded-2xl" aria-label={blurMessage}>
        <div className="space-y-3 blur-[7px] select-none" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item}>
              <CardContent className="flex items-center justify-between gap-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-3 w-28 rounded-full bg-foreground/35" />
                    <div className="h-2.5 w-20 rounded-full bg-foreground/15" />
                  </div>
                </div>
                <div className="h-4 w-24 rounded-full bg-foreground/30" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[2px]">
          <div className="mx-6 rounded-2xl border bg-card/95 px-6 py-5 text-center shadow-lg">
            <EyeOff className="mx-auto size-7 text-primary" aria-hidden="true" />
            <p className="mt-3 font-heading font-semibold">{blurMessage}</p>
            <p className="mt-1 text-sm text-muted-foreground">{blurDescription}</p>
          </div>
        </div>
      </div>
    );
  }

  const presentation = privacy.displayStyle === "unavailable"
    ? {
        icon: CloudOff,
        title: isGeneric ? copy.genericUnavailableTitle : isAssets ? copy.assetUnavailableTitle : copy.unavailableTitle,
        description: isGeneric
          ? copy.genericUnavailableDescription
          : isAssets
            ? copy.assetUnavailableDescription
            : copy.unavailableDescription,
      }
    : privacy.displayStyle === "empty"
      ? {
          icon: isAssets ? Gem : WalletCards,
          title: isGeneric ? copy.genericEmptyTitle : isAssets ? copy.assetEmptyTitle : copy.emptyTitle,
          description: isGeneric ? copy.genericEmptyDescription : isAssets ? copy.assetEmptyDescription : copy.emptyDescription,
        }
      : { icon: CircleSlash2, title: privacy.customMessage || copy.customFallback, description: null };
  const Icon = presentation.icon;

  return (
    <Card>
      <CardContent className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <h2 className="mt-5 font-heading text-lg font-semibold">{presentation.title}</h2>
        {presentation.description ? (
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{presentation.description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
