"use client";

import { useActionState } from "react";

import { completeOnboarding } from "@/features/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const GOALS = [
  { value: "save_more", label: "Save more" },
  { value: "pay_off_debt", label: "Pay off debt" },
  { value: "build_wealth", label: "Build wealth" },
  { value: "track_spending", label: "Track spending" },
  { value: "other", label: "Other" },
];

export function OnboardingForm({ defaultDisplayName }: { defaultDisplayName?: string | null }) {
  const [state, formAction, isPending] = useActionState(completeOnboarding, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Wealth OS</CardTitle>
        <CardDescription>
          A few quick details to set up your dashboard. Everything except your name is optional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">What&apos;s your name?</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={defaultDisplayName ?? ""}
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly_income">Monthly income (optional)</Label>
            <Input id="monthly_income" name="monthly_income" type="number" step="0.01" min="0" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="starting_balance">
              Starting cash/bank balance (optional)
            </Label>
            <Input id="starting_balance" name="starting_balance" type="number" step="0.01" />
            <p className="text-xs text-muted-foreground">
              We&apos;ll create a starting Cash account with this balance for you.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly_essential_expenses">
              Monthly essential expenses (optional)
            </Label>
            <Input
              id="monthly_essential_expenses"
              name="monthly_essential_expenses"
              type="number"
              step="0.01"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_goal">Primary financial goal (optional)</Label>
            <Select name="primary_goal">
              <SelectTrigger id="primary_goal">
                <SelectValue placeholder="Choose a goal">
                  {(value: string) => GOALS.find((g) => g.value === value)?.label ?? "Choose a goal"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GOALS.map((goal) => (
                  <SelectItem key={goal.value} value={goal.value}>
                    {goal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Setting up..." : "Get started"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
