@AGENTS.md

# WEALTH OS — PROJECT MEMORY

## Project

Name: WEALTH OS

WEALTH OS is a personal financial operating system designed to help users:

1. Understand where their money goes
2. Control spending
3. Build savings
4. Manage debt
5. Increase income
6. Build net worth
7. Create annual financial plans
8. Receive personalized financial actions from AI

Core philosophy:

Track → Analyze → Plan → Earn → Grow

The product must NOT become only an expense tracker.

The long-term goal is to answer:

"What is the next best financial action for this user?"

---

# CORE PRODUCT POSITIONING

Tagline:

Know your money. Grow your income. Build your wealth.

Thai concept:

ระบบการเงินส่วนบุคคลที่ช่วยให้ผู้ใช้รู้สถานะทางการเงิน
ควบคุมเงิน วางแผน เพิ่มรายได้ และสร้างความมั่งคั่ง

Important:

Never promise that users will become rich.

Never guarantee financial or investment returns.

---

# TARGET MARKET

Initial market:

Thailand

Primary language:

Thai

Secondary language:

English

Default currency:

THB

Default timezone:

Asia/Bangkok

Architecture must support international expansion later.

---

# PRODUCT NAVIGATION

Primary navigation:

Home
Money
Plan
Earn
AI

Do not expose every feature as separate top-level navigation.

---

# PRODUCT SYSTEMS

WEALTH OS architecture must support:

1. Accounts
2. Income / Expense Transactions
3. Smart Budget
4. Safe-to-Spend
5. Net Worth
6. Wealth Score
7. Financial Life Stage
8. Goals
9. Money Year
10. Financial Forecast
11. AI Money Coach
12. Financial Health Check
13. Subscription Detector
14. Debt Planner
15. Emergency Fund
16. Income Engine
17. Side Hustle Finder
18. Income / Wealth Missions

Additional supporting systems:

Notifications
Gamification
Wealth XP
Recurring Transactions
Upcoming Bills
Financial Alerts
Next Best Action Engine
Subscription Plans
Analytics
Feature Flags

---

# CORE DIFFERENTIATOR

Most financial applications focus on:

Expense tracking.

WEALTH OS must focus on:

Financial progress.

The major differentiator is:

EARN

The app should help users increase income, not only reduce spending.

---

# EARN SYSTEM

Users provide:

Occupation
Income
Skills
Experience
Available time
Languages
Equipment
Vehicle availability
Online/offline preferences
Target extra income

System calculates:

Current Income

Target Income

Income Gap

Then suggests realistic income opportunities.

Example:

Current Income:
฿35,000/month

Target:
฿50,000/month

Income Gap:
฿15,000/month

The system then generates actionable Income Missions.

Example:

Create portfolio
Create service offer
Find 10 leads
Contact 3 prospects
Follow up
Send quotation

Avoid vague missions such as:

"Work harder."

---

# MONEY YEAR

The application must support annual financial planning.

Structure:

Year
→ Quarter
→ Month
→ Week / Missions

Example:

Starting Net Worth
Target Net Worth
Annual Income Target
Savings Target
Investment Target
Debt Repayment Target
Side Income Target
Major Purchases

Historical annual plans must not be overwritten.

Use versioning.

---

# FINANCIAL DATA RULE

Structured database data is the source of truth.

AI MUST NOT invent:

Balances
Transactions
Income
Expenses
Debt
Net Worth
Budget
Goal progress

AI should use controlled financial tools.

---

# AI ARCHITECTURE

AI must never directly generate arbitrary SQL.

Use controlled functions such as:

getFinancialSummary()

getAccountBalances()

getTransactions()

getIncomeSummary()

getExpenseSummary()

getBudgetStatus()

getNetWorth()

getGoals()

getEmergencyFund()

getDebtSummary()

getIncomeProfile()

getMoneyYear()

runForecast()

getWealthScore()

getAvailableMissions()

AI should fetch current structured financial data before answering financial questions.

---

# FINANCIAL LOGIC

Financial calculations must be deterministic.

Do NOT use an LLM for calculations such as:

Net Worth

Safe-to-Spend

Debt payoff

Savings Rate

Wealth Score

Goal contribution

Forecast calculations

Income Gap

Create testable domain functions.

---

# NET WORTH

Formula:

Net Worth = Assets - Liabilities

Net Worth is one of the primary product KPIs.

---

# WEALTH SCORE

Score:

0–100

Initial model:

Cash Flow Health: 20%

Savings Rate: 15%

Emergency Fund: 15%

Debt Health: 15%

Net Worth Growth: 15%

Income Growth: 10%

Goal Progress: 10%

Wealth Score must be deterministic.

Store calculation version.

---

# NEXT BEST ACTION ENGINE

Long-term product objective:

Turn financial information into action.

Priority examples:

1. Overdue financial obligation
2. Negative cash flow
3. Emergency Fund
4. High-interest debt
5. Financial goals
6. Income gap
7. Investing
8. Expense optimization

Example:

Next Best Action:

เติม Emergency Fund ฿2,000

Reason:

เงินสำรองเหลือประมาณ 1.6 เดือน

---

# TECH STACK

Frontend:

Next.js
React
TypeScript

UI:

Tailwind CSS
shadcn/ui

Backend:

Next.js Server Actions / Route Handlers

Database:

PostgreSQL

Infrastructure:

Supabase

Authentication:

Supabase Auth

Deployment:

Vercel

Validation:

Zod

Charts:

Recharts

Forms:

React Hook Form where appropriate

Testing:

Vitest or existing project testing stack

Future mobile:

React Native + Expo

---

# DATABASE RULES

Use UUID primary keys.

Use created_at.

Use updated_at.

Money must NOT use floating-point database types.

Prefer:

NUMERIC(18,2)

Financial tables must include user ownership.

RLS is mandatory.

---

# SECURITY

Financial data is sensitive.

Never:

Expose service role key to browser

Trust user_id sent by client

Disable RLS to solve errors

Commit secrets

Log sensitive financial data unnecessarily

Allow one user to access another user's data

Use arbitrary AI-generated SQL

All financial write operations must validate authentication and ownership.

---

# SUPABASE

Environment variables:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

Service role key is SERVER ONLY.

Never use NEXT_PUBLIC_ for secret keys.

Database migrations must live in:

supabase/migrations/

Schema changes must be reproducible through migrations.

---

# AUTH

Current architecture:

Supabase Auth

Support:

Email/password

Google OAuth architecture

Future Apple Sign-In

Important:

Signup flow must correctly handle:

successful signup
email confirmation
session creation
profile creation
duplicate email
invalid credentials

Do not convert every auth problem into generic:
"Something went wrong."

---

# UI / UX

Mobile-first.

Target widths:

375px
390px
430px

Desktop responsive.

Design:

Premium fintech
Clean
Trustworthy
Minimal
Modern

Avoid gambling / crypto casino visual style.

Thai text must display correctly.

---

# APPLICATION ROUTES

Expected architecture includes:

/
login
signup
onboarding

dashboard

money
money/transactions
money/accounts
money/budget
money/net-worth
money/subscriptions

plan
plan/goals
plan/money-year
plan/emergency-fund
plan/debt
plan/forecast

earn
earn/income
earn/skills
earn/opportunities
earn/missions

ai

notifications

settings
settings/profile
settings/security
settings/preferences
settings/billing

---

# CURRENT DEVELOPMENT PHASE

The project is being built incrementally.

Phase 0:
Foundation

Phase 1:
Money

Phase 2:
Wealth Engine

Phase 3:
Financial Planning

Phase 4:
AI Money Coach

Phase 5:
Income Engine

Phase 6:
Engagement

Phase 7:
SaaS / Billing

Phase 8:
Production Hardening

Do NOT rebuild the project from scratch when starting a new phase.

Always inspect and extend the existing codebase.

---

# DEVELOPMENT RULE

Before implementing any new task:

1. Read CLAUDE.md
2. Read PROJECT_STATUS.md
3. Inspect existing code
4. Inspect git status
5. Understand existing architecture
6. Preserve working functionality

For any visual/graphics work specifically, also read `GRAPHICS_PLAN.md` —
the single source of truth for visual direction, icon/illustration rules,
asset inventory, and roadmap.

Then implement.

---

# NEVER DO THIS

Never:

Reinitialize the project unnecessarily

Delete working features

Replace architecture without reason

Create duplicate modules

Hard-code user IDs

Hard-code secrets

Use fake financial data for real users

Create fake successful integrations

Add dead buttons

Disable tests to pass builds

Disable TypeScript errors

Disable RLS

Use excessive `any`

Claim a feature works without testing it

---

# DEFINITION OF DONE

A feature is not finished just because the UI exists.

A feature should have:

Working UI

Database persistence

Validation

Authorization

RLS where appropriate

Loading state

Empty state

Error state

Responsive mobile layout

Tests for critical logic

Successful typecheck

Successful lint

Successful production build

---

# QUALITY CHECK

After major work run:

npm run lint

npm run typecheck

npm test

npm run build

If typecheck script does not exist:

npx tsc --noEmit

Fix critical failures before declaring completion.

---

# WORKING STYLE

You are authorized to make reasonable engineering decisions.

Do not repeatedly ask the user trivial technical questions.

If information is missing:

choose the safest maintainable approach.

Document assumptions.

Continue implementation.

However:

Never perform destructive actions involving production data, credentials,
billing, external accounts, or irreversible operations without explicit approval.

---

# IMPORTANT: PROJECT CONTINUITY

This project will be developed over many sessions.

Never assume a new request means starting a new project.

Unless explicitly told otherwise:

ALL future WEALTH OS requests refer to this existing codebase.

Before making changes:

inspect what already exists.

Build on top of it.

Do not recreate completed functionality.

---

# END PROJECT MEMORY
