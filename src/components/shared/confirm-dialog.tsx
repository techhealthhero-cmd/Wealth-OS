"use client";

import { useCallback, useRef, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  message: string;
}

/**
 * Drop-in replacement for `window.confirm()` that resolves the same way (a
 * boolean promise) but renders the app's own styled Dialog instead of the
 * browser's native confirm — which can't be restyled or have its Cancel/OK
 * buttons relabeled to match the rest of the UI. A caller that used to
 * write `if (!window.confirm(message)) return;` only needs to become
 * `if (!(await confirm(message))) return;`, plus rendering `{dialog}` once
 * anywhere in the component's JSX.
 */
export function useConfirmDialog() {
  const { t } = useTranslation();
  const [state, setState] = useState<ConfirmState>({ open: false, message: "" });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, message, ...options });
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const destructive = state.destructive ?? false;
  const title = state.title ?? (destructive ? t("common.confirmDeleteTitle") : t("common.confirm"));
  const confirmLabel = state.confirmLabel ?? (destructive ? t("common.delete") : t("common.confirm"));
  const cancelLabel = state.cancelLabel ?? t("common.cancel");

  const dialog = (
    <Dialog open={state.open} onOpenChange={(open) => !open && settle(false)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{state.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => settle(true)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
