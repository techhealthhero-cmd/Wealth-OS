"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useTranslation } from "@/i18n/client";
import { prepareReceiptImage } from "@/features/capture/lib/image";
import { uploadSlipImage } from "@/features/slip-inbox/actions";

/** Most slips one pick sends — a month of a busy bank album, kept bounded. */
export const SLIP_BATCH_MAX = 30;

/**
 * Many slips picked at once → the slip inbox. One image per Server Action
 * call, in order (each stays under the 1 MB action body, and the server's
 * burst limit isn't hit by a parallel burst). Nothing becomes a transaction
 * here: the slips wait for the user's ✓ on the "รอตรวจ" tab.
 */
export function useSlipBatchUpload() {
  const { t } = useTranslation();
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function upload(fileList: FileList | File[]) {
    const files = Array.from(fileList).slice(0, SLIP_BATCH_MAX);
    if (files.length === 0 || progress) return;
    const counts = { queued: 0, skipped: 0, failed: 0, tooLarge: 0 };
    let stop: "limit" | "quota" | "unavailable" | null = null;
    setProgress({ done: 0, total: files.length });
    const toastId = toast.loading(t("slipInbox.upload.progress").replace("{done}", "0").replace("{total}", String(files.length)));

    for (let i = 0; i < files.length && !stop; i++) {
      try {
        const prepared = await prepareReceiptImage(files[i]);
        if (!prepared.ok) counts.tooLarge++;
        else {
          const fd = new FormData();
          fd.append("image", prepared.file);
          const { status } = await uploadSlipImage(fd);
          if (status === "queued") counts.queued++;
          else if (status === "already" || status === "duplicate" || status === "not_slip") counts.skipped++;
          else if (status === "limit" || status === "quota" || status === "unavailable") stop = status;
          else counts.failed++;
        }
      } catch {
        counts.failed++;
      }
      setProgress({ done: i + 1, total: files.length });
      toast.loading(t("slipInbox.upload.progress").replace("{done}", String(i + 1)).replace("{total}", String(files.length)), {
        id: toastId,
      });
    }

    setProgress(null);
    const lines = [
      counts.skipped ? t("slipInbox.upload.summaryExtra").replace("{skipped}", String(counts.skipped)) : null,
      counts.failed ? t("slipInbox.upload.failedSome").replace("{count}", String(counts.failed)) : null,
      counts.tooLarge ? t("slipInbox.upload.tooLarge").replace("{count}", String(counts.tooLarge)) : null,
      stop ? t(`slipInbox.upload.${stop}`) : null,
    ].filter(Boolean);
    const title = t("slipInbox.upload.summary").replace("{queued}", String(counts.queued));
    const options = {
      id: toastId,
      description: lines.join(" · ") || undefined,
      duration: 8000,
      action: counts.queued
        ? { label: t("slipInbox.upload.view"), onClick: () => router.push("/money/transactions?tab=pending") }
        : undefined,
    };
    if (counts.queued > 0) toast.success(title, options);
    else toast.error(title, options);
    router.refresh();
  }

  return { upload, progress, busy: progress !== null };
}
