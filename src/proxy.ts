import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Protect everything except auth routes, API auth routes, and static files
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
};
