"use client";
import { useTranslation } from "@/i18n/client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-lg">
      <p role="alert" className="rounded-2xl border bg-card p-4 text-destructive">
        {t("invoiceUi.failed")}
      </p>
      <button className="mt-3 rounded-xl bg-primary px-4 py-2 text-primary-foreground" onClick={reset}>
        {t("invoiceUi.retry")}
      </button>
    </div>
  );
}
