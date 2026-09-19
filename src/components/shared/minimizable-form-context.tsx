"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Sparkle } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

interface ActiveForm {
  id: string;
  title: string;
  content: ReactNode;
}

interface MinimizableFormActions {
  /**
   * `content` must be a fully self-contained component (owns its own
   * hooks/state — e.g. its own useActionState) — never JSX built from the
   * CALLER's hook state. Once mounted here, the caller (a thin trigger/
   * open-state wrapper) may itself unmount at any time — e.g. the page
   * that opened it is navigated away from while minimized — and the
   * mounted content must keep working (typing, submitting) regardless,
   * since it's rendered by MinimizableFormHost, not by the caller.
   */
  openForm: (form: ActiveForm) => void;
  minimize: () => void;
  restore: () => void;
  close: () => void;
}

interface MinimizableFormState {
  active: ActiveForm | null;
  minimized: boolean;
}

// Split into two contexts deliberately: a form component (e.g. GoalForm)
// only ever needs the ACTIONS (all stable useCallback references, never
// change) to open/refresh/close itself — it must never re-render just
// because `active`/`minimized` changed, or its own per-render
// updateContent() effect would re-trigger on that re-render, changing
// state again, forever. Only the Host/Shell (which actually display
// active/minimized) subscribe to the state context.
const MinimizableFormActionsContext = createContext<MinimizableFormActions | null>(null);
const MinimizableFormStateContext = createContext<MinimizableFormState | null>(null);

/**
 * App-wide "minimize this form" capability (2026-09). Mounted once in
 * (app)/layout.tsx, which Next.js keeps mounted across in-app navigation
 * (only each page's own tree unmounts) — so a form "opened" here via
 * openForm() keeps its mounted React state (including plain uncontrolled
 * <input defaultValue> DOM state) no matter what page the user navigates
 * to afterward. Only ever tracks ONE active form app-wide, not a stack —
 * openForm() while a different form is already active restores the
 * existing one instead of silently discarding its draft.
 */
export function MinimizableFormProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveForm | null>(null);
  const [minimized, setMinimized] = useState(false);

  const openForm = useCallback((form: ActiveForm) => {
    setActive((current) => {
      if (current && current.id !== form.id) {
        // A different form is already active — restore it rather than
        // silently replacing/discarding its draft.
        setMinimized(false);
        return current;
      }
      return form;
    });
    setMinimized(false);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const restore = useCallback(() => setMinimized(false), []);
  const close = useCallback(() => {
    setActive(null);
    setMinimized(false);
  }, []);

  // Every dependency here is a stable (empty-deps) useCallback, so this
  // object itself never changes reference across renders — consumers of
  // ONLY the actions context (i.e. form components) never re-render due
  // to active/minimized changing.
  const actions = useMemo(() => ({ openForm, minimize, restore, close }), [openForm, minimize, restore, close]);
  const state = useMemo(() => ({ active, minimized }), [active, minimized]);

  return (
    <MinimizableFormActionsContext.Provider value={actions}>
      <MinimizableFormStateContext.Provider value={state}>{children}</MinimizableFormStateContext.Provider>
    </MinimizableFormActionsContext.Provider>
  );
}

/** For a form component that opens/refreshes/closes itself — never re-renders on active/minimized changes. */
export function useMinimizableFormActions() {
  const ctx = useContext(MinimizableFormActionsContext);
  if (!ctx) throw new Error("useMinimizableFormActions must be used within a MinimizableFormProvider");
  return ctx;
}

/** For something that displays the active/minimized state (the Host, the Shell). */
export function useMinimizableForm() {
  const actions = useMinimizableFormActions();
  const state = useContext(MinimizableFormStateContext);
  if (!state) throw new Error("useMinimizableForm must be used within a MinimizableFormProvider");
  return { ...state, ...actions };
}

/**
 * Renders the active form's content, plus the floating "resume" pill when
 * minimized. The content wrapper uses a CSS display toggle, never a
 * conditional unmount — see this file's top doc comment for why that
 * distinction is the whole point of this mechanism.
 */
export function MinimizableFormHost() {
  const { active, minimized, restore } = useMinimizableForm();
  const { t } = useTranslation();

  if (!active) return null;

  return (
    <>
      <div style={{ display: minimized ? "none" : undefined }}>{active.content}</div>
      {minimized ? (
        <button
          type="button"
          onClick={restore}
          // Mirrors QuickAdd's floating FAB (quick-add.tsx: "fixed bottom-20
          // right-4 z-40 ... md:bottom-6") on the opposite side, so the two
          // floating actions never collide.
          className={cn(
            "fixed bottom-20 left-4 z-40 flex max-w-[calc(100%-5rem)] items-center gap-2 rounded-full bg-primary py-2.5 pr-4 pl-3 text-primary-foreground shadow-lg transition-opacity active:opacity-90 md:bottom-6"
          )}
        >
          <Sparkle className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">{active.title}</span>
            <span className="block text-xs text-primary-foreground/70">{t("common.tapToResume")}</span>
          </span>
        </button>
      ) : null}
    </>
  );
}
