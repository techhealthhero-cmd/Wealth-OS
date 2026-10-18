import { describe, expect, it } from "vitest";
import { assertStagingSupabase } from "../scripts/lib/assert-staging-supabase.mjs";

const staging = "eovyvlesdgygjqrrvpas.supabase.co";
const production = "lvxuruzspchhcwebrbzy.supabase.co";

describe("live Supabase target guard", () => {
  it("allows the existing staging URL", () => {
    expect(() => assertStagingSupabase(`https://${staging}`)).not.toThrow();
  });

  it.each([
    `https://${production}`, `https://${production.toUpperCase()}`,
    `https://${production}/?allow=staging`,
    `https://${production}/eovyvlesdgygjqrrvpas`,
    `https://${staging}.${production}`, `https://${staging}.example.com`,
    `https://${staging}@${production}`, `https://secret@${staging}`,
    `http://${staging}`, `https://${staging}:1234`,
    "https://other.supabase.co", "http://localhost:54321", "secret-invalid-url", "",
  ])("rejects unsafe target %s without exposing input", (url) => {
    expect(() => assertStagingSupabase(url)).toThrow(/Live Supabase admin refused:/);
    try {
      assertStagingSupabase(url);
    } catch (error) {
      expect((error as Error).message).not.toContain("secret");
    }
  });
});
