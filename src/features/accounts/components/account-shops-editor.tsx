"use client";

import { useEffect, useState } from "react";
import { Plus, Store, X } from "lucide-react";

import {
  deleteMerchantAccountPreference,
  getMerchantAccountPreferences,
  saveMerchantAccountPreference,
  type MerchantAccountPref,
} from "@/features/accounts/actions";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "ซื้อที่ร้านเหล่านี้ จ่ายจากบัญชีนี้" — shops whose purchases are paid
 * from this account (merchant_account_preferences), e.g. 7-Eleven → the
 * 7-Eleven wallet. Each add/remove saves on its own, like the nicknames list.
 */
export function AccountShopsEditor({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const [shops, setShops] = useState<MerchantAccountPref[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMerchantAccountPreferences()
      .then((rows) => {
        if (!cancelled) setShops(rows.filter((s) => s.account_id === accountId));
      })
      .catch(() => {
        if (!cancelled) setShops([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  async function add() {
    const word = draft.trim();
    if (!word || busy) return;
    setBusy(true);
    setError(null);
    const result = await saveMerchantAccountPreference(accountId, word, "user");
    setBusy(false);
    const saved = result.pref;
    if (!saved) {
      setError(result.error ?? t("accounts.shops.saveFailed"));
      return;
    }
    setShops((prev) => [...(prev ?? []).filter((s) => s.id !== saved.id), saved]);
    setDraft("");
  }

  async function remove(shop: MerchantAccountPref) {
    setError(null);
    setShops((prev) => (prev ?? []).filter((s) => s.id !== shop.id));
    const result = await deleteMerchantAccountPreference(shop.id);
    if (!result.success) {
      setShops((prev) => [...(prev ?? []), shop]);
      setError(result.error ?? t("accounts.shops.saveFailed"));
    }
  }

  return (
    <section aria-labelledby={`shops-${accountId}`} className="space-y-3 rounded-2xl border bg-muted/30 p-4">
      <div>
        <h3 id={`shops-${accountId}`} className="flex items-center gap-2 text-sm font-semibold">
          <Store className="size-4 text-primary" aria-hidden="true" />
          {t("accounts.shops.title")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("accounts.shops.hint")}</p>
      </div>

      {shops === null ? null : shops.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("accounts.shops.empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {shops.map((shop) => (
            <li key={shop.id} className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background pr-1 pl-3 text-sm">
              {shop.merchant_label}
              {shop.source === "learned" ? (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{t("accounts.aliases.learned")}</span>
              ) : null}
              <button
                type="button"
                onClick={() => void remove(shop)}
                aria-label={t("accounts.shops.remove").replace("{shop}", shop.merchant_label)}
                className="flex size-7 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the shop instead of submitting the whole account form.
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder={t("accounts.shops.placeholder")}
          aria-label={t("accounts.shops.add")}
          maxLength={120}
        />
        <Button type="button" size="icon" onClick={() => void add()} disabled={busy || !draft.trim()} aria-label={t("accounts.shops.add")}>
          <Plus className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
