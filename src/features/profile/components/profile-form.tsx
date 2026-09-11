"use client";

import { useActionState } from "react";

import { updateProfile } from "@/features/profile/actions";
import type { Profile } from "@/types/database";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, isPending] = useActionState(updateProfile, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile & settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferred_language">Language</Label>
            <Select name="preferred_language" defaultValue={profile.preferred_language}>
              <SelectTrigger id="preferred_language">
                <SelectValue>{(value: string) => (value === "th" ? "ไทย (Thai)" : "English")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="th">ไทย (Thai)</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency_code">Currency</Label>
            <Input
              id="currency_code"
              name="currency_code"
              defaultValue={profile.currency_code}
              maxLength={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" name="timezone" defaultValue={profile.timezone} required />
          </div>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state && !state.error ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
          ) : null}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
