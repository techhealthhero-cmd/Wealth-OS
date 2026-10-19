"use client";

import { useId } from "react";
import type { Account } from "@/types/database";
import type { CaptureDraft } from "@/lib/capture/draft";
import { useTranslation } from "@/i18n/client";
import { AccountPicker } from "@/features/transactions/components/account-picker";

/** Shared by text preview, recap and voice notebook. Undefined toggle means ON. */
export function SubscriptionFields({ draft, accounts, onChange }: {
  draft: CaptureDraft;
  accounts: Account[];
  onChange: (patch: Partial<CaptureDraft>) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  if (!draft.subscription || draft.type !== "expense") return null;
  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <p className="text-xs font-medium">
        {t("capture.subscription.label")} · {t(`capture.subscription.${draft.subscription.frequency}`)}
        {draft.subscription.serviceName ? ` · ${draft.subscription.serviceName}` : ""}
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-5 shrink-0 accent-[var(--primary)]"
          checked={draft.addRecurring !== false} onChange={(e) => onChange({ addRecurring: e.target.checked })} />
        {t("capture.subscription.addRecurring")}
      </label>
      {draft.subscriptionAccountMissing ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("capture.subscription.chooseAccount")}</p>
          <AccountPicker name={`subscription-account-${id}`} accounts={accounts.filter((a) => !a.is_archived)}
            value={undefined} onValueChange={(accountId) => {
              if (accountId) onChange({ accountId, subscriptionAccountMissing: false });
            }} />
        </div>
      ) : null}
    </div>
  );
}
