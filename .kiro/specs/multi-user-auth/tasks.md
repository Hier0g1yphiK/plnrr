# Implementation Plan: Multi-User Authentication

## Overview

Convert plnrr from a single-user, localStorage-only application into a multi-user system with Auth.js (NextAuth v5), Google OAuth, allowlist-based access control, Prisma/Postgres data layer, server-backed persistence via Server Actions, and a one-time localStorage import path. The existing UI, reducers, and Zod schemas are preserved; the persistence layer is swapped from localStorage to server writes.

## Tasks

- [x] 1. Set up Prisma, Auth.js dependencies, and project scaffolding
  - [x] 1.1 Install dependencies and initialize Prisma
    - Install `next-auth@beta`, `@auth/prisma-adapter`, `prisma`, `@prisma/client`
    - Run `npx prisma init` to create `prisma/schema.prisma` and `.env`
    - Add `prisma generate` to the build script in `package.json`
    - _Requirements: 3.1, 10.2_

  - [x] 1.2 Define the Prisma schema with all data models
    - Add User, Account, Session, VerificationToken models per Auth.js Prisma adapter requirements
    - Add ChecklistTemplate (with `nameLower` shadow column), ChecklistCategory, ChecklistItem, ActiveChecklist, TaskCard models
    - Add `importCompleted` Boolean field on User model
    - Configure cascade deletes on all user-owned relations
    - Set `@@unique([userId, nameLower])` constraint on ChecklistTemplate
    - Set `@unique` on ActiveChecklist.userId to enforce one active checklist per user
    - Configure datasource with `DATABASE_URL` and `directUrl` for Neon compatibility
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 10.2_

  - [x] 1.3 Create Prisma client singleton with nameLower extension
    - Create `src/lib/prisma.ts` with global singleton pattern for serverless
    - Add Prisma Client Extension with query hooks on `checklistTemplate.create`, `update`, and `createMany` to auto-derive `nameLower` from `name`
    - _Requirements: 3.2, 10.3_

  - [x] 1.4 Generate and commit the initial Prisma migration
    - Run `npx prisma migrate dev --name init` to generate the initial migration SQL file under `prisma/migrations/`
    - Commit the generated migration SQL alongside the schema so the migration is version-controlled
    - Verify the migration applies cleanly to a fresh database
    - _Requirements: 3.1, 10.2_

  - [x] 1.5 Write unit test for nameLower Prisma extension
    - Verify that on `create`, the extension sets `nameLower` to the lowercased value of `name`
    - Verify that on `update`/rename, the extension updates `nameLower` to reflect the new lowercased name
    - Test with mixed-case inputs (e.g., "My Template" → "my template")
    - _Requirements: 3.2_

- [x] 2. Implement allowlist module and auth configuration
  - [x] 2.1 Create the allowlist module
    - Create `src/lib/allowlist.ts` with `parseAllowlist(raw)` and `isEmailAllowed(email, allowlist)` functions
    - `parseAllowlist`: split on comma, trim whitespace, lowercase, filter empty segments
    - `isEmailAllowed`: return false if email is null/undefined, else compare lowercased email against allowlist entries
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Write property tests for allowlist module
    - **Property 1: Allowlist email matching is case-insensitive and correct**
    - **Property 2: Allowlist parsing produces trimmed, lowercased entries**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 2.3 Create Auth.js split configuration (Edge + Node)
    - Create `src/lib/auth.config.ts` — lightweight Edge config with Google provider, JWT strategy (30-day maxAge), custom pages, `authorized` callback (checks `!!auth?.user`), and `signIn` callback (invokes allowlist check, rejects if `ALLOWED_EMAILS` is empty/missing)
    - Create `src/lib/auth.ts` — full server config extending `auth.config.ts` with PrismaAdapter, session callback that attaches `token.sub` as `session.user.id`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 2.4 Create the Auth.js API route handler
    - Create `src/app/api/auth/[...nextauth]/route.ts` that exports GET and POST handlers from `src/lib/auth.ts`
    - _Requirements: 1.2, 8.1_

- [x] 3. Implement middleware and route protection
  - [x] 3.1 Create Next.js middleware for route protection
    - Create `middleware.ts` at project root using `NextAuth(authConfig)` from the Edge config
    - Configure matcher to protect all routes except `/auth/*`, `/api/auth/*`, `_next/static`, `_next/image`, `favicon.ico`, and SVG files
    - Unauthenticated page requests redirect to `/auth/signin` with `callbackUrl` preserving the original path
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 1.1, 1.7_

  - [x] 3.2 Write integration test for callbackUrl preservation (Property 8)
    - **Property 8: Route redirect preserves callbackUrl**
    - Test that for any protected route path requested by an unauthenticated user, the redirect to `/auth/signin` includes a `callbackUrl` query parameter containing the original requested path
    - Test multiple route paths (e.g., `/`, `/dashboard`, `/settings/profile`) to confirm consistent behavior
    - **Validates: Requirements 8.2**

- [x] 4. Checkpoint - Verify auth layer compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create sign-in page and session UI
  - [x] 5.1 Create the sign-in page
    - Create `src/app/auth/signin/page.tsx` as a Server Component
    - Render a Google sign-in button that calls `signIn("google")`
    - Read error messages from URL search params (`error=OAuthError`, `error=AccessDenied`) and display appropriate user-facing messages
    - Display generic error when `ALLOWED_EMAILS` is missing (from `error=Configuration`)
    - _Requirements: 1.2, 1.6, 2.2, 2.4_

  - [x] 5.2 Create user display helper
    - Create `src/lib/user-display.ts` with `formatUserDisplay(name, email)` function
    - Prefer name over email, fallback to "User", truncate at 30 chars with ellipsis
    - _Requirements: 9.1_

  - [x] 5.3 Write property test for user display formatting
    - **Property 9: User display name formatting and truncation**
    - **Validates: Requirements 9.1**

  - [x] 5.4 Add session UI to Navigation component
    - Modify `src/components/Navigation.tsx` to display user name/email (via `formatUserDisplay`) and a sign-out button when a session exists
    - Sign-out calls `signOut()` from `next-auth/react`, discards pending writes
    - Handle sign-out failure by displaying toast error and keeping session intact
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 6. Implement Server Actions for data persistence
  - [x] 6.1 Create Server Actions module
    - Create `src/lib/actions.ts` with `"use server"` directive
    - Implement `loadUserData()`: authenticate via `auth()`, fetch ChecklistTemplates (with categories + items), ActiveChecklist, and TaskCards for the user, reconstruct client-side state shape, return both states
    - Implement `saveChecklistState(payload)`: authenticate, validate with `ChecklistStateSchema`, normalize into relational writes (upsert templates/categories/items, sync active checklist), **diff against existing rows scoped to the user's templates and delete categories/items no longer present in the incoming payload** (prevents orphaned rows from reappearing on next load), scope to userId
    - Implement `saveOrganizerState(payload)`: authenticate, validate with `OrganizerStateSchema`, sync TaskCards for user — **diff against existing TaskCards for the user and delete cards no longer present in the incoming payload**, scope to userId
    - Implement `importUserData(checklistData, organizerData)`: authenticate, validate both payloads, normalize and write (including **deletion of any pre-existing rows not present in the import payload**, scoped to the user), set `importCompleted` flag
    - Implement `checkImportEligibility()`: check if user has zero templates and zero tasks, and `importCompleted` is false
    - Return validation errors with field paths on Zod failure
    - All queries scoped to `session.user.id`
    - **Delete strategy**: For each save path, compare incoming entity IDs against existing DB rows (scoped to the template/user). Any DB row whose ID is absent from the incoming payload must be deleted in the same transaction as the upserts. This applies to ChecklistCategory, ChecklistItem, and TaskCard.
    - _Requirements: 3.7, 4.1, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 7.1, 7.4_

  - [x] 6.2 Write property tests for Server Actions validation
    - **Property 4: Zod validation rejects invalid payloads with field-level errors**
    - **Validates: Requirements 4.6, 5.3**

  - [x] 6.3 Write property test for data isolation
    - **Property 3: Data isolation by userId**
    - **Validates: Requirements 3.7, 4.7**

  - [x] 6.4 Write round-trip test for normalize ⇄ reconstruct
    - Verify that for any valid `ChecklistState`, calling `saveChecklistState` (normalize to relational rows) followed by `loadUserData()` (reconstruct from relational rows) returns an equivalent state
    - Verify that for any valid `OrganizerState`, calling `saveOrganizerState` followed by `loadUserData()` returns an equivalent state
    - Verify the deletion case: if items/categories/cards are removed from the payload before saving, they do not reappear on subsequent load
    - Use a test database or mocked Prisma to validate the full round-trip
    - _Requirements: 4.1, 4.6, 3.7_

- [x] 7. Implement server-backed persistence hook
  - [x] 7.1 Create the useServerPersistedReducer hook
    - Create `src/lib/use-server-persisted-reducer.ts`
    - On mount: call `loadUserData()` Server Action, display loading state, apply 10-second timeout
    - On state change: debounce 500ms, call save Server Action
    - On failure: retry with exponential backoff (1s base, max 3 attempts)
    - On all retries exhausted: show persistent error notification, retain state in memory
    - Expose `{ state, dispatch, error, loading }` interface
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_

  - [x] 7.2 Update context providers to use server persistence
    - Modify `src/lib/checklist-context.tsx` to use `useServerPersistedReducer` instead of `usePersistedReducer` when authenticated
    - Modify `src/lib/organizer-context.tsx` similarly
    - Add loading skeleton display while initial data is being fetched
    - _Requirements: 4.1, 4.3_

- [x] 8. Checkpoint - Verify persistence layer compiles and auth flow works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement localStorage import module
  - [x] 9.1 Create the importer module
    - Create `src/lib/importer.ts` (client-side module)
    - Read `plnrr:checklist` and `plnrr:organizer` from localStorage
    - Apply Migration Runner (`runMigrations`) to bring JSON from stored version to current version
    - Validate migrated data against Zod schemas (`ChecklistStateSchema`, `OrganizerStateSchema`)
    - Handle partial success (one key valid, other fails): import valid data, report error for failed dataset
    - Call `importUserData` Server Action to write to Postgres
    - Handle empty/default state detection (zero templates and zero tasks)
    - _Requirements: 7.2, 7.3, 7.5, 7.6_

  - [x] 9.2 Write property tests for import migration chain
    - **Property 5: Migration chain version correctness (import-time only)**
    - **Property 7: Import data migration + validation round-trip**
    - **Validates: Requirements 6.1, 6.5, 7.3**

  - [x] 9.3 Write property test for migration failure atomicity
    - **Property 6: Migration failure atomicity (import-time only)**
    - **Validates: Requirements 6.4**

  - [x] 9.4 Create import prompt UI component
    - Create `src/components/ImportPrompt.tsx`
    - Display prompt when user is import-eligible (zero server data, importCompleted is false)
    - Offer confirm/skip actions
    - Handle success confirmation, error display with retry (up to 3 attempts), then skip-only
    - Handle partial failure: show which dataset failed, allow retry or skip for that dataset
    - Persist import-completed flag on skip or success
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 10. Wire application together and integrate all components
  - [x] 10.1 Update app layout and providers for auth session
    - Wrap the app with `SessionProvider` from `next-auth/react` in `src/app/providers.tsx`
    - Conditionally render `ImportPrompt` after authentication when eligible
    - Ensure the existing `HydrationProvider` and context providers still work within the authenticated shell
    - _Requirements: 1.4, 7.1, 9.1_

  - [x] 10.2 Add environment variable validation and build verification
    - Create `.env.example` documenting all required variables: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`
    - Ensure no secrets are hard-coded in source files
    - Verify `next build` succeeds with required env vars defined
    - Note in deployment documentation/scripts that `prisma migrate deploy` must run against the production database using `DIRECT_URL` (the non-pooled connection), not the pooled `DATABASE_URL` — e.g., `DATABASE_URL=$DIRECT_URL npx prisma migrate deploy`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 11. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Migration Runner is only invoked during the one-time localStorage import — not during normal reads/writes
- The split auth config pattern (Edge vs Node) is critical for Vercel serverless compatibility
- All Prisma queries must include `userId` scoping — no query path should omit this filter

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 3, "tasks": ["1.5", "2.2", "2.3", "5.2"] },
    { "id": 4, "tasks": ["2.4", "3.1", "5.1", "5.3"] },
    { "id": 5, "tasks": ["3.2", "5.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 7, "tasks": ["7.2"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 10, "tasks": ["10.1", "10.2"] }
  ]
}
```
