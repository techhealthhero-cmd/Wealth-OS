/** Reject all targets except the approved staging project before live admin work. */
export function assertStagingSupabase(url) {
  let target;
  try {
    target = new URL(url);
  } catch {
    throw new Error("Live Supabase admin refused: invalid NEXT_PUBLIC_SUPABASE_URL; staging is required.");
  }
  const approvedStagingHosts = new Set([
    "cqmgogmnfsamywocdinr.supabase.co",
    "eovyvlesdgygjqrrvpas.supabase.co",
  ]);
  const productionRef = "lvxuruzspchhcwebrbzy";
  if (target.hostname.toLowerCase().split(".").includes(productionRef)) {
    throw new Error("Live Supabase admin refused: production project is forbidden.");
  }
  if (
    target.protocol !== "https:" ||
    !approvedStagingHosts.has(target.hostname) ||
    target.port || target.username || target.password
  ) {
    throw new Error("Live Supabase admin refused: URL must target the approved staging project.");
  }
}
