import { beforeEach, expect, it, vi } from "vitest";
import { useInvoiceCopyToast } from "@/features/invoices/components/use-invoice-copy-toast";
const state = vi.hoisted(() => ({ cleanup: undefined as undefined | (() => void), active: { current: true } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), dismiss: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ usePathname: () => "/money/invoices/example" }));
vi.mock("react", () => ({
  useId: () => "copy-screen-id",
  useRef: () => state.active,
  useEffect: (run: () => () => void) => { state.cleanup = run(); },
}));
beforeEach(() => { state.active.current = true; vi.clearAllMocks(); });
it("limits copy feedback duration and dismisses its own toast on route cleanup", () => {
  const feedback = useInvoiceCopyToast();
  feedback.show("คัดลอกแล้ว");
  expect(toast.success).toHaveBeenCalledWith("คัดลอกแล้ว", { id: "copy-screen-id", duration: 1200 });
  state.cleanup!();
  expect(toast.dismiss).toHaveBeenCalledWith("copy-screen-id");
});
it("ignores a clipboard completion after unmount", () => {
  const feedback = useInvoiceCopyToast();
  state.cleanup!();
  feedback.show("คัดลอกแล้ว");
  expect(toast.success).not.toHaveBeenCalled();
});
it("dismisses before the reminder navigation and ignores a late clipboard completion", () => {
  const feedback = useInvoiceCopyToast();
  feedback.dismiss();
  feedback.show("คัดลอกแล้ว");
  expect(toast.dismiss).toHaveBeenCalledWith("copy-screen-id");
  expect(toast.success).not.toHaveBeenCalled();
});
