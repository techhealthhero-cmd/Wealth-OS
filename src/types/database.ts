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

import type { PlanId, SubscriptionStatus as BillingSubscriptionStatus } from "@/lib/billing/plans";

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

export type IncomeSourceType =
  | "salary"
  | "freelance"
  | "business"
  | "commission"
  | "bonus"
  | "investment"
  | "rental"
  | "side_hustle"
  | "other";

export type IncomeStability = "stable" | "variable";
export type IncomeFrequency = "monthly" | "biweekly" | "weekly" | "irregular" | "one_time";

export type SkillCategory =
  | "web_development"
  | "design"
  | "sales"
  | "marketing"
  | "fitness"
  | "teaching"
  | "translation"
  | "video_editing"
  | "photography"
  | "accounting"
  | "writing"
  | "customer_service"
  | "other";

export type ProficiencyLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type InterestLevel = "low" | "medium" | "high";
export type PreferredIncomeType = "active" | "passive" | "any";

export type IncomeModel = "hourly" | "project" | "recurring" | "product" | "commission";
export type OpportunityDifficulty = "easy" | "medium" | "hard";
export type WorkMode = "online" | "offline" | "both";
export type Scalability = "low" | "medium" | "high";
export type TimeToFirstIncome = "fast" | "medium" | "slow";

export type MissionType =
  | "define_offer"
  | "build_portfolio"
  | "set_price"
  | "create_profile"
  | "outreach"
  | "follow_up"
  | "publish_offer"
  | "close_client"
  | "list_product"
  | "raise_price"
  | "ask_referral"
  | "other";

export type MissionStatus = "not_started" | "in_progress" | "completed" | "skipped";
export type ImpactLevel = "low" | "medium" | "high";

export type WealthMissionType =
  | "tracking"
  | "budgeting"
  | "saving"
  | "debt"
  | "emergency_fund"
  | "goals"
  | "income"
  | "review"
  | "planning";

export type MissionRelatedDomain =
  | "priority_engine"
  | "wealth_score"
  | "income_engine"
  | "goals"
  | "emergency_fund"
  | "debt_planner"
  | "budget"
  | "manual";

export type XPEventType =
  | "first_budget_created"
  | "mission_completed"
  | "income_mission_completed"
  | "monthly_review_completed"
  | "goal_milestone"
  | "emergency_fund_milestone"
  | "debt_milestone";

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
export type RecurringTransactionType = "income" | "expense" | "transfer";

export type SubscriptionConfidence = "high" | "medium" | "low";
export type SubscriptionStatus = "pending" | "confirmed" | "dismissed" | "cancelled";

export type NotificationType =
  | "upcoming_bill"
  | "budget_near_limit"
  | "budget_exceeded"
  | "recurring_payment_due"
  | "subscription_detected"
  | "goal_milestone"
  | "emergency_fund_milestone"
  | "debt_milestone"
  | "monthly_review_due"
  | "mission_reminder";

export type TransactionSource = "manual" | "seed" | "import" | "recurring";

export type AssetType =
  | "cash"
  | "bank"
  | "savings"
  | "investment"
  | "gold"
  | "crypto"
  | "property"
  | "vehicle"
  | "business"
  | "other";

export type LiabilityType =
  | "credit_card"
  | "personal_loan"
  | "car_loan"
  | "mortgage"
  | "student_loan"
  | "informal_debt"
  | "other";

export type GoalType =
  | "emergency_fund"
  | "travel"
  | "gadget"
  | "car"
  | "home"
  | "education"
  | "wedding"
  | "business_capital"
  | "million"
  | "retirement"
  | "custom";

export type GoalPriority = "critical" | "high" | "medium" | "low";
export type GoalStatus = "active" | "completed" | "archived";

export type DebtStrategy = "snowball" | "avalanche" | "custom";
export type ForecastScenarioType = "base" | "conservative" | "optimistic" | "custom";

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
      budgets: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          total_budget: string;
          planned_savings: string;
          planned_investment: string;
          notes: string | null;
          expected_income: string;
          debt_reduction_target: string;
          goal_contribution_target: string;
          quarterly_plan_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["budgets"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; month: string };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Row"]>;
      };
      budget_categories: {
        Row: {
          id: string;
          budget_id: string;
          category_id: string;
          amount: string;
          is_fixed: boolean;
          is_essential: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["budget_categories"]["Row"], "id" | "created_at" | "updated_at">
        > & { budget_id: string; category_id: string };
        Update: Partial<Database["public"]["Tables"]["budget_categories"]["Row"]>;
      };
      assets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          asset_type: AssetType;
          value: string;
          currency_code: string;
          include_in_net_worth: boolean;
          linked_account_id: string | null;
          notes: string | null;
          last_updated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["assets"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; name: string; asset_type: AssetType };
        Update: Partial<Database["public"]["Tables"]["assets"]["Row"]>;
      };
      liabilities: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          liability_type: LiabilityType;
          balance: string;
          interest_rate: string | null;
          minimum_payment: string | null;
          due_date: string | null;
          include_in_net_worth: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["liabilities"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; name: string; liability_type: LiabilityType };
        Update: Partial<Database["public"]["Tables"]["liabilities"]["Row"]>;
      };
      net_worth_snapshots: {
        Row: {
          id: string;
          user_id: string;
          snapshot_date: string;
          total_assets: string;
          total_liabilities: string;
          net_worth: string;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["net_worth_snapshots"]["Row"], "id" | "created_at">> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["net_worth_snapshots"]["Row"]>;
      };
      financial_goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          goal_type: GoalType;
          target_amount: string;
          current_amount: string;
          target_date: string | null;
          priority: GoalPriority;
          monthly_contribution: string;
          linked_account_id: string | null;
          status: GoalStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["financial_goals"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; name: string; goal_type: GoalType; target_amount: string | number };
        Update: Partial<Database["public"]["Tables"]["financial_goals"]["Row"]>;
      };
      emergency_funds: {
        Row: {
          id: string;
          user_id: string;
          target_months: string | null;
          custom_target_amount: string | null;
          current_amount: string;
          monthly_contribution: string;
          linked_account_id: string | null;
          linked_goal_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["emergency_funds"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["emergency_funds"]["Row"]>;
      };
      wealth_scores: {
        Row: {
          id: string;
          user_id: string;
          total_score: string;
          cash_flow_score: string;
          savings_score: string;
          emergency_fund_score: string;
          debt_health_score: string;
          net_worth_growth_score: string;
          income_growth_score: string;
          goal_progress_score: string;
          calculation_version: number;
          calculated_at: string;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["wealth_scores"]["Row"], "id" | "created_at">> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["wealth_scores"]["Row"]>;
      };
      money_years: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          annual_income_target: string;
          annual_savings_target: string;
          annual_investment_target: string;
          annual_debt_reduction_target: string;
          annual_emergency_fund_target: string;
          expected_irregular_income: string;
          expected_irregular_expenses: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["money_years"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; year: number };
        Update: Partial<Database["public"]["Tables"]["money_years"]["Row"]>;
      };
      quarterly_plans: {
        Row: {
          id: string;
          user_id: string;
          money_year_id: string;
          quarter: number;
          income_target: string;
          savings_target: string;
          investment_target: string;
          debt_reduction_target: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["quarterly_plans"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; money_year_id: string; quarter: number };
        Update: Partial<Database["public"]["Tables"]["quarterly_plans"]["Row"]>;
      };
      money_year_major_expenses: {
        Row: {
          id: string;
          user_id: string;
          money_year_id: string;
          name: string;
          amount: string;
          planned_month: string | null;
          is_paid: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<
            Database["public"]["Tables"]["money_year_major_expenses"]["Row"],
            "id" | "created_at" | "updated_at"
          >
        > & { user_id: string; money_year_id: string; name: string; amount: string | number };
        Update: Partial<Database["public"]["Tables"]["money_year_major_expenses"]["Row"]>;
      };
      debt_plans: {
        Row: {
          id: string;
          user_id: string;
          strategy: DebtStrategy;
          extra_monthly_payment: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["debt_plans"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["debt_plans"]["Row"]>;
      };
      debt_plan_priorities: {
        Row: {
          id: string;
          debt_plan_id: string;
          liability_id: string;
          priority_order: number;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["debt_plan_priorities"]["Row"], "id" | "created_at">> & {
          debt_plan_id: string;
          liability_id: string;
          priority_order: number;
        };
        Update: Partial<Database["public"]["Tables"]["debt_plan_priorities"]["Row"]>;
      };
      forecast_scenarios: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          scenario_type: ForecastScenarioType;
          horizon_months: number;
          income_growth_rate: string;
          expense_growth_rate: string;
          monthly_savings: string;
          monthly_investment: string;
          monthly_debt_payment: string;
          one_time_income: string;
          one_time_income_month: string | null;
          one_time_expense: string;
          one_time_expense_month: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["forecast_scenarios"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["forecast_scenarios"]["Row"]>;
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["ai_conversations"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["ai_conversations"]["Row"]>;
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["ai_messages"]["Row"], "id" | "created_at">> & {
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_messages"]["Row"]>;
      };
      ai_usage_log: {
        Row: {
          id: string;
          user_id: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["ai_usage_log"]["Row"], "id" | "created_at">> & {
          user_id: string;
          model: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage_log"]["Row"]>;
      };
      income_sources: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          source_type: IncomeSourceType;
          expected_monthly_income: string;
          stability: IncomeStability;
          frequency: IncomeFrequency;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["income_sources"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; name: string; source_type: IncomeSourceType };
        Update: Partial<Database["public"]["Tables"]["income_sources"]["Row"]>;
      };
      user_skills: {
        Row: {
          id: string;
          user_id: string;
          skill_name: string;
          category: SkillCategory;
          proficiency_level: ProficiencyLevel;
          experience_months: number | null;
          monetized_before: boolean;
          notes: string | null;
          interest_level: InterestLevel;
          available_hours_per_week: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["user_skills"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; skill_name: string; category: SkillCategory };
        Update: Partial<Database["public"]["Tables"]["user_skills"]["Row"]>;
      };
      income_targets: {
        Row: {
          id: string;
          user_id: string;
          target_monthly_income: string | null;
          desired_extra_income: string | null;
          target_date: string | null;
          preferred_income_type: PreferredIncomeType;
          max_hours_per_week: string | null;
          max_startup_cost: string | null;
          work_mode_preference: WorkMode | "any";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["income_targets"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["income_targets"]["Row"]>;
      };
      income_opportunities: {
        Row: {
          id: string;
          slug: string;
          name_th: string;
          name_en: string;
          description_th: string;
          description_en: string;
          required_skill_categories: SkillCategory[];
          recommended_proficiency: ProficiencyLevel;
          estimated_startup_cost_min: string;
          estimated_startup_cost_max: string;
          estimated_hours_per_week_min: string;
          estimated_hours_per_week_max: string;
          income_model: IncomeModel;
          difficulty: OpportunityDifficulty;
          work_mode: WorkMode;
          scalability: Scalability;
          time_to_first_income: TimeToFirstIncome;
          estimated_monthly_income_min: string;
          estimated_monthly_income_max: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
      income_missions: {
        Row: {
          id: string;
          user_id: string;
          related_opportunity_id: string | null;
          title: string;
          description: string | null;
          mission_type: MissionType;
          target_quantity: string | null;
          progress_quantity: string;
          status: MissionStatus;
          sequence_order: number;
          due_date: string | null;
          estimated_minutes: number | null;
          impact_level: ImpactLevel;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["income_missions"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; title: string; mission_type: MissionType };
        Update: Partial<Database["public"]["Tables"]["income_missions"]["Row"]>;
      };
      wealth_missions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          mission_type: WealthMissionType;
          related_domain: MissionRelatedDomain | null;
          target_quantity: string | null;
          progress_quantity: string;
          status: MissionStatus;
          due_date: string | null;
          impact_level: ImpactLevel;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["wealth_missions"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; title: string; mission_type: WealthMissionType };
        Update: Partial<Database["public"]["Tables"]["wealth_missions"]["Row"]>;
      };
      xp_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: XPEventType;
          xp_amount: number;
          related_id: string | null;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["xp_events"]["Row"], "id" | "created_at">> & {
          user_id: string;
          event_type: XPEventType;
          xp_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["xp_events"]["Row"]>;
      };
      recurring_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: RecurringTransactionType;
          amount: string;
          account_id: string | null;
          from_account_id: string | null;
          to_account_id: string | null;
          category_id: string | null;
          merchant: string | null;
          description: string | null;
          frequency: RecurringFrequency;
          start_date: string;
          end_date: string | null;
          next_due_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["recurring_transactions"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; type: RecurringTransactionType; amount: string; frequency: RecurringFrequency; start_date: string; next_due_date: string };
        Update: Partial<Database["public"]["Tables"]["recurring_transactions"]["Row"]>;
      };
      detected_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          merchant: string;
          estimated_amount: string;
          frequency: RecurringFrequency;
          confidence: SubscriptionConfidence;
          status: SubscriptionStatus;
          occurrence_count: number;
          first_seen_date: string;
          last_seen_date: string;
          next_expected_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["detected_subscriptions"]["Row"], "id" | "created_at" | "updated_at">
        > & {
          user_id: string;
          merchant: string;
          estimated_amount: string;
          frequency: RecurringFrequency;
          confidence: SubscriptionConfidence;
          first_seen_date: string;
          last_seen_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["detected_subscriptions"]["Row"]>;
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string;
          upcoming_bill: boolean;
          budget_near_limit: boolean;
          budget_exceeded: boolean;
          recurring_payment_due: boolean;
          subscription_detected: boolean;
          goal_milestone: boolean;
          emergency_fund_milestone: boolean;
          debt_milestone: boolean;
          monthly_review_due: boolean;
          mission_reminder: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["notification_preferences"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["notification_preferences"]["Row"]>;
      };
      financial_notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          related_id: string | null;
          dedupe_key: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["financial_notifications"]["Row"], "id" | "created_at">> & {
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          dedupe_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["financial_notifications"]["Row"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: PlanId;
          status: BillingSubscriptionStatus;
          provider: "stripe" | null;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          provider_price_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          trial_end: string | null;
          /** The source webhook event's own timestamp, last applied to this row — guards against out-of-order/stale webhook redelivery. Null for rows that predate this column. */
          last_webhook_event_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
      };
      billing_events: {
        Row: {
          id: string;
          provider: "stripe";
          provider_event_id: string;
          event_type: string;
          payload: Record<string, unknown>;
          processed_at: string;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["billing_events"]["Row"], "id" | "processed_at" | "created_at">> & {
          provider: "stripe";
          provider_event_id: string;
          event_type: string;
          payload: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["billing_events"]["Row"]>;
      };
      monthly_reviews: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          month: number;
          income_cents: number;
          expenses_cents: number;
          cash_flow_cents: number;
          savings_rate_percent: string;
          net_worth_change_cents: number | null;
          budget_percent_used: string | null;
          debt_paid_cents: number;
          emergency_fund_months_protected: string | null;
          goals_progress_percent: string | null;
          income_gap_cents: number | null;
          missions_completed_count: number;
          what_went_well: string | null;
          what_to_reduce: string | null;
          next_month_focus: string | null;
          notes: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Omit<Database["public"]["Tables"]["monthly_reviews"]["Row"], "id" | "created_at" | "updated_at">
        > & { user_id: string; year: number; month: number };
        Update: Partial<Database["public"]["Tables"]["monthly_reviews"]["Row"]>;
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
export type Budget = Database["public"]["Tables"]["budgets"]["Row"];
export type BudgetCategory = Database["public"]["Tables"]["budget_categories"]["Row"];
export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type Liability = Database["public"]["Tables"]["liabilities"]["Row"];
export type NetWorthSnapshot = Database["public"]["Tables"]["net_worth_snapshots"]["Row"];
export type FinancialGoal = Database["public"]["Tables"]["financial_goals"]["Row"];
export type EmergencyFund = Database["public"]["Tables"]["emergency_funds"]["Row"];
export type WealthScore = Database["public"]["Tables"]["wealth_scores"]["Row"];
export type MoneyYear = Database["public"]["Tables"]["money_years"]["Row"];
export type QuarterlyPlan = Database["public"]["Tables"]["quarterly_plans"]["Row"];
export type MoneyYearMajorExpense = Database["public"]["Tables"]["money_year_major_expenses"]["Row"];
export type DebtPlan = Database["public"]["Tables"]["debt_plans"]["Row"];
export type DebtPlanPriority = Database["public"]["Tables"]["debt_plan_priorities"]["Row"];
export type ForecastScenario = Database["public"]["Tables"]["forecast_scenarios"]["Row"];
export type AIConversation = Database["public"]["Tables"]["ai_conversations"]["Row"];
export type AIMessageRow = Database["public"]["Tables"]["ai_messages"]["Row"];
export type AIUsageLog = Database["public"]["Tables"]["ai_usage_log"]["Row"];
export type IncomeSource = Database["public"]["Tables"]["income_sources"]["Row"];
export type UserSkill = Database["public"]["Tables"]["user_skills"]["Row"];
export type IncomeTarget = Database["public"]["Tables"]["income_targets"]["Row"];
export type IncomeOpportunity = Database["public"]["Tables"]["income_opportunities"]["Row"];
export type IncomeMission = Database["public"]["Tables"]["income_missions"]["Row"];
export type WealthMission = Database["public"]["Tables"]["wealth_missions"]["Row"];
export type XPEvent = Database["public"]["Tables"]["xp_events"]["Row"];
export type RecurringTransaction = Database["public"]["Tables"]["recurring_transactions"]["Row"];
export type DetectedSubscription = Database["public"]["Tables"]["detected_subscriptions"]["Row"];
export type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"];
export type FinancialNotification = Database["public"]["Tables"]["financial_notifications"]["Row"];
export type MonthlyReview = Database["public"]["Tables"]["monthly_reviews"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type BillingEvent = Database["public"]["Tables"]["billing_events"]["Row"];
