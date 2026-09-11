import { z } from "zod";

import type { Dictionary } from "@/i18n/dictionaries";

export const DEBT_STRATEGIES = ["snowball", "avalanche", "custom"] as const;

export function buildDebtPlanSchema(dict: Dictionary) {
  return z.object({
    strategy: z.enum(DEBT_STRATEGIES, { message: dict.validation.chooseValidAccountType }),
    extra_monthly_payment: z.coerce.number().min(0, dict.validation.enterValidAmount).default(0),
  });
}

export type DebtPlanFormValues = z.infer<ReturnType<typeof buildDebtPlanSchema>>;
