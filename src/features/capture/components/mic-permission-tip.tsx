"use client";

import { useEffect, useState } from "react";
import { Mic, X } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { MIC_USED_KEY } from "@/lib/speech/use-speech-input";

const DISMISSED_KEY = "wos.mic.tipDismissed";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports itself as a Mac with touch.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Websites can't grant themselves a permanent microphone permission — on
 * iPhone, Safari decides whether to ask again. Once the user has used the
 * mic (so we know they want it) and the browser still isn't reporting a
 * standing "granted", show the one-time setting that stops the prompts.
 */
export function MicPermissionTip() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS()) return;
    let used = false;
    let dismissed = false;
    try {
      used = window.localStorage.getItem(MIC_USED_KEY) === "1";
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return;
    }
    if (!used || dismissed) return;
    let cancelled = false;
    const permissions = navigator.permissions;
    // Without the Permissions API we can't tell — assume it isn't standing-granted.
    const notGranted = permissions?.query
      ? permissions.query({ name: "microphone" as PermissionName }).then((status) => status.state !== "granted")
      : Promise.resolve(true);
    notGranted
      .catch(() => true)
      .then((value) => {
        if (!cancelled) setShow(value);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-2xl border bg-muted/40 px-3 py-2.5 text-sm" role="note">
      <Mic className="mt-0.5 size-4 shrink-0 text-primary dark:text-[#7FD6B2]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t("capture.micTip.title")}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t("capture.micTip.steps")}</p>
      </div>
      <button
        type="button"
        aria-label={t("capture.micTip.dismiss")}
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISSED_KEY, "1");
          } catch {
            // ignore
          }
          setShow(false);
        }}
        className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
