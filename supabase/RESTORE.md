# Local backup rehearsal and recovery notes

The existing application remains on its original Supabase project. These notes
describe an isolated local rehearsal, not permission to change production.

## Verified locally on 2026-11-04

Supabase CLI 3.0.0 and PostgreSQL 17.11 were used in a dedicated Docker project
with API port 55321 and database port 55322. No production connection was used.

The original `roles.sql`, `schema.sql`, `data.sql` and `migration_history.sql`
files were read without modifying them. Schema, account/fitness data and migration
history were restored into a separate local database. Existing platform roles
were already provided by the local Supabase installation; this does not prove a
custom-role/password restore on a hosted project.

Additional prerequisites were necessary:

- A Supabase platform database, including the Auth schema, extension support,
  the Vault schema and the `supabase_realtime` publication. A plain empty
  PostgreSQL database does not contain these automatically.
- The migration-history export contains data, not the definition of
  `supabase_migrations.schema_migrations`. Its standard table structure must exist
  before importing the history.
- The public schema export omits the custom trigger on `auth.users`. After its
  `public.create_profile_for_new_user()` function exists, reconstruct
  `auth_user_profile_created` from the initial repository migration. Without it,
  new accounts would not automatically receive profiles.
- During the local data import, user triggers were disabled for the import session
  only, as in the Supabase restore procedure, to avoid creating duplicate profiles.
  Normal trigger behavior was restored automatically when that session ended.

The Oefeningen migration was applied transactionally to the restored copy.
Counts and deterministic fingerprints of every original field in accounts,
identities, profiles, workouts, exercise rows, sets, presets and drafts matched
before/after. Only new columns were excluded from the comparison.

Verified: 14 accounts/identities/profiles, 13 workouts, 55 workout-exercise rows,
123 sets, 5 presets and 27 preset-exercise rows. The RLS isolation script passed
on the restored copy and left those records unchanged.

This is a verified local restore with the prerequisites above, not a one-click
restore into an already populated hosted database. Storage object files, external
Auth settings, API keys and Vault encryption portability were not validated.
Original account passwords were not used to sign in during this rehearsal.

## Before any production update

1. Obtain explicit user approval for the exact project and migration.
2. Reconfirm the live schema/history and save a fresh backup if data changed since
   the tested backup. Preserve the exact current RPC/policy definitions.
3. Prepare a maintenance window and a transaction that aborts fully on error,
   with suitable lock/statement timeouts. Do not rerun the first three migrations
   or any already applied version of the Oefeningen migration.
4. Keep the rollback plan specific: before commit, rollback the transaction;
   after commit, prefer a reviewed corrective migration restoring old RPC/policy
   behavior while retaining any newly created exercise data. Do not blindly drop
   tables/columns or import a full dump over populated production tables.
5. Full data recovery requires a separate reviewed restore plan, an import target
   with the required Supabase platform structure, and handling records created
   after the backup. It can require downtime and lose later changes. No production
   reset or restore has been attempted or authorized by the local test work.

## Repeating the API checks

`tests/api_integration.test.ts` is opt-in. It only accepts
`http://127.0.0.1:55321` and synthetic test credentials supplied through the
`SPORTAPP_LOCAL_*` process variables. No production keys are used. Ordinary
`npm test` skips these six tests; they were also run separately against the real
local Auth/PostgREST services. Never put credentials or backup contents in Git.
