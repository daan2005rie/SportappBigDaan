# Supabase setup

## Environment

Set these Vite variables in the ignored `.env.local` file:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

`VITE_SUPABASE_PUBLISHABLE_KEY` must contain the project's `sb_publishable_...` key. Never put a `service_role` or secret key in a Vite variable or browser bundle.

## Apply the schema

The initial migration in `migrations/20261007000000_private_workouts_and_auth.sql` is additive: it creates tables, indexes, functions, triggers, grants, and RLS policies. It does not drop or truncate existing data. Apply pending migrations using the Supabase CLI from the repository root:

```sh
supabase link --project-ref <project-ref>
supabase migration list --linked
supabase db push --dry-run
supabase db push
```

Review the linked migration list and dry-run output before applying. The exercises feature adds `migrations/20261018000000_private_personal_exercises.sql`. It creates owner-only personal exercises and RLS policies, adds nullable metadata snapshot columns and owner references to workout/preset exercise rows, and replaces the workout, draft, and preset persistence functions with versions that validate personal exercise ownership. It does not delete existing rows or change existing workout/preset IDs. Apply and verify the additive migration before deploying the frontend code that queries the new table.

The personal exercise delete guard rejects every direct physical deletion, including unreferenced exercises; the application archives exercises instead. The owner-only DELETE policy/grant is intentionally retained so other users still affect zero rows; deleting an owned row raises a foreign-key error. The existing nested Auth account deletion cascade remains possible. The added nullable snapshot columns preserve names, descriptions, equipment and muscle groups for completed workouts. Resaving uses the existing exercise rows and never replaces their snapshots (including NULL values on legacy rows). A trigger also blocks direct changes to snapshot columns and exercise identity. Older workout rows continue to use the standard exercise catalog as a fallback.

The CLI may ask for the database password in your terminal; do not put it in the frontend or a committed file. Do not paste a service-role key into the frontend.

The app expects the migration before account creation or fitness-data access. It creates a private profile for new Auth users and backfills profiles for existing Auth users without changing their credentials. Preset writes are restricted to authenticated RPCs, which enforce non-empty presets and the per-user limit in addition to table constraints.

## Auth URLs

In Supabase Dashboard > Authentication > URL Configuration, set the local Site URL to `http://localhost:5173`. Add the local root and `/reset-password` URLs to the redirect allowlist. Add the deployed app origin and its `/reset-password` path before using password recovery from a production deployment. Configure email confirmation according to the desired signup policy.

## Existing local data

After a user signs in, the app checks the old BigDaan localStorage keys. It maps old exercise identifiers to `src/data/exercises.json`, uploads the workouts, presets, and active draft under the first account, reads the uploaded data back, and only then removes the legacy fitness-data keys. A marker binds the migration to that account; another account is never allowed to claim those same local records automatically. If an exercise cannot be mapped, or cloud verification fails, local data is retained and the app displays an error.

## RLS isolation test

`tests/rls_isolation.sql` creates two temporary Auth users and their records, switches between `authenticated` and `anon`, and raises an error if reads or mutations cross user boundaries. Run the script ONLY against a disposable, separate Supabase database as a database administrator after applying all migrations. Never run it against production, even though it rolls back. It rolls back all fixtures. The migration and isolation script have now passed on PostgreSQL 17.11 in a dedicated local Docker environment, and again on a locally restored backup. See `RESTORE.md` for restore prerequisites and limits.

## Exercises: local implementation and test gate

### Old frontend and set compatibility

Missing standard-exercise metadata is stored as SQL NULL, including JSON-null values, so old frontends can still save workouts without supplying snapshot fields. Missing secondary muscles differ from an explicit empty list. Existing workout-exercise snapshots, including NULL fields, are never rewritten by resaving: the conflict update changes only exercise order.

The frontend resolves individual NULL/absent fields from the standard catalog. It also recognizes the earlier RPC bug's narrow shape (standard ID, both muscle arrays empty, all other snapshot fields NULL) as missing metadata when displaying history. This is a read-only fallback, not a data repair. Named snapshots and explicit empty strings/secondary-muscle lists are preserved; personal history is never rebuilt from the current personal exercise library. Older rows without snapshots continue depending on the standard catalog for display.

Completed set validation uses the existing PostgreSQL column types and bounds rather than a text-format regex. It accepts historical zero repetitions (the original schema allowed `reps >= 0`), while the frontend still requires positive repetitions for newly completed workouts. NaN/non-finite, negative, missing and overflowing results are rejected. Legacy exercises with no sets can be resaved if they already have no stored sets; a new completed exercise must have a set, and an empty incoming list cannot erase existing results. Draft sets may remain empty or contain unfinished input strings.

`tests/rls_isolation.sql` now clears both JWT claim formats and the scalar role claim before checking that `auth.uid()` is NULL as `anon`. It tests all four storage/delete RPCs against anonymous execution, old-frontend payloads, preserved snapshots, valid numeric formats, historical zero repetitions/empty sets and incomplete drafts. These SQL assertions passed in the isolated local database and restored-backup copy; they remain prohibited on production.

- Local database verification is complete: the three baseline migrations and the Oefeningen migration executed successfully, including the isolation script and six real Auth/PostgREST service tests. This migration must not be applied blindly where a previous version was already applied. Production still requires explicit user approval and a current schema/history check.
- `assert_exercise_ids_owned` validates JSON shape, uniqueness, exact standard catalog IDs, and personal ownership. `is_standard_exercise_id` freezes all 220 current IDs without renumbering them. When expanding the catalog, extend the SQL allowlist in a subsequent migration; a Vitest test checks catalog/allowlist consistency.
- `assert_exercise_availability` rejects archived exercises unless the same user already has a reference in the target workout, the active draft with the same ID, or the selected existing preset. Existing presets can start new workouts using their archived items. Removing an archived item from a preset means it cannot subsequently be added back. No other preset or workout serves as permission to add it to a new preset.
- Drafts and direct workout-exercise writes also have validation triggers. Selectors exclude archived items; existing preset/draft resolution includes archives. A stale browser selection is rejected by the database and shown as an error.
- Personal muscle/equipment values are checked against catalog options in the database, including null entries, duplicates and primary/secondary overlap. ID/owner updates are blocked by both column privileges and a trigger. All new tables have RLS.
- The preset RPC retains SECURITY DEFINER because preset tables are read-only to browser roles. It authenticates with `auth.uid()`, explicitly scopes every read/write to that owner, validates all exercise references, retains the preset-limit trigger, uses an empty search path and has no PUBLIC/anon execute grant. The other storage RPCs remain SECURITY INVOKER.
- The local checks cover two-account and anonymous isolation, historical resaves/reordering, drafts, archived presets, and account deletion. An actual browser workflow also covered adding a personal exercise, creating/starting a preset, completing a workout and reading top sets. Local SQL verifies RPC execution privileges and SECURITY DEFINER/search_path settings. Hosted security advisors and current production configuration were not queried.

## Active-workout exercise order (local change, not deployed)

The workout draft JSON already preserves exercise array order. The arrow buttons
move existing objects and IDs, including their sets. Reordering uses the existing
serial autosave queue immediately; completion waits for in-flight saves and locks
further edits. `persist_workout` already removes the matching draft atomically.
History/details contain no reordering controls. Both TypeScript storage paths
reject a changed exercise sequence when saving an existing completed workout.

For enforcement through the database API as well, apply the new
`20261111141156_freeze_completed_workout_order.sql` **only after review and explicit
production approval**. It uses the existing draft and exercise-order structure;
no existing workout/set/preset rows or timestamps are rewritten. A private,
non-API table records the final exercise sequence, including existing histories.
A deferred constraint trigger checks final transaction state, so same-order RPC
resaves (which temporarily shift order numbers) continue to work. Changing the
sequence, adding/removing exercises, and delete/reinsert workarounds are rejected.
Whole-workout deletion still cascades normally. Completed IDs cannot be reopened
as drafts. The private trigger function has an empty search path and no client
EXECUTE/schema/table grants. Existing RPC signatures, RLS policies and presets
are unchanged.

`tests/workout_order.sql` is for a separate **local** database with synthetic data
only. It checks draft order/set preservation, completion, same-order resaves,
historical-order rejection through RPC and direct writes, snapshot preservation,
private-schema access, and workout deletion. It flushes deferred constraints to
simulate RPC transaction boundaries and rolls back its fixtures. The existing
`rls_isolation.sql` suite is still required. Neither script may run on production.
The new migration and both SQL suites were tested in an isolated local database;
fingerprints of all pre-existing test-fixture fields/timestamps stayed unchanged.
