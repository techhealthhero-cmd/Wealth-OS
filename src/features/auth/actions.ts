"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getClientEnv } from "@/config/env";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";

export interface ActionResult {
  error?: string;
}

/**
 * Never surface raw Supabase/Postgres error internals to the user IN
 * PRODUCTION. The real error is always logged server-side (check the
 * terminal running `next dev` / your host's server logs — never the
 * browser console, since this runs on the server).
 *
 * In development, the real message is also returned to the client so it's
 * visible in the UI without digging through logs. This is gated on
 * `NODE_ENV` so it can never leak in a deployed build.
 */
function safeAuthError(error: { message: string; status?: number; code?: string }): string {
  console.error("[auth] Supabase error:", {
    message: error.message,
    status: error.status,
    code: error.code,
  });

  const known: Record<string, string> = {
    "Invalid login credentials": "Invalid email or password.",
    "User already registered": "An account with this email already exists.",
    "Email not confirmed": "Please confirm your email address before logging in.",
  };
  if (known[error.message]) return known[error.message];

  if (process.env.NODE_ENV !== "production") {
    return `[dev] Supabase error (${error.status ?? "?"}${error.code ? `/${error.code}` : ""}): ${error.message}`;
  }

  return "Something went wrong. Please try again.";
}

export async function login(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: safeAuthError(error) };
  }

  redirect("/dashboard");
}

export async function signup(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    display_name: formData.get("display_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const env = getClientEnv();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.display_name },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: safeAuthError(error) };
  }

  redirect("/onboarding");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPassword(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const env = getClientEnv();

  // Always report success even if the email doesn't exist, so this endpoint
  // can't be used to enumerate registered accounts.
  //
  // redirectTo points at /auth/callback (not /reset-password directly) so the
  // recovery link's `code` param is exchanged for a real session first — the
  // reset-password page/action need an active session to call
  // supabase.auth.updateUser(); landing there without exchanging the code
  // first fails with "Auth session missing!".
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  return {};
}

export async function resetPassword(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: safeAuthError(error) };
  }

  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const env = getClientEnv();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}
