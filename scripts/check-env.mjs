#!/usr/bin/env node
/**
 * Day 8 STEP 2 — manual production-readiness env check. Run this against
 * whatever environment's variables are loaded (e.g. `vercel env pull` first,
 * or Vercel's own "Run command" in a deploy hook) before flipping a
 * production switch. Prints only variable NAMES and a present/missing
 * status — never a value, even in part.
 *
 * Usage: node scripts/check-env.mjs
 */

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_APP_URL"];

const RECOMMENDED = ["SUPABASE_SERVICE_ROLE_KEY", "AI_API_KEY", "AI_MODEL"];

const BILLING = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID_PLUS", "STRIPE_PRICE_ID_PRO"];

const CRON = ["CRON_SECRET"];

function status(name) {
  const set = Boolean(process.env[name] && process.env[name].length > 0);
  return `${set ? "✅" : "❌"} ${name}`;
}

console.log("Required (app cannot function without these):");
for (const name of REQUIRED) console.log(" ", status(name));

console.log("\nRecommended (specific features degrade cleanly without these):");
for (const name of RECOMMENDED) console.log(" ", status(name));

console.log("\nBilling (all four or none — a partial set is worse than none):");
const billingSet = BILLING.filter((name) => process.env[name]);
for (const name of BILLING) console.log(" ", status(name));
if (billingSet.length > 0 && billingSet.length < BILLING.length) {
  console.log(`  ⚠️  Partially configured (${billingSet.length}/${BILLING.length}) — see src/config/env.ts's production check.`);
}
if (billingSet.length === BILLING.length && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("  ⚠️  Billing is fully configured but SUPABASE_SERVICE_ROLE_KEY is missing — billing writes will throw.");
}

console.log("\nCron (missing means the monthly AI check-in job never fires, not that its auth check is skipped):");
for (const name of CRON) console.log(" ", status(name));

const missingRequired = REQUIRED.filter((name) => !process.env[name]);
if (missingRequired.length > 0) {
  console.error(`\n❌ Missing required: ${missingRequired.join(", ")}`);
  process.exit(1);
}

console.log("\n✅ All required variables are present.");
