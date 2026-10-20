"use client";

/** Load only scripts served by this app. Failed loads can be retried. */
const scripts = new Map<string, Promise<void>>();
export function loadLocalSlipScript(path: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Slip reader requires a browser"));
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) return Promise.reject(new Error("Slip assets must be same-origin"));
  const existing = scripts.get(url.href);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url.href; script.async = true;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => { script.remove(); scripts.delete(url.href); reject(new Error(`Missing local slip asset: ${path}`)); };
    document.head.appendChild(script);
  });
  scripts.set(url.href, promise);
  return promise;
}
