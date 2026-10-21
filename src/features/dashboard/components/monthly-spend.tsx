"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MonthlySpendSummary } from "@/features/capture/components/slip-auto/types";
import { getMonthlySpendSummary } from "../monthly-spend-actions";
import { monthlyCategoryHref, shiftSpendMonth } from "../lib/monthly-spend";
import { MonthlySpendCard } from "./monthly-spend-card";
import { MonthlySpendDetail } from "./monthly-spend-detail";

export function MonthlySpend({ summary, month }: { summary: MonthlySpendSummary | null; month: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ month: string; summary: MonthlySpendSummary | null } | null>(null);
  const request = useRef(0);
  const shown = detail ?? { month, summary };
  async function change(delta: -1 | 1) {
    const id = ++request.current;
    const next = shiftSpendMonth(shown.month, delta);
    try { const result = await getMonthlySpendSummary(next); if (id === request.current) setDetail({ month: next, summary: result }); }
    catch { if (id === request.current) toast.error("ไม่สามารถโหลดสรุปรายเดือนได้ กรุณาลองอีกครั้ง"); }
  }
  return <>
    <MonthlySpendCard summary={summary} onOpen={() => { request.current++; setDetail(null); setOpen(true); }} />
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>{shown.summary?.monthLabel}</SheetTitle></SheetHeader>
        <MonthlySpendDetail summary={shown.summary} onMonthChange={change} onViewCategory={id => router.push(monthlyCategoryHref(shown.month, id))} />
      </SheetContent>
    </Sheet>
  </>;
}
