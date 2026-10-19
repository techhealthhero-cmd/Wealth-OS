"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import type { CancelMatch } from "@/lib/capture/subscription-intent";
import {
  cancelRecurringFromCapture,
  findCancelCandidates,
  type CancelCandidate,
  type CancelCandidatesResult,
} from "@/features/capture/actions";

/** Confirmation stays separate from lookup: ambiguity always needs an explicit choice. */
export function SubscriptionCancelPreview({ serviceQuery, match, selectedId, onSelect, onConfirm, saving }: {
  serviceQuery: string;
  match: CancelMatch<CancelCandidate>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const group = useId();
  const items = match.status === "single" ? [match.item] : match.status === "multiple" ? match.candidates : [];
  const item = match.status === "single" ? match.item : items.find((r) => r.id === selectedId);
  return (
    <>
      {match.status === "none" ? (
        <>
          <p>{t("capture.subscription.cancelNone").replace("{query}", serviceQuery)}</p>
          <p className="text-sm text-muted-foreground">{t("capture.subscription.cancelHint")}</p>
          <Link href="/money/recurring" className="text-sm text-primary underline">
            {t("capture.subscription.viewRecurring")}
          </Link>
        </>
      ) : null}
      {match.status === "multiple" ? (
        <fieldset className="space-y-2" disabled={saving}>
          <legend className="mb-2 text-sm font-medium">{t("capture.subscription.cancelPick")}</legend>
          {items.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name={group} checked={selectedId === r.id} onChange={() => onSelect(r.id)} />
              {r.merchant || r.description} · {formatMoneyFromDecimal(r.amount)} / {t(`recurring.frequencies.${r.frequency}`)}
            </label>
          ))}
        </fieldset>
      ) : null}
      {item ? (
        <>
          <p className="font-medium">
            {t("capture.subscription.cancelTitle")
              .replace("{name}", item.merchant || item.description || serviceQuery)
              .replace("{amount}", formatMoneyFromDecimal(item.amount))
              .replace("{frequency}", t(`recurring.frequencies.${item.frequency}`))}
          </p>
          <Button className="min-h-11 w-full" disabled={saving} onClick={onConfirm}>
            {saving ? t("common.saving") : t("capture.subscription.cancelConfirm")}
          </Button>
        </>
      ) : null}
    </>
  );
}

export function SubscriptionCancelCard({ serviceQuery, onCancelled }: { serviceQuery: string; onCancelled: () => void }) {
  const { t } = useTranslation();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [result, setResult] = useState<{ query: string; value: CancelCandidatesResult } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    if (!serviceQuery) return;
    const timer = setTimeout(() => {
      findCancelCandidates(serviceQuery).then((value) => {
        if (current) setResult({ query: serviceQuery, value });
      }).catch(() => {
        if (current) setResult({ query: serviceQuery, value: { error: t("capture.subscription.cancelFailed") } });
      });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [serviceQuery, retry, t]);
  const value = result?.query === serviceQuery ? result.value : null;
  const match = value?.match;
  const item = match?.status === "single" ? match.item
    : match?.status === "multiple" ? match.candidates.find((r) => r.id === picked) : null;

  async function confirm() {
    if (!item || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await cancelRecurringFromCapture(item.id);
      if (!res.success) setError(res.error ?? t("capture.subscription.cancelFailed"));
      else {
        toast.success(t("capture.subscription.cancelled"));
        if (mounted.current) onCancelled();
      }
    } catch {
      setError(t("capture.subscription.cancelFailed"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4" aria-live="polite">
      {!serviceQuery ? <p>{t("capture.subscription.cancelEmpty")}</p>
        : !value ? <p>{t("capture.subscription.cancelLoading")}</p> : null}
      {value?.error ? (
        <>
          <p role="alert">{value.error}</p>
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>{t("capture.subscription.retry")}</Button>
        </>
      ) : null}
      {match ? (
        <SubscriptionCancelPreview serviceQuery={serviceQuery} match={match} selectedId={picked}
          onSelect={setPicked} onConfirm={() => void confirm()} saving={saving} />
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
