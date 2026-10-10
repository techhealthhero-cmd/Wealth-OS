import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/0041_account_aliases.sql"), "utf8");

describe("account alias migration security contract", () => {
  it("keeps every alias user-owned behind RLS", () => {
    expect(migration).toContain("alter table public.account_aliases enable row level security");
    expect(migration).toMatch(/for select using \(user_id = auth\.uid\(\)\)/);
    expect(migration).toMatch(/for insert with check \(user_id = auth\.uid\(\)\)/);
    expect(migration).toMatch(/for update using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/);
    expect(migration).toMatch(/for delete using \(user_id = auth\.uid\(\)\)/);
  });

  it("rejects an alias that points at another user's account", () => {
    expect(migration).toContain("check_account_alias_ownership_trg");
    expect(migration).toMatch(/where id = new\.account_id and user_id = new\.user_id/);
    expect(migration).toMatch(/before insert or update of account_id, user_id/);
  });

  it("stores cents nowhere and keeps the nickname shape constrained", () => {
    expect(migration).toMatch(/char_length\(btrim\(alias\)\) between 1 and 60/);
    expect(migration).toMatch(/source in \('user', 'learned'\)/);
    expect(migration).toMatch(/unique index account_aliases_user_alias_idx[\s\S]*user_id, alias_normalized/);
  });
});
