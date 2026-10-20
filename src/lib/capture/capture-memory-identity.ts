/** Resolve at save completion, including handlers captured before auth hydration.
 * A replaced identity snapshot means auth changed while resolution was pending.
 */
export async function resolveMemoryIdentity(
  identity: { current: { userId: string | null } },
  renderedUserId: string | null,
  getSessionUserId: () => Promise<string | null>,
): Promise<string | null> {
  const snapshot = identity.current;
  if (renderedUserId && renderedUserId !== snapshot.userId) return null;
  if (snapshot.userId) return snapshot.userId;
  try {
    const userId = await getSessionUserId();
    if (identity.current !== snapshot) return identity.current.userId === userId ? userId : null;
    identity.current = { userId };
    return userId;
  } catch {
    return null;
  }
}
