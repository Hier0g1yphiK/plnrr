This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. See the example file for descriptions of each variable.

Required variables:
- `DATABASE_URL` — Pooled Postgres connection string (Neon)
- `DIRECT_URL` — Non-pooled Postgres connection string (Neon)
- `AUTH_SECRET` — Auth.js signing secret
- `AUTH_GOOGLE_ID` — Google OAuth client ID
- `AUTH_GOOGLE_SECRET` — Google OAuth client secret
- `ALLOWED_EMAILS` — Comma-separated list of approved email addresses

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

### Database Migrations

Prisma Migrate must run against the non-pooled connection (`DIRECT_URL`), not the pooled `DATABASE_URL`. Neon's connection pooler does not support the advisory locks that Prisma Migrate requires.

In your deploy script or CI pipeline:

```bash
DATABASE_URL=$DIRECT_URL npx prisma migrate deploy
```

### Environment Setup

Set all variables from `.env.example` in your Vercel project under Settings > Environment Variables. They are injected at deploy time.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
