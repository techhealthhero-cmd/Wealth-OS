import { describe, expect, it } from "vitest";

import { deterministicUuid } from "@/lib/uuid";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("deterministicUuid", () => {
  it("produces a valid, well-formed UUID (v5 version/variant bits set)", () => {
    const id = deterministicUuid("recurring-confirm:abc:2026-09-17");
    expect(id).toMatch(UUID_RE);
  });

  it("is deterministic — the same name always produces the same UUID", () => {
    const a = deterministicUuid("recurring-confirm:abc:2026-09-17");
    const b = deterministicUuid("recurring-confirm:abc:2026-09-17");
    expect(a).toBe(b);
  });

  it("produces different UUIDs for different names", () => {
    const a = deterministicUuid("recurring-confirm:abc:2026-09-17");
    const b = deterministicUuid("recurring-confirm:abc:2026-10-17");
    const c = deterministicUuid("recurring-confirm:xyz:2026-09-17");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });
});
