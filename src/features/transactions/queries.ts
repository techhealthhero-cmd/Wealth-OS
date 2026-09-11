import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Transaction, TransactionType } from "@/types/database";

export interface TransactionWithRelations extends Transaction {
  account: { id: string; name: string } | null;
  from_account: { id: string; name: string } | null;
  to_account: { id: string; name: string } | null;
  category: { id: string; name_th: string; name_en: string; icon: string | null } | null;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  search?: string;
  limit?: number;
}

const SELECT_WITH_RELATIONS = `
  *,
  account:accounts!transactions_account_id_fkey(id, name),
  from_account:accounts!transactions_from_account_id_fkey(id, name),
  to_account:accounts!transactions_to_account_id_fkey(id, name),
  category:categories(id, name_th, name_en, icon)
`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgREST builds its filter grammar from this string verbatim — `,` and
 * `()` are structural characters in `.or()` syntax, so an unescaped user
 * value could break the intended filter (never a SQL injection risk, since
 * RLS enforces `user_id = auth.uid()` independently of any filter mangling,
 * but it could still produce a confusing/incorrect result set). Stripping
 * them is a reasonable trade for a free-text search box.
 */
function sanitizeForOrFilter(value: string): string {
  return value.replace(/[,()]/g, "").trim();
}

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<TransactionWithRelations[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select(SELECT_WITH_RELATIONS)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.from) query = query.gte("transaction_date", filters.from);
  if (filters.to) query = query.lte("transaction_date", filters.to);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.categoryId && UUID_RE.test(filters.categoryId)) {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.accountId && UUID_RE.test(filters.accountId)) {
    const id = filters.accountId;
    query = query.or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`);
  }
  if (filters.search) {
    const term = sanitizeForOrFilter(filters.search);
    if (term) {
      query = query.or(`description.ilike.%${term}%,merchant.ilike.%${term}%`);
    }
  }
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error("Failed to load transactions");
  return (data ?? []) as unknown as TransactionWithRelations[];
}

export interface QuickRepeatCandidate {
  type: Exclude<TransactionType, "transfer">;
  accountId: string;
  categoryId: string | null;
  merchant: string | null;
  amount: string;
  count: number;
}

/**
 * Recent/frequent non-transfer transactions, collapsed to one entry per
 * distinct (type, category, merchant) combination — the most recently used
 * account + amount for that combination wins, and entries are ranked by how
 * often they recur, then by recency. Deliberately just a frequency count,
 * not a prediction model — see PROJECT_STATUS.md "Recent transaction quick
 * repeat" for why that's a hard requirement.
 */
export async function getQuickRepeatCandidates(limit = 6): Promise<QuickRepeatCandidate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("type, account_id, category_id, merchant, amount, transaction_date, created_at")
    .neq("type", "transfer")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error("Failed to load recent transactions");

  const byKey = new Map<string, QuickRepeatCandidate & { rank: number }>();
  (data ?? []).forEach((row, index) => {
    const key = `${row.type}|${row.category_id ?? ""}|${row.merchant ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    byKey.set(key, {
      type: row.type as Exclude<TransactionType, "transfer">,
      accountId: row.account_id as string,
      categoryId: row.category_id,
      merchant: row.merchant,
      amount: row.amount,
      count: 1,
      rank: index,
    });
  });

  return Array.from(byKey.values())
    .sort((a, b) => b.count - a.count || a.rank - b.rank)
    .slice(0, limit)
    .map((candidate) => ({
      type: candidate.type,
      accountId: candidate.accountId,
      categoryId: candidate.categoryId,
      merchant: candidate.merchant,
      amount: candidate.amount,
      count: candidate.count,
    }));
}

export function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toISODate = (d: Date) => d.toISOString().slice(0, 10);
  return { from: toISODate(from), to: toISODate(to) };
}
