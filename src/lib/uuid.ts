import { createHash } from "node:crypto";

/**
 * Fixed, arbitrary namespace for this app's deterministic (UUID v5-style)
 * idempotency keys — see `deterministicUuid()`. Never changes once anything
 * depends on it: changing it would silently change every derived key,
 * breaking the "same input always produces the same key" guarantee that
 * makes it useful for idempotency in the first place.
 */
const WEALTH_OS_NAMESPACE = "5f1c7a2e-8b3d-4e6a-9f0c-2d7b3a9d5e11";

/**
 * Deterministically derives a UUID from a name string (RFC 4122 UUID v5:
 * SHA-1 of namespace+name, with the version/variant bits fixed up). The
 * same `name` always produces the same UUID — unlike `crypto.randomUUID()`,
 * which is random every call.
 *
 * Used for server-side idempotency keys where there's no client form to
 * hold a random key steady across a retry (e.g. confirming a recurring
 * transaction) — deriving the key from stable identifiers already
 * available (e.g. `recurring transaction id + due date`) gives the exact
 * same "same intent = same key" property a client-generated key gives
 * `createTransaction`/`createTransfer`, reusing the same database
 * uniqueness mechanism rather than inventing a second one.
 */
export function deterministicUuid(name: string): string {
  const namespaceBytes = Buffer.from(WEALTH_OS_NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(namespaceBytes).update(name, "utf8").digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
