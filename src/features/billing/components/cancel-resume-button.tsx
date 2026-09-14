"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/client";
import { cancelSubscriptionAction, resumeSubscriptionAction } from "@/features/billing/actions";

export function CancelResumeButton({ cancelAtPeriodEnd }: { cancelAtPeriodEnd: boolean }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = cancelAtPeriodEnd ? await resumeSubscriptionAction() : await cancelSubscriptionAction();
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? t("common.loading") : cancelAtPeriodEnd ? t("billing.resumeSubscription") : t("billing.cancelSubscription")}
    </Button>
  );
}
