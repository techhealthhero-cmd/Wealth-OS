"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The fail-closed "unavailable" cover used to be a dead end — a transient
 * privacy-settings fetch error hid the whole page with no way out but a
 * manual reload. router.refresh() re-runs the server gate, which shows the
 * real page as soon as the settings load again (and stays covered if not).
 */
export function PrivacyRetryButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="mt-5"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RotateCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
      {label}
    </Button>
  );
}
