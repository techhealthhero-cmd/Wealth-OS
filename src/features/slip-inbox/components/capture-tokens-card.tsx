"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createCaptureToken, revokeCaptureToken } from "@/features/slip-inbox/actions";
import type { CaptureTokenSummary } from "@/features/slip-inbox/queries";

function CopyField({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the field is selectable, so long-press copy still works.
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" size="sm" variant="outline" onClick={copy} className="shrink-0">
        {copied ? <Check className="mr-1 size-3.5" aria-hidden="true" /> : <Copy className="mr-1 size-3.5" aria-hidden="true" />}
        {copied ? t("slipInbox.tokens.copied") : t("slipInbox.tokens.copy")}
      </Button>
    </div>
  );
}

/** Profile › ส่งสลิปอัตโนมัติ: the endpoint URL plus the user's connection keys. */
export function CaptureTokensCard({ tokens, endpointUrl }: { tokens: CaptureTokenSummary[]; endpointUrl: string }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [revoking, startRevoke] = useTransition();
  const when = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  function create() {
    startCreate(async () => {
      const res = await createCaptureToken(label.trim() || t("slipInbox.tokens.defaultLabel"));
      if ("token" in res) {
        setNewKey(res.token);
        setLabel("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function revoke(token: CaptureTokenSummary) {
    if (!window.confirm(t("slipInbox.tokens.revokeConfirm").replace("{label}", token.label))) return;
    startRevoke(async () => {
      const res = await revokeCaptureToken(token.id);
      if (res.success) {
        toast.success(t("slipInbox.tokens.revoked"));
        router.refresh();
      } else toast.error(res.error ?? t("slipInbox.saveFailed"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" aria-hidden="true" />
          {t("slipInbox.tokens.keysTitle")}
        </CardTitle>
        <CardDescription>{t("slipInbox.tokens.keysHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("slipInbox.tokens.endpointTitle")}</p>
          <CopyField value={endpointUrl} label={t("slipInbox.tokens.endpointTitle")} />
        </div>

        {newKey ? (
          <div className="space-y-1.5 rounded-xl border border-amber-400/70 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold">{t("slipInbox.tokens.newKeyTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("slipInbox.tokens.newKeyHint")}</p>
            <CopyField value={newKey} label={t("slipInbox.tokens.newKeyTitle")} />
          </div>
        ) : null}

        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("slipInbox.tokens.none")}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {token.label} <span className="font-mono text-xs text-muted-foreground">…{token.token_hint}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {token.last_used_at
                      ? t("slipInbox.tokens.lastUsed").replace("{when}", when.format(new Date(token.last_used_at)))
                      : t("slipInbox.tokens.neverUsed")}
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" className="shrink-0 text-destructive" disabled={revoking} onClick={() => revoke(token)}>
                  {t("slipInbox.tokens.revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={label}
            maxLength={60}
            placeholder={t("slipInbox.tokens.labelPlaceholder")}
            aria-label={t("slipInbox.tokens.labelPlaceholder")}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="button" onClick={create} disabled={creating} className="w-full shrink-0 sm:w-auto">
            {creating ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" /> : null}
            {creating ? t("slipInbox.tokens.creating") : t("slipInbox.tokens.create")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
