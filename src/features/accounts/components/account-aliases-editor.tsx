"use client";

import { useEffect, useState } from "react";
import { Mic, Plus, X } from "lucide-react";

import { deleteAccountAlias, getAccountAliases, saveAccountAlias, type AccountAlias } from "@/features/accounts/actions";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "ชื่อเรียกตอนพูด" — the nicknames voice capture understands for one
 * account (account_aliases). Each add/remove saves on its own, so this sits
 * inside the account form without riding its submit.
 */
export function AccountAliasesEditor({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const [aliases, setAliases] = useState<AccountAlias[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAccountAliases()
      .then((rows) => {
        if (!cancelled) setAliases(rows.filter((a) => a.account_id === accountId));
      })
      .catch(() => {
        if (!cancelled) setAliases([]);
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
    const result = await saveAccountAlias(accountId, word, "user");
    setBusy(false);
    const saved = result.alias;
    if (!saved) {
      setError(result.error ?? t("accounts.aliases.saveFailed"));
      return;
    }
    setAliases((prev) => [...(prev ?? []).filter((a) => a.id !== saved.id), saved]);
    setDraft("");
  }

  async function remove(alias: AccountAlias) {
    setError(null);
    setAliases((prev) => (prev ?? []).filter((a) => a.id !== alias.id));
    const result = await deleteAccountAlias(alias.id);
    if (!result.success) {
      setAliases((prev) => [...(prev ?? []), alias]);
      setError(result.error ?? t("accounts.aliases.saveFailed"));
    }
  }

  return (
    <section aria-labelledby={`aliases-${accountId}`} className="space-y-3 rounded-2xl border bg-muted/30 p-4">
      <div>
        <h3 id={`aliases-${accountId}`} className="flex items-center gap-2 text-sm font-semibold">
          <Mic className="size-4 text-primary" aria-hidden="true" />
          {t("accounts.aliases.title")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("accounts.aliases.hint")}</p>
      </div>

      {aliases === null ? null : aliases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("accounts.aliases.empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {aliases.map((alias) => (
            <li
              key={alias.id}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background pr-1 pl-3 text-sm"
            >
              {alias.alias}
              {alias.source === "learned" ? (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{t("accounts.aliases.learned")}</span>
              ) : null}
              <button
                type="button"
                onClick={() => void remove(alias)}
                aria-label={t("accounts.aliases.remove").replace("{alias}", alias.alias)}
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
            // Enter adds the name instead of submitting the whole account form.
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder={t("accounts.aliases.placeholder")}
          aria-label={t("accounts.aliases.add")}
          maxLength={60}
        />
        <Button type="button" size="icon" onClick={() => void add()} disabled={busy || !draft.trim()} aria-label={t("accounts.aliases.add")}>
          <Plus className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {aliases && aliases.length > 0 ? (
        <p className="text-xs text-muted-foreground">{t("accounts.aliases.example").replace("{alias}", aliases[0].alias)}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
