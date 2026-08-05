import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

/**
 * Full server config extending the shared config with PrismaAdapter.
 * Used by Server Actions, route handlers, and the Auth.js API route.
 * Runs on Node runtime only.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    session({ session, token }) {
      if (token?.sub) session.user.id = token.sub;
      return session;
    },
  },
});
