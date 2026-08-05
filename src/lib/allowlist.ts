/** Parse comma-separated email allowlist, trimming whitespace, lowercasing. */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** Check if an email is in the allowlist (case-insensitive). */
export function isEmailAllowed(
  email: string | null | undefined,
  allowlist: string[]
): boolean {
  if (!email) return false;
  return allowlist.includes(email.toLowerCase());
}
