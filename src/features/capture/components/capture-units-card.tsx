"use client";

import { useEffect, useState } from "react";
import { Hash, Plus, X } from "lucide-react";

import { deleteCaptureUnit, getCaptureUnits, saveCaptureUnit, type CaptureUnitRow } from "@/features/capture/units";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "หน่วยนับรายได้" on the profile page (2026-10-13): the per-unit prices
 * voice capture uses ("ดื่ม" = ฿200, so "ได้ 10 ดื่ม" is ฿2,000). Units are
 * usually learned the first time capture asks; here they can be re-priced
 * (adding the same word again) or removed. Each change saves on its own.
 */
export function CaptureUnitsCard({ defaultCategoryId }: { defaultCategoryId: string | null }) {
  const { t, locale } = useTranslation();
  const [units, setUnits] = useState<CaptureUnitRow[] | null>(null);
  const [word, setWord] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCaptureUnits()
      .then((rows) => {
        if (!cancelled) setUnits(rows);
      })
      .catch(() => {
        if (!cancelled) setUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const priceCents = Math.round(Number(price.replace(/,/g, "")) * 100);
  const canAdd = word.trim().length > 0 && Number.isFinite(priceCents) && priceCents > 0 && !busy;

  async function add() {
    if (!canAdd) return;
    setBusy(true);
    setError(null);
    // An existing word keeps its own type and category; a new one is income.
    const existing = units?.find((u) => u.unit_label === word.trim());
    const result = await saveCaptureUnit({
      word: word.trim(),
      priceCents,
      type: existing?.type ?? "income",
      categoryId: existing ? existing.category_id : defaultCategoryId,
      source: "user",
    });
    setBusy(false);
    const saved = result.unit;
    if (!saved) {
      setError(result.error ?? t("capture.units.saveFailed"));
      return;
    }
    setUnits((prev) => [...(prev ?? []).filter((u) => u.id !== saved.id), saved]);
    setWord("");
    setPrice("");
  }

  async function remove(unit: CaptureUnitRow) {
    setError(null);
    setUnits((prev) => (prev ?? []).filter((u) => u.id !== unit.id));
    const result = await deleteCaptureUnit(unit.id);
    if (!result.success) {
      setUnits((prev) => [...(prev ?? []), unit]);
      setError(result.error ?? t("capture.units.saveFailed"));
    }
  }

  const money = (value: string) => formatMoney(Math.round(Number(value) * 100), "THB", locale === "th" ? "th-TH" : "en-US", 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Hash className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{t("capture.units.settingsTitle")}</CardTitle>
            <CardDescription>{t("capture.units.settingsHint")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {units === null ? null : units.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("capture.units.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {units.map((unit) => (
              <li key={unit.id} className="flex min-h-11 items-center gap-2 rounded-xl border bg-background pr-1 pl-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{unit.unit_label}</span>
                  <span className="text-muted-foreground"> · {t("capture.units.each").replace("{price}", money(unit.unit_price))}</span>
                  <span className={unit.type === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                    {" "}
                    · {unit.type === "income" ? t("capture.voice.income") : t("capture.voice.expense")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void remove(unit)}
                  aria-label={t("capture.units.remove").replace("{word}", unit.unit_label)}
                  className="flex size-9 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={t("capture.units.wordPlaceholder")}
            aria-label={t("capture.units.wordLabel")}
            maxLength={40}
            className="min-w-0 flex-1"
          />
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="200"
            aria-label={t("capture.units.priceLabel")}
            className="w-24"
          />
          <Button type="submit" size="icon" disabled={!canAdd} aria-label={t("capture.units.add")}>
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </form>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
