"use client";

import { useState } from "react";

import {
  sampleMonth,
  sampleReading,
  sampleReview,
  sampleSaved,
} from "@/features/capture/components/slip-auto/__fixtures__/sample";
import { SlipPickSheet } from "@/features/capture/components/slip-auto/slip-pick-sheet";
import { SlipReadingProgress } from "@/features/capture/components/slip-auto/slip-reading-progress";
import { SlipReviewSheet } from "@/features/capture/components/slip-auto/slip-review-sheet";
import { SlipSavedState } from "@/features/capture/components/slip-auto/slip-saved-state";
import type { SlipReviewViewModel } from "@/features/capture/components/slip-auto/types";
import { NetWorthCompactCard } from "@/features/dashboard/components/net-worth-compact-card";
import { MonthlySpendCard } from "@/features/dashboard/components/monthly-spend-card";
import { MonthlySpendDetail } from "@/features/dashboard/components/monthly-spend-detail";
import { getDictionary } from "@/i18n/dictionaries";

export type PreviewScreen = "pick" | "reading" | "review" | "saved" | "home" | "detail";

const noop = () => {};

/** SAMPLE net-worth card inputs (fixture) — the real NetWorthCompactCard is presentational. */
const netWorthSample = {
  netWorthCents: 24890000,
  sinceFirst: { monthLabel: "พ.ค.", change: { changeCents: 1250000, changePercent: 5.3 } },
  chartData: [
    { date: "1", netWorth: 22000000 },
    { date: "2", netWorth: 22900000 },
    { date: "3", netWorth: 23500000 },
    { date: "4", netWorth: 24890000 },
  ],
  monthLabels: [
    { label: "พ.ค.", isCurrent: false },
    { label: "ส.ค.", isCurrent: false },
    { label: "ต.ค.", isCurrent: true },
  ],
};

export function SlipAutoPreview({ screen }: { screen: PreviewScreen }) {
  const [review, setReview] = useState<SlipReviewViewModel>(sampleReview);
  const dict = getDictionary("th");

  switch (screen) {
    case "pick":
      return (
        <div className="min-h-dvh">
          <SlipPickSheet onPick={noop} onTakePhoto={noop} onClose={noop} />
        </div>
      );
    case "reading":
      return (
        <div className="px-4 pt-4">
          <SlipReadingProgress vm={sampleReading} onLater={noop} />
        </div>
      );
    case "review":
      return (
        <SlipReviewSheet
          vm={review}
          onAnswer={(id, answer) =>
            setReview((v) => ({
              ...v,
              questions: v.questions.map((q) => (q.id === id ? { ...q, answeredOptionId: answer } : q)),
            }))
          }
          onChangeCategory={(id, categoryId) =>
            setReview((v) => ({
              ...v,
              ready: v.ready.map((r) => {
                const cat = v.categories.find((c) => c.id === categoryId);
                return r.id === id && cat ? { ...r, categoryId, categoryLabel: cat.label, icon: cat.icon } : r;
              }),
            }))
          }
          onSaveAll={noop}
        />
      );
    case "saved":
      return (
        <div className="px-0 pt-2">
          <SlipSavedState vm={sampleSaved} onUndo={noop} onViewMonth={noop} onBackHome={noop} onScanMore={noop} />
        </div>
      );
    case "home":
      // Faithful stand-in for Home: same card + order/spacing as
      // src/app/(app)/dashboard/page.tsx (net-worth card, then the monthly card).
      return (
        <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-4">
          <div data-testid="networth-card">
            <NetWorthCompactCard
              labels={{
                ...dict.homeNetWorth,
                noHistoryYet: dict.netWorth.noHistoryYet,
                viewAssetsAndLiabilities: dict.netWorth.viewAssetsAndLiabilities,
              }}
              {...netWorthSample}
              currencyCode="THB"
            />
          </div>
          <MonthlySpendCard summary={sampleMonth} onOpen={noop} />
        </div>
      );
    case "detail":
      return (
        <div className="mx-auto w-full max-w-lg px-4 pt-4">
          <MonthlySpendDetail summary={sampleMonth} onMonthChange={noop} onViewCategory={noop} />
        </div>
      );
  }
}
