"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/client";

/** STEP 9 — launches Stripe's own hosted billing portal rather than a custom card-management UI. */
export function ManageBillingButton() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(typeof data.error === "string" ? data.error : t("billing.errors.portalFailed"));
        return;
      }
      if (typeof data.url === "string") window.location.href = data.url;
    } catch {
      toast.error(t("billing.errors.portalFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={isLoading}>
      {isLoading ? t("common.loading") : t("billing.manageBilling")}
    </Button>
  );
}
