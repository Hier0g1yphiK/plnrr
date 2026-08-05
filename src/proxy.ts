import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Next.js 16 proxy (replaces middleware.ts).
 * Checks for a valid JWT session and redirects unauthenticated users to sign-in.
 */
export const proxy = auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
};
