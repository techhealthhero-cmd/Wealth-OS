"use client";

/**
 * Earn segment error boundary. Reuses the app's root boundary (bounded
 * auto-retry with backoff, retry-on-reconnect, stale-deploy reload) so a
 * failed Earn data load shows a real "couldn't load" state with retry —
 * inside the Earn layout — instead of being mistaken for a first-time user.
 */
export { default } from "@/app/error";
