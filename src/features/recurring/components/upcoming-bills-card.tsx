import type { UpcomingBillsSummary } from "@/features/recurring/queries";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function BillRow({ label, amountCents, dueDate, source, dict }: { label: string; amountCents: number; dueDate: string; source: "recurring" | "liability"; dict: Dictionary }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {dict.upcomingBills.source[source]} · {dueDate}
        </p>
      </div>
      <span className="shrink-0 font-medium">{formatMoney(amountCents)}</span>
    </div>
  );
}

export function UpcomingBillsCard({ bills, dict }: { bills: UpcomingBillsSummary; dict: Dictionary }) {
  const hasAny = bills.overdue.length > 0 || bills.next7Days.length > 0 || bills.next30Days.length > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="min-w-0 truncate text-base">{dict.upcomingBills.title}</CardTitle>
        {/* Deliberately NOT a sum of everything shown below — totalDueCents
            is overdue + next7Days only (see upcoming-bills.ts), so it must
            carry its own label or it reads as "total of this whole card"
            and looks wrong whenever every bill happens to fall in the
            next30Days bucket (reported: card showed ฿0.00 above a list of
            real, non-zero upcoming bills). */}
        <div className="shrink-0">
          <p className="text-sm font-medium">{formatMoney(bills.totalDueCents)}</p>
          <p className="text-xs text-muted-foreground">{dict.upcomingBills.totalDue}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">{dict.upcomingBills.noUpcoming}</p>
        ) : (
          <>
            {bills.overdue.length > 0 ? (
              <div className="space-y-2">
                <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">{dict.upcomingBills.overdue}</Badge>
                {bills.overdue.map((b) => (
                  <BillRow key={b.id} label={b.label} amountCents={b.amountCents} dueDate={b.dueDate} source={b.source} dict={dict} />
                ))}
              </div>
            ) : null}
            {bills.next7Days.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{dict.upcomingBills.next7Days}</p>
                {bills.next7Days.map((b) => (
                  <BillRow key={b.id} label={b.label} amountCents={b.amountCents} dueDate={b.dueDate} source={b.source} dict={dict} />
                ))}
              </div>
            ) : null}
            {bills.next30Days.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{dict.upcomingBills.next30Days}</p>
                {bills.next30Days.map((b) => (
                  <BillRow key={b.id} label={b.label} amountCents={b.amountCents} dueDate={b.dueDate} source={b.source} dict={dict} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
