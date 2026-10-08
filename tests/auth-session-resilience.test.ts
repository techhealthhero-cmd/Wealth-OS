import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import { isTransientAuthError } from "@/lib/supabase/auth-errors";
import { redirectWithSessionCookies } from "@/lib/supabase/middleware";

describe("auth session resilience", () => {
  it("does not sign a user out for retryable network and service failures", () => {
    expect(isTransientAuthError({ name: "AuthRetryableFetchError", status: 0 })).toBe(true);
    expect(isTransientAuthError({ name: "AuthApiError", status: 503 })).toBe(true);
    expect(isTransientAuthError({ name: "AuthApiError", status: 429 })).toBe(true);
    expect(isTransientAuthError({ name: "AuthApiError", status: 400, code: "request_timeout" })).toBe(true);
    expect(isTransientAuthError({ name: "AuthUnknownError" })).toBe(true);
  });

  it("recognizes definite missing, expired, and revoked sessions", () => {
    expect(isTransientAuthError({ name: "AuthSessionMissingError", status: 400 })).toBe(false);
    expect(isTransientAuthError({ name: "AuthApiError", status: 400, code: "session_expired" })).toBe(false);
    expect(isTransientAuthError({ name: "AuthApiError", status: 400, code: "refresh_token_not_found" })).toBe(false);
    expect(isTransientAuthError({ name: "AuthApiError", status: 401, code: "bad_jwt" })).toBe(false);
  });

  it("fails closed for ordinary client-side authentication rejection", () => {
    expect(isTransientAuthError({ name: "AuthApiError", status: 401, code: "invalid_credentials" })).toBe(false);
    expect(isTransientAuthError(null)).toBe(false);
  });

  it("preserves rotated session cookies when auth handling redirects", () => {
    const refreshed = NextResponse.next();
    refreshed.cookies.set("sb-session", "rotated-token", {
      httpOnly: true,
      maxAge: 3600,
      sameSite: "lax",
    });

    const redirect = redirectWithSessionCookies(
      new URL("https://wealth.example/dashboard"),
      refreshed
    );

    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("location")).toBe("https://wealth.example/dashboard");
    expect(redirect.cookies.get("sb-session")).toMatchObject({
      value: "rotated-token",
      httpOnly: true,
      maxAge: 3600,
      sameSite: "lax",
    });
  });
});
