import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath — open-redirect prevention (Day 8 security audit)", () => {
  it("accepts a normal relative path", () => {
    expect(safeRedirectPath("/reset-password", "/dashboard")).toBe("/reset-password");
  });

  it("accepts a relative path with a query string", () => {
    expect(safeRedirectPath("/money/transactions?type=income", "/dashboard")).toBe("/money/transactions?type=income");
  });

  it("falls back for null/undefined/empty input", () => {
    expect(safeRedirectPath(null, "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath(undefined, "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("", "/dashboard")).toBe("/dashboard");
  });

  it("rejects an absolute URL to another origin", () => {
    expect(safeRedirectPath("https://evil.example.com/phish", "/dashboard")).toBe("/dashboard");
  });

  it("rejects a scheme without a host (javascript:, data:)", () => {
    expect(safeRedirectPath("javascript:alert(1)", "/dashboard")).toBe("/dashboard");
  });

  it("rejects a protocol-relative URL (leading //)", () => {
    expect(safeRedirectPath("//evil.example.com", "/dashboard")).toBe("/dashboard");
  });

  it("rejects the backslash-normalization trick some browsers apply (leading /\\\\)", () => {
    expect(safeRedirectPath("/\\evil.example.com", "/dashboard")).toBe("/dashboard");
  });

  it("rejects a path that doesn't start with a slash at all", () => {
    expect(safeRedirectPath("evil.example.com", "/dashboard")).toBe("/dashboard");
  });
});
