"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n/client";

interface CollapsibleNotesProps {
  name: string;
  defaultValue?: string;
}

/** Stays collapsed behind a "+ Add note" toggle so the normal flow never shows a large empty textarea (Step 6). */
export function CollapsibleNotes({ name, defaultValue }: CollapsibleNotesProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(Boolean(defaultValue));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {t("transactions.addNote")}
      </button>
    );
  }

  return (
    <Textarea
      name={name}
      defaultValue={defaultValue}
      maxLength={1000}
      autoFocus
      placeholder={t("transactions.notes")}
      className="min-h-16"
    />
  );
}
