import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import th from "@/i18n/locales/th.json";
import { invoice } from "./fixtures/invoice-ui";
import { InvoiceDetailScreen } from "@/features/invoices/components/invoice-detail-screen";

// Minimal hook host: exercise the event/state contract without a browser or DB.
const host = vi.hoisted(() => ({ values: [] as unknown[], index: 0, task: Promise.resolve() }));
const feedback = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: feedback }));
vi.mock("@/features/invoices/components/use-invoice-copy-toast", () => ({
  useInvoiceCopyToast: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = host.index++;
    if (!(index in host.values)) host.values[index] = initial;
    return [host.values[index], (value: unknown) => {
      host.values[index] = typeof value === "function" ? value(host.values[index]) : value;
    }];
  },
  useTransition: () => [false, (run: () => Promise<void>) => { host.task = run(); }],
}));
function nodes(tree: unknown): ReactElement<Record<string, unknown>>[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props?.children), ...nodes(node.props?.aside)];
}
const copy = th.invoiceUi;
function render(onPaid: Parameters<typeof InvoiceDetailScreen>[0]["onPaid"]) {
  host.index = 0;
  return InvoiceDetailScreen({ invoice, copy, today: "2026-10-19",
    accounts: [{ id: invoice.receiveAccountId!, name: "Cash", account_type: "cash" }],
    onPaid, onVoid: vi.fn(), onMarkSent: vi.fn() });
}
function click(tree: unknown, text: string) {
  const button = nodes(tree).find(n => n.type === "button" && n.props.children === text);
  expect(button, text).toBeDefined();
  (button!.props.onClick as () => void)();
}
beforeEach(() => { host.values = []; host.index = 0; vi.clearAllMocks(); });
describe("mark-paid optimistic interaction", () => {
  it("closes and paints paid before the action settles, then preserves tax suggestion feedback", async () => {
    let finish!: (value: Awaited<ReturnType<Parameters<typeof render>[0]>>) => void;
    const onPaid = vi.fn(() => new Promise<Awaited<ReturnType<Parameters<typeof render>[0]>>>(resolve => { finish = resolve; }));
    click(render(onPaid), copy.received);
    click(render(onPaid), copy.confirm);
    const pending = nodes(render(onPaid));
    expect(pending.some(n => n.props.status === "paid")).toBe(true);
    expect(pending.some(n => n.props.open === true)).toBe(false);
    finish({ success: true, transactionId: "tx", setAsideSuggestion: { amountCents: 135800, ratePct: 7, mode: "ask" } });
    await host.task;
    expect(feedback.success).toHaveBeenCalledWith(expect.stringContaining("7"));
    expect(feedback.error).not.toHaveBeenCalled();
  });
  it.each(["returned", "thrown"])("rolls back and toasts a Thai error on %s failure", async kind => {
    const onPaid = vi.fn(async () => {
      if (kind === "thrown") throw new Error("network");
      return { error: copy.failed };
    });
    click(render(onPaid), copy.received);
    click(render(onPaid), copy.confirm);
    await host.task;
    expect(nodes(render(onPaid)).some(n => n.props.status === invoice.displayStatus)).toBe(true);
    expect(feedback.error).toHaveBeenCalledWith(copy.failed);
    expect(feedback.success).not.toHaveBeenCalled();
  });
});
