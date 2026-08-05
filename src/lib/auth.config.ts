import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { parseAllowlist, isEmailAllowed } from "@/lib/allowlist";

/**
 * Lightweight Edge-compatible auth config.
 * Used by middleware (Edge runtime) — no Prisma, no DB calls.
 */
export const authConfig: NextAuthConfig = {
  providers: [Google],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  pages: { signIn: "/auth/signin", error: "/auth/signin" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    signIn({ user }) {
      const allowlist = parseAllowlist(process.env.ALLOWED_EMAILS);
      if (allowlist.length === 0) return false;
      return isEmailAllowed(user.email, allowlist);
    },
  },
};
