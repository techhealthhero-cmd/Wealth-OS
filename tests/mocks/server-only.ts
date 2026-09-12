// Test-only stub for the `server-only` package. The real package
// unconditionally throws when imported outside Next.js's build pipeline
// (which strips it via a special server/client alias) — vitest runs plain
// Node, so without this alias every server-only module would be untestable.
// Aliased in vitest.config.mts; never used outside the test build.
export {};
