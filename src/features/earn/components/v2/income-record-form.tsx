"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordEarnIncome } from "@/features/earn/v2-actions";

const NONE = "__none__";

interface Option {
  id: string;
  name: string;
}

/**
 * Record real income earned on a path. It becomes an ordinary income
 * transaction in the chosen account (the same ledger as everything else),
 * linked to the path/project. One idempotency key per attempt: a retried
 * submit never creates a second transaction; it rotates only after success.
 */
export function IncomeRecordForm({
  pathId,
  accounts,
  categories,
  projects,
  today,
}: {
  pathId: string;
  accounts: Option[];
  categories: Option[];
  projects: Option[];
  today: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? NONE);
  const [projectId, setProjectId] = useState(NONE);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = Math.round(Number(amount.replace(/,/g, "")) * 100);
  const valid = Number.isFinite(cents) && cents > 0 && Boolean(accountId) && Boolean(date);

  if (accounts.length === 0) {
    return <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t("earn.v2.income.noAccounts")}</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const res = await recordEarnIncome({
      pathId,
      projectId: projectId === NONE ? null : projectId,
      accountId,
      categoryId: categoryId === NONE ? null : categoryId,
      amountCents: cents,
      date,
      description: description.trim() || null,
      clientRequestId: requestId,
    }).catch(() => ({ error: t("earn.v2.income.failed") }) as { error: string; success?: boolean });
    if (res.error) {
      setSaving(false);
      setError(res.error);
      return;
    }
    setRequestId(crypto.randomUUID());
    toast.success(t("earn.v2.income.saved"));
    router.push(`/earn/paths/${pathId}`);
  }

  const pick = (list: Option[], value: string, none?: string) =>
    value === NONE ? none ?? "" : list.find((o) => o.id === value)?.name ?? "";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{t("earn.v2.income.recordTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("earn.v2.income.recordHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="income-amount">{t("earn.v2.income.amount")}</Label>
        <Input
          id="income-amount"
          inputMode="decimal"
          autoComplete="off"
          className="h-14 rounded-2xl text-2xl font-bold tabular-nums"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="income-account">{t("earn.v2.income.account")}</Label>
        <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
          <SelectTrigger id="income-account" className="h-11 rounded-xl">
            <SelectValue>{(v: string) => pick(accounts, v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="income-category">{t("earn.v2.income.category")}</Label>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? NONE)}>
            <SelectTrigger id="income-category" className="h-11 rounded-xl">
              <SelectValue>{(v: string) => pick(categories, v, "—")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="income-date">{t("earn.v2.income.date")}</Label>
          <Input id="income-date" type="date" max={today} className="h-11 rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="income-project">{t("earn.v2.income.project")}</Label>
          <Select value={projectId} onValueChange={(v) => setProjectId(v ?? NONE)}>
            <SelectTrigger id="income-project" className="h-11 rounded-xl">
              <SelectValue>{(v: string) => pick(projects, v, t("earn.v2.income.noProject"))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("earn.v2.income.noProject")}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="income-description">{t("earn.v2.income.description")}</Label>
        <Input id="income-description" className="h-11 rounded-xl" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="h-12 w-full rounded-2xl text-base" disabled={!valid || saving}>
        {saving ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
            {t("earn.v2.income.saving")}
          </>
        ) : (
          t("earn.v2.income.save")
        )}
      </Button>
    </form>
  );
}
