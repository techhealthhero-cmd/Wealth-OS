/** Reject all targets except the approved staging project before live admin work. */
export function assertStagingSupabase(url) {
  let target;
  try {
    target = new URL(url);
  } catch {
    throw new Error("Live Supabase admin refused: invalid NEXT_PUBLIC_SUPABASE_URL; staging is required.");
  }
  const productionRef = "lvxuruzspchhcwebrbzy";
  if (target.hostname.toLowerCase().split(".").includes(productionRef)) {
    throw new Error("Live Supabase admin refused: production project is forbidden.");
  }
  if (
    target.protocol !== "https:" ||
    target.hostname !== "eovyvlesdgygjqrrvpas.supabase.co" ||
    target.port || target.username || target.password
  ) {
    throw new Error("Live Supabase admin refused: URL must target the approved staging project.");
  }
}
