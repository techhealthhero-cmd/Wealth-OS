"use client";
import { useEffect, useId, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

/** Dismiss only this screen's copy feedback; ignore clipboard completions after leaving. */
export function useInvoiceCopyToast() {
  const id = useId();
  const pathname = usePathname();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      toast.dismiss(id);
    };
  }, [id, pathname]);
  return {
    show(text: string) {
      if (active.current) toast.success(text, { id, duration: 1200 });
    },
    dismiss() {
      active.current = false;
      toast.dismiss(id);
    },
  };
}
