/**
 * Hand-written types mirroring supabase/migrations/0001_init.sql and
 * 0002_system_categories.sql.
 *
 * These were written by hand because this project isn't yet linked to a
 * live Supabase project to run `supabase gen types typescript`. Once a
 * project exists, regenerate with:
 *
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * and reconcile any drift against the domain types in this file.
 *
 * NOTE: the `Database` interface below is NOT currently passed as a generic
 * to the Supabase clients (see lib/supabase/client.ts) — the installed
 * @supabase-js/postgrest-js prerelease has a stricter generic contract than
 * plain `supabase gen types` output satisfies. It's kept here as living
 * documentation of the schema shape and a target to wire back in once
 * codegen is available. The `Profile` / `Account` / `Category` /
 * `Transaction` / `Tag` row types below ARE used throughout the app for
 * query/action return types.
 */

export type AccountType =
  | "cash"
  | "bank"
  | "savings"
  | "e_wallet"
  | "credit_card"
  | "investment"
  | "other";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "debt_payment"
  | "savings_transfer"
  | "investment_allocation";

export type CategoryType = "income" | "expense" | "both";

export type TransactionSource = "manual" | "seed" | "import" | "recurring";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string | null;
          preferred_language: "th" | "en";
          currency_code: string;
          timezone: string;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["profiles"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          account_type: AccountType;
          institution: string | null;
          currency_code: string;
          opening_balance: string;
          current_balance: string;
          include_in_net_worth: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<
            Database["public"]["Tables"]["accounts"]["Row"],
            "id" | "current_balance" | "created_at" | "updated_at"
          >
        > & {
          user_id: string;
          name: string;
          account_type: AccountType;
        };
        Update: Partial<
          Omit<Database["public"]["Tables"]["accounts"]["Row"], "id" | "current_balance">
        >;
      };
      categories: {
        Row: {
          id: string;
          user_id: string | null;
          name_th: string;
          name_en: string;
          type: CategoryType;
          icon: string | null;
          is_system: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at">> & {
          name_th: string;
          name_en: string;
          type: CategoryType;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          from_account_id: string | null;
          to_account_id: string | null;
          category_id: string | null;
          type: TransactionType;
          amount: string;
          currency_code: string;
          transaction_date: string;
          description: string | null;
          merchant: string | null;
          notes: string | null;
          is_recurring: boolean;
          source: TransactionSource;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["transactions"]["Row"], "id" | "created_at" | "updated_at">
        > & {
          user_id: string;
          type: TransactionType;
          amount: string | number;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Row"]>;
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["tags"]["Row"], "id" | "created_at">> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["tags"]["Row"]>;
      };
      transaction_tags: {
        Row: {
          transaction_id: string;
          tag_id: string;
        };
        Insert: Database["public"]["Tables"]["transaction_tags"]["Row"];
        Update: Partial<Database["public"]["Tables"]["transaction_tags"]["Row"]>;
      };
    };
    Functions: {
      create_transfer: {
        Args: {
          p_from_account_id: string;
          p_to_account_id: string;
          p_amount: number;
          p_transaction_date?: string;
          p_description?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["transactions"]["Row"];
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
