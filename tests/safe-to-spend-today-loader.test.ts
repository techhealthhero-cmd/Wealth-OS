import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/features/accounts/queries", () => ({ getAccounts: vi.fn() }));
vi.mock("@/features/recurring/queries", () => ({ getPaymentCalendarSources: vi.fn(), getRecurringTransactions: vi.fn() }));
vi.mock("@/features/emergency-fund/queries", () => ({ getEmergencyFund: vi.fn(), getEssentialMonthlyExpenses: vi.fn() }));
vi.mock("@/features/tax-jar/queries", () => ({ getTaxJarSettings: vi.fn(), getTaxJarSummary: vi.fn() }));
vi.mock("@/features/invoices/server-context", () => ({ invoiceContext: vi.fn(), invoiceDbError: vi.fn(() => "DB error") }));
import { getSafeToSpendToday } from "@/features/safe-to-spend/today";
import { getAccounts } from "@/features/accounts/queries";
import { getPaymentCalendarSources, getRecurringTransactions } from "@/features/recurring/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getTaxJarSettings, getTaxJarSummary } from "@/features/tax-jar/queries";
import { invoiceContext } from "@/features/invoices/server-context";
import type { Account, RecurringTransaction } from "@/types/database";
const settings = { ratePct: 10, mode: "ask" as const, accountId: null, expense408RatePct: 60, extraDeductionsCents: 0 };
const context = () => ({ user: { id: "user" }, dict: { common: { pleaseLogin: "Login" } }, supabase: { from: vi.fn() } });
let ctx: ReturnType<typeof context>;
beforeEach(() => {
  vi.resetAllMocks();
  ctx = context();
  vi.mocked(invoiceContext).mockResolvedValue(ctx as unknown as Awaited<ReturnType<typeof invoiceContext>>);
  vi.mocked(getAccounts).mockResolvedValue([{ id: "bank", account_type: "bank", current_balance: "120.00" }] as Account[]);
  vi.mocked(getPaymentCalendarSources).mockResolvedValue([]);
  vi.mocked(getRecurringTransactions).mockResolvedValue([]);
  vi.mocked(getEmergencyFund).mockResolvedValue(null);
  vi.mocked(getEssentialMonthlyExpenses).mockResolvedValue({ cents: 0, hasData: false });
  vi.mocked(getTaxJarSettings).mockResolvedValue({ success: true, configured: false, settings });
  vi.mocked(getTaxJarSummary).mockResolvedValue({ success: true, balanceCents: 0, entries: [] });
});
it("returns no_accounts without loading optional inputs", async () => {
  vi.mocked(getAccounts).mockResolvedValue([]);
  expect(await getSafeToSpendToday("2026-10-20")).toEqual({ success: false, reason: "no_accounts" });
  expect(getPaymentCalendarSources).not.toHaveBeenCalled();
});
it.each(["settings", "summary"])("degrades gracefully when tax %s fails", async which => {
  if (which === "settings") vi.mocked(getTaxJarSettings).mockResolvedValue({ error: "missing migration" });
  else vi.mocked(getTaxJarSummary).mockResolvedValue({ error: "missing migration" });
  expect(await getSafeToSpendToday("2026-10-20")).toMatchObject({ success: true, warnings: ["tax_jar_unavailable"], breakdown: { taxJarShortfallCents: 0 } });
});
it("does not use default settings as configured tax reserve", async () => {
  expect(await getSafeToSpendToday("2026-10-20")).toMatchObject({ success: true, warnings: [], breakdown: { taxJarShortfallCents: 0 } });
  expect(ctx.supabase.from).not.toHaveBeenCalled();
});
it("steps overdue income strictly past today and ignores inactive/ended schedules", async () => {
  vi.mocked(getRecurringTransactions).mockResolvedValue([
    { type: "income", is_active: true, next_due_date: "2026-10-06", frequency: "weekly", end_date: null },
    { type: "income", is_active: false, next_due_date: "2026-10-21", frequency: "monthly", end_date: null },
    { type: "income", is_active: true, next_due_date: "2026-10-19", frequency: "weekly", end_date: "2026-10-22" },
    { type: "expense", is_active: true, next_due_date: "2026-10-21", frequency: "weekly", end_date: null },
  ] as RecurringTransaction[]);
  expect(await getSafeToSpendToday("2026-10-20")).toMatchObject({ horizonEnd: "2026-10-26", horizonReason: "next_income", daysLeft: 7 });
  expect(getPaymentCalendarSources).toHaveBeenCalledWith("2026-10-20");
});
it("pages scoped YTD income and uses the jar balance", async () => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn() };
  query.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => ({ amount: "1.00" })), error: null })
    .mockResolvedValueOnce({ data: [{ amount: "100.00" }], error: null });
  ctx.supabase.from.mockReturnValue(query);
  vi.mocked(getTaxJarSettings).mockResolvedValue({ success: true, configured: true, settings });
  vi.mocked(getTaxJarSummary).mockResolvedValue({ success: true, balanceCents: 1000, entries: [] });
  expect(await getSafeToSpendToday("2026-10-20")).toMatchObject({ totalCents: 7000, assumptionsStatus: "approved", breakdown: { taxJarShortfallCents: 5000 } });
  expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
  expect(query.eq).toHaveBeenCalledWith("user_id", "user");
  expect(query.eq).toHaveBeenCalledWith("type", "income");
  expect(query.gte).toHaveBeenCalledWith("transaction_date", "2026-01-01");
  expect(query.lte).toHaveBeenCalledWith("transaction_date", "2026-10-20");
  expect(getTaxJarSummary).toHaveBeenCalledWith(2026);
});
it("rejects invalid calendar dates before loading data", async () => {
  expect(await getSafeToSpendToday("2026-02-30")).toHaveProperty("error");
  expect(invoiceContext).not.toHaveBeenCalled();
});
it("returns login error", async () => {
  vi.mocked(invoiceContext).mockResolvedValue({ ...ctx, user: null } as unknown as Awaited<ReturnType<typeof invoiceContext>>);
  expect(await getSafeToSpendToday("2026-10-20")).toEqual({ error: "Login" });
  expect(getAccounts).not.toHaveBeenCalled();
});
it("filters liquid types and excludes linked reserves while capping emergency top-up", async () => {
  vi.mocked(getAccounts).mockResolvedValue([
    { id: "cash", account_type: "cash", current_balance: "120.00" },
    { id: "reserve", account_type: "bank", current_balance: "50.00" },
    { id: "jar", account_type: "e_wallet", current_balance: "20.00" },
    { id: "stock", account_type: "investment", current_balance: "999.00" },
  ] as Account[]);
  vi.mocked(getEmergencyFund).mockResolvedValue({ linked_account_id: "reserve", target_months: "3", custom_target_amount: null, current_amount: "25.00", monthly_contribution: "10.00" } as NonNullable<Awaited<ReturnType<typeof getEmergencyFund>>>);
  vi.mocked(getEssentialMonthlyExpenses).mockResolvedValue({ cents: 1000, hasData: true });
  vi.mocked(getTaxJarSettings).mockResolvedValue({ success: true, configured: false, settings: { ...settings, accountId: "jar" } });
  expect(await getSafeToSpendToday("2026-10-20")).toMatchObject({ totalCents: 11500, breakdown: { liquidCents: 12000, excludedEarmarkedCents: 7000, emergencyTopUpCents: 500 } });
});
