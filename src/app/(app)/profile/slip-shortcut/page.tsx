import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getCaptureTokens } from "@/features/slip-inbox/queries";
import { CaptureTokensCard } from "@/features/slip-inbox/components/capture-tokens-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Automatic slips — Wealth OS" };

/** The address the Shortcut posts to — this deployment's own origin, never a hard-coded host. */
async function endpointUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/capture/slips`;
}

/** Profile → ส่งสลิปอัตโนมัติ: connection keys + how to set up the iPhone Shortcut (migration 0046). */
export default async function SlipShortcutPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const dict = getDictionary(await getLocale(profile.preferred_language));
  const s = dict.slipInbox.tokens;
  const [tokens, url] = await Promise.all([getCaptureTokens(), endpointUrl()]);

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28">
      <header className="space-y-1">
        <Link href="/profile" className="-ml-1 inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {dict.notebookCover.back}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-balance">{s.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{s.intro}</p>
      </header>

      {tokens === null ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{dict.slipInbox.notReady}</p>
      ) : (
        <CaptureTokensCard tokens={tokens} endpointUrl={url} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.stepsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {s.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.testTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{s.testHint}</p>
        </CardContent>
      </Card>

      <Card variant="soft">
        <CardHeader>
          <CardTitle className="text-base">{s.notesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {s.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="text-sm font-medium">{s.phoneLost}</p>
        </CardContent>
      </Card>
    </div>
  );
}
