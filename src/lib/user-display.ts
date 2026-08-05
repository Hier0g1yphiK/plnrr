/** Format user display name for navigation. Prefers name, falls back to email, truncates at 30 chars. */
export function formatUserDisplay(name?: string | null, email?: string | null): string {
  const display = name || email || "User";
  return display.length > 30 ? display.slice(0, 30) + "…" : display;
}
