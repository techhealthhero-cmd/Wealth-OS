"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/client";
import type { PlanId } from "@/lib/billing/plans";

/**
 * STEP 8 checkout trigger. Posts to `/api/billing/checkout`, then redirects
 * the browser to the returned Stripe Checkout URL — this page never renders
 * card fields itself. If billing isn't configured (no Stripe keys in this
 * environment — see PROJECT_STATUS.md "Billing Test Mode"), the API
 * returns a clear error instead of a broken redirect, shown as a toast.
 */
export function UpgradeButton({ planId, label, variant = "default" }: { planId: PlanId; label: string; variant?: "default" | "outline" }) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(typeof data.error === "string" ? data.error : t("billing.errors.checkoutFailed"));
        return;
      }
      if (typeof data.url === "string") {
        window.location.href = data.url;
      }
    } catch {
      toast.error(t("billing.errors.checkoutFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button type="button" variant={variant} className="w-full" onClick={handleClick} disabled={isLoading}>
      {isLoading ? t("common.loading") : label}
    </Button>
  );
}
