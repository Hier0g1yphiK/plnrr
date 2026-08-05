# plnrr Project Context

## Overview

plnrr is a multi-user stream prep productivity app built with Next.js 16, Auth.js, and Prisma/Postgres.

## Key Architecture Decisions

### Authentication
- Auth.js v5 (next-auth beta) with Google OAuth and JWT strategy
- Split config pattern: `auth.config.ts` (lightweight, no DB) used by the proxy, `auth.ts` (full, with PrismaAdapter) used by route handlers and server actions
- Allowlist-based access control via `ALLOWED_EMAILS` env var
- Route protection handled by `src/proxy.ts` (Next.js 16 proxy convention, not middleware)

### Next.js 16
- Uses the `proxy.ts` file convention instead of `middleware.ts` (renamed in Next.js 16)
- The proxy must export a named `proxy` function, not a default export
- Auth.js `auth()` wrapper is used as the proxy function

### Database
- Prisma 7.x with `@prisma/adapter-pg` driver adapter (required — PrismaClient no longer connects directly)
- Neon Postgres with pooled (`DATABASE_URL`) and non-pooled (`DIRECT_URL`) connections
- All queries scoped to `userId` — no query path omits this filter
- `nameLower` shadow column on ChecklistTemplate for case-insensitive uniqueness, maintained by Prisma Client Extension

### Persistence
- `useServerPersistedReducer` hook replaces localStorage-based `usePersistedReducer`
- Server Actions (`src/lib/actions.ts`) handle all CRUD with Zod validation
- 500ms debounce on writes, exponential backoff retry (max 3 attempts)
- One-time localStorage import path for existing users (`src/lib/importer.ts`)

### Testing
- Vitest + fast-check for property-based testing
- Tests mock `@/lib/auth` and `@/lib/prisma` — no real DB needed
- Run with `npm test`

## File Conventions

- `src/proxy.ts` — Route protection (NOT middleware.ts)
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js API route
- `src/lib/actions.ts` — All Server Actions
- `prisma/schema.prisma` — Database schema
- `prisma.config.ts` — Prisma config with directUrl for migrations

## Common Pitfalls

- Never use `new PrismaClient()` without passing the adapter
- The proxy file must export `proxy` as a named export (not default)
- `signIn("google", { redirectTo })` must pass redirectTo for post-auth navigation
- Prisma migrations must use `DIRECT_URL`, not the pooled connection
