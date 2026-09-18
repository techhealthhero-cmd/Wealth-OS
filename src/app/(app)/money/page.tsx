import { redirect } from "next/navigation";

import { logNav } from "@/lib/dev-diagnostics";

export default function MoneyPage() {
  logNav({ from: "/money", to: "/money/transactions", reason: "section root default route", source: "money/page.tsx" });
  redirect("/money/transactions");
}
