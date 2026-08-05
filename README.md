# plnrr

Stream prep productivity tools — a multi-user Next.js app with Google OAuth authentication and server-backed persistence.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Auth**: Auth.js (NextAuth v5) with Google OAuth, JWT sessions, allowlist access control
- **Database**: Postgres (Neon) via Prisma ORM with `@prisma/adapter-pg` driver
- **Styling**: Tailwind CSS v4
- **Validation**: Zod
- **Testing**: Vitest + fast-check (property-based testing)

## Getting Started

### Prerequisites

- Node.js 20+
- A Postgres database (Neon free tier works great)
- Google OAuth credentials

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in your `.env` with real values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Pooled Postgres connection string (used at runtime) |
| `DIRECT_URL` | Non-pooled Postgres connection string (used for migrations) |
| `AUTH_SECRET` | Random secret for signing JWTs — generate with `npx auth secret` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `ALLOWED_EMAILS` | Comma-separated emails allowed to sign in |

### 3. Set up Google OAuth

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Authorized JavaScript origin: `http://localhost:3000`
4. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### 4. Run database migrations

```bash
npx prisma migrate dev
```

### 5. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to sign in with Google.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm test` | Run test suite (vitest) |
| `npm run lint` | Run ESLint |

## Architecture

- `src/proxy.ts` — Next.js 16 proxy (replaces middleware), handles auth gate
- `src/lib/auth.config.ts` — Lightweight auth config (no DB deps, used by proxy)
- `src/lib/auth.ts` — Full auth config with PrismaAdapter (used by route handlers & server actions)
- `src/lib/actions.ts` — Server Actions for CRUD (all scoped to authenticated userId)
- `src/lib/prisma.ts` — Prisma client singleton with `@prisma/adapter-pg` driver and `nameLower` extension
- `src/lib/use-server-persisted-reducer.ts` — React hook replacing localStorage with server persistence
- `src/lib/importer.ts` — One-time localStorage → Postgres import for existing users

## Deployment (Vercel)

### Database Migrations

Prisma Migrate requires the non-pooled connection. In your deploy script:

```bash
DATABASE_URL=$DIRECT_URL npx prisma migrate deploy
```

### Environment Variables

Set all variables from `.env.example` in Vercel under Settings → Environment Variables.

## Access Control

Only emails listed in `ALLOWED_EMAILS` can sign in. If the variable is empty or missing, all sign-in attempts are rejected.
