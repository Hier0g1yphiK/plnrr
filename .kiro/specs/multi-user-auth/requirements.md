# Requirements Document

## Introduction

Convert plnrr from a single-user, client-only application into a multi-user system with authentication and server-backed persistence. The application currently stores all state in localStorage via a custom `usePersistedReducer` hook. This feature introduces Auth.js (NextAuth v5) with Google OAuth, an allowlist-based access control model, a Prisma/Postgres data layer, and a migration path for existing browser-stored data. The existing UI/UX remains unchanged beyond what is necessary for login/logout and per-user data scoping.

## Glossary

- **Auth_Service**: The Auth.js (NextAuth v5) integration responsible for session management, OAuth handshake, and callback handling
- **Allowlist**: A configuration-driven set of approved email addresses that are permitted to sign in
- **Session**: An authenticated user context provided by Auth.js, containing user identity and expiration
- **Data_Layer**: The Prisma ORM backed by a Postgres database, responsible for reading and writing application data
- **Persistence_Service**: The server-side module (API routes or Server Actions) that replaces the localStorage-based `usePersistedReducer`, handling debounced writes and optimistic reads for authenticated users
- **Importer**: A one-time data migration utility that transfers localStorage state into the Postgres database under the authenticated user's account
- **Migration_Runner**: The existing versioned-migration system (`migrations.ts`) adapted to run server-side against persisted user data
- **Checklist_State**: The user's templates, categories, items, and active checklist data (currently managed by `checklist-reducer.ts`)
- **Organizer_State**: The user's weekly task cards (currently managed by `organizer-reducer.ts`)
- **User_Model**: The Auth.js User record in the database, linked to OAuth accounts and application data

## Requirements

### Requirement 1: Google OAuth Authentication

**User Story:** As an approved user, I want to sign in with my Google account, so that I can access my personal plnrr data from any device.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to any protected application route, THE Auth_Service SHALL redirect the user to the sign-in page within 1 second
2. WHEN the user initiates sign-in, THE Auth_Service SHALL present Google OAuth as the sole authentication provider
3. WHEN Google OAuth returns a successful authentication response, THE Auth_Service SHALL create or update a Session for the user with a maximum duration of 30 days
4. WHILE a valid Session exists (not expired and not invalidated), THE Auth_Service SHALL allow access to protected application routes and data without requiring re-authentication
5. WHEN the user initiates sign-out, THE Auth_Service SHALL invalidate the Session and redirect the user to the sign-in page
6. IF Google OAuth returns an error or the user cancels the OAuth flow, THEN THE Auth_Service SHALL redirect the user to the sign-in page and display an error message indicating that authentication was not completed
7. IF a Session expires while the user is interacting with the application, THEN THE Auth_Service SHALL redirect the user to the sign-in page on the next request requiring authentication

### Requirement 2: Allowlist-Based Access Control

**User Story:** As the application owner, I want to restrict sign-in to a predefined list of email addresses, so that only approved users can access the application.

#### Acceptance Criteria

1. WHEN Google OAuth returns a successful authentication for an email address present in the Allowlist (compared case-insensitively), THE Auth_Service SHALL permit the sign-in and establish a Session
2. WHEN Google OAuth returns a successful authentication for an email address not present in the Allowlist (compared case-insensitively), THE Auth_Service SHALL reject the sign-in and display an access-denied message indicating the account is not authorized
3. THE Auth_Service SHALL read the Allowlist from an environment variable (`ALLOWED_EMAILS`) containing a comma-separated list of approved email addresses, trimming whitespace from each entry
4. IF the `ALLOWED_EMAILS` environment variable is missing or empty, THEN THE Auth_Service SHALL reject all sign-in attempts, display a generic error to the user, and log a configuration error server-side

### Requirement 3: Prisma Schema and Database Models

**User Story:** As a developer, I want a well-structured database schema, so that all application data is properly scoped to individual users and portable across Postgres providers.

#### Acceptance Criteria

1. THE Data_Layer SHALL define User, Account, Session, and VerificationToken models with the fields and relations required by the Auth.js Prisma adapter
2. THE Data_Layer SHALL define a ChecklistTemplate model with fields for id, name (max 100 characters), createdAt, and a userId foreign key referencing the User_Model, with a unique constraint on (userId, name) enforcing case-insensitive uniqueness per user
3. THE Data_Layer SHALL define a ChecklistCategory model with fields for id, name (max 50 characters), and order, referencing its parent ChecklistTemplate with cascade deletion when the parent template is deleted
4. THE Data_Layer SHALL define a ChecklistItem model with fields for id, text (max 200 characters), minutesBefore (nullable integer), referencing its parent ChecklistTemplate and ChecklistCategory with cascade deletion when the parent template is deleted
5. THE Data_Layer SHALL define an ActiveChecklist model with a userId foreign key, a reference to its source ChecklistTemplate, and a streamTime field (nullable string), enforcing a maximum of one ActiveChecklist per user
6. THE Data_Layer SHALL define a TaskCard model with fields for id, title (max 100 characters), weekday, typeTag (nullable), completed, recurring, createdAt, and a userId foreign key referencing the User_Model
7. THE Data_Layer SHALL enforce that all queries for application data return only records belonging to the authenticated user's userId, such that no query path can return or modify another user's data
8. WHEN a User_Model record is deleted, THE Data_Layer SHALL cascade-delete all associated ChecklistTemplates, ActiveChecklists, and TaskCards belonging to that user

### Requirement 4: Server-Backed Persistence

**User Story:** As an authenticated user, I want my data saved to a database automatically, so that it persists across devices and browser sessions without manual action.

#### Acceptance Criteria

1. WHEN an authenticated user loads the application, THE Persistence_Service SHALL fetch the user's Checklist_State and Organizer_State from the Data_Layer and display a loading indicator until both datasets have been retrieved or a 10-second timeout has elapsed
2. WHEN a state mutation occurs in the client, THE Persistence_Service SHALL debounce the change for 500ms and then initiate a write of the updated state to the Data_Layer
3. WHILE a debounced write is pending, THE Persistence_Service SHALL immediately reflect the mutated state in the client UI without waiting for server write confirmation
4. IF a write to the Data_Layer fails, THEN THE Persistence_Service SHALL retain the pending state in memory, display a toast notification indicating the save failure, and retry the write using exponential backoff with a base delay of 1 second up to a maximum of 3 retry attempts
5. IF all 3 retry attempts for a failed write are exhausted, THEN THE Persistence_Service SHALL display a persistent error notification informing the user that changes could not be saved and retain the unsaved state in memory for the duration of the session
6. WHEN the Persistence_Service writes data, THE Persistence_Service SHALL validate the payload against the existing Zod schemas (ChecklistStateSchema, OrganizerStateSchema) before persisting, and reject the write without sending to the Data_Layer if validation fails
7. THE Persistence_Service SHALL scope all read and write operations to the authenticated user's userId
8. IF the initial data fetch exceeds 10 seconds or fails, THEN THE Persistence_Service SHALL display an error notification and allow the user to retry the load

### Requirement 5: Zod Schema Reuse

**User Story:** As a developer, I want to reuse the existing Zod validation schemas, so that validation logic remains consistent between client and server without duplication.

#### Acceptance Criteria

1. THE Persistence_Service SHALL import and use `ChecklistStateSchema` and `OrganizerStateSchema` from `src/lib/schemas.ts` for validating all incoming write payloads before passing them to the Data_Layer
2. THE Persistence_Service SHALL invoke Zod schema validation as the sole validation step before any database write performed by the Data_Layer, with no additional or duplicate validation schemas defined outside `src/lib/schemas.ts`
3. WHEN Zod schema validation fails on a write attempt, THE Persistence_Service SHALL reject the write without persisting any data and return a validation error to the client that includes the list of fields that failed validation and a description of each failure reason
4. THE Persistence_Service SHALL not define or maintain separate validation logic for Checklist_State or Organizer_State outside of the schemas exported from `src/lib/schemas.ts`

### Requirement 6: Server-Side Versioned Migrations

**User Story:** As a developer, I want to preserve the versioned-migration pattern on the server, so that user data schemas can evolve without data loss.

#### Acceptance Criteria

1. WHEN the Persistence_Service reads user data with a schema version lower than the current version, THE Migration_Runner SHALL apply each registered migration sequentially in ascending version order (e.g., v1→v2, v2→v3) until the data reaches the current version
2. THE Migration_Runner SHALL reuse the `MigrationRegistry`, `MigrationEntry`, and `MigrationFn` type interfaces from `src/lib/migrations.ts` for server-side execution
3. WHEN all migrations in the chain complete successfully, THE Migration_Runner SHALL persist the migrated data together with the updated version number in a single write operation before returning the data to the caller
4. IF a migration step throws an exception, THEN THE Migration_Runner SHALL discard all intermediate migration results, leave the persisted data at the version it held before the migration chain started, and return an error response to the caller indicating which version transition failed (e.g., "migration from version 2 to 3 failed")
5. IF the Persistence_Service reads user data whose schema version equals or exceeds the current version, THEN THE Migration_Runner SHALL return the data unchanged without applying any migrations

### Requirement 7: One-Time localStorage Import

**User Story:** As an existing user, I want to import my browser-stored data into the database after first login, so that I do not lose my existing templates and tasks.

#### Acceptance Criteria

1. WHEN an authenticated user loads the application and the Data_Layer contains zero ChecklistTemplates and zero TaskCards for that user, THE Importer SHALL display a prompt offering to import data from localStorage
2. WHEN the user confirms the import, THE Importer SHALL read `plnrr:checklist` and `plnrr:organizer` from localStorage
3. WHEN localStorage data is read, THE Importer SHALL validate each key's data independently against the corresponding Zod schema (`ChecklistStateSchema`, `OrganizerStateSchema`) and apply sequential migrations via the Migration_Runner before writing to the Data_Layer
4. WHEN the import completes successfully, THE Importer SHALL display a success confirmation and persist an import-completed flag in the Data_Layer so the import prompt is not shown again for that user
5. IF localStorage contains neither `plnrr:checklist` nor `plnrr:organizer` keys, or both keys contain only default empty state (zero templates and zero tasks), THEN THE Importer SHALL inform the user that no importable data was found and disable the import prompt for that user
6. IF localStorage data for one key fails validation after migration while the other key succeeds, THEN THE Importer SHALL import the valid data, display an error identifying which dataset failed validation, and allow the user to retry the failed dataset or skip it
7. IF the user skips the import or skips a failed dataset, THEN THE Importer SHALL persist the import-completed flag in the Data_Layer, permanently disabling the import prompt for that user
8. IF a write to the Data_Layer fails during import, THEN THE Importer SHALL display an error indicating the write failure and allow the user to retry the import up to 3 attempts before offering only the skip option

### Requirement 8: Route Protection

**User Story:** As the application owner, I want all application content protected behind authentication, so that no data or functionality is accessible to unauthenticated visitors.

#### Acceptance Criteria

1. THE Auth_Service SHALL protect all routes under the application root except the sign-in page, Auth.js callback routes (`/api/auth/*`), and static assets served from the public directory
2. WHEN an unauthenticated request is made to a protected page route, THE Auth_Service SHALL respond with a redirect to the sign-in page, preserving the originally requested URL so the user is returned there after successful authentication
3. WHEN an unauthenticated request is made to a protected API route or Server Action, THE Auth_Service SHALL respond with HTTP 401 Unauthorized and an empty JSON body
4. IF a user's Session expires while they are using the application, THEN THE Auth_Service SHALL treat subsequent requests as unauthenticated and apply the redirect or 401 behavior defined in criteria 2 and 3

### Requirement 9: Session UI Integration

**User Story:** As an authenticated user, I want to see my identity and have access to a sign-out action, so that I can confirm I am logged in and leave when needed.

#### Acceptance Criteria

1. WHILE a valid Session exists, THE Application SHALL display the authenticated user's name in the navigation area, falling back to the user's email address if the name is unavailable, truncated to a maximum of 30 visible characters with an ellipsis
2. WHILE a valid Session exists, THE Application SHALL display a sign-out button in the navigation area
3. WHEN the user activates the sign-out button, THE Auth_Service SHALL end the Session, discard any pending client-side writes, and redirect the user to the sign-in page within 2 seconds
4. IF the sign-out request fails due to a network or server error, THEN THE Application SHALL display an error message indicating the sign-out was unsuccessful and keep the user on the current page with their Session intact

### Requirement 10: Vercel Deployment Compatibility

**User Story:** As a developer, I want the application to remain deployable to Vercel, so that the existing deployment workflow is preserved.

#### Acceptance Criteria

1. THE Application SHALL use environment variables for the database connection string, Google OAuth client ID, Google OAuth client secret, Auth.js secret, and Allowlist email addresses, with no secrets hard-coded in source files
2. THE Data_Layer SHALL configure Prisma using a single `DATABASE_URL` environment variable and support connection pooling compatible with serverless execution
3. THE Application SHALL not depend on persistent in-process state between requests, WebSocket servers, cron daemons, or background worker processes
4. WHEN the `next build` command is executed with all required environment variables defined, THE Application SHALL produce a successful build with zero errors
