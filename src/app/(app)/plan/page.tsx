import { redirect } from "next/navigation";

import { logNav } from "@/lib/dev-diagnostics";

export default function PlanPage() {
  logNav({ from: "/plan", to: "/plan/goals", reason: "section root default route", source: "plan/page.tsx" });
  redirect("/plan/goals");
}
