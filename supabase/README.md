# Supabase setup

## Environment

Set these Vite variables in the ignored `.env.local` file:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-key>
```

`VITE_SUPABASE_ANON_KEY` must contain the project's `sb_publishable_...` key (or legacy anon key). Never put a `service_role` or secret key in a Vite variable or browser bundle.

## Apply the schema

The migration in `migrations/20261007000000_private_workouts_and_auth.sql` is additive: it creates new tables, indexes, functions, triggers, grants, and RLS policies. It does not drop or truncate existing data. Apply it once using the Supabase SQL Editor, or use the Supabase CLI from the repository root:

```sh
supabase link --project-ref <project-ref>
supabase db push
```

The CLI may ask for the database password in your terminal; do not put it in the frontend or a committed file. Do not paste a service-role key into the frontend.

The app expects the migration before account creation or fitness-data access. It creates a private profile for new Auth users and backfills profiles for existing Auth users without changing their credentials. Preset writes are restricted to authenticated RPCs, which enforce non-empty presets and the per-user limit in addition to table constraints.

## Auth URLs

In Supabase Dashboard > Authentication > URL Configuration, set the local Site URL to `http://localhost:5173`. Add the local root and `/reset-password` URLs to the redirect allowlist. Add the deployed app origin and its `/reset-password` path before using password recovery from a production deployment. Configure email confirmation according to the desired signup policy.

## Existing local data

After a user signs in, the app checks the old BigDaan localStorage keys. It maps old exercise identifiers to `src/data/exercises.json`, uploads the workouts, presets, and active draft under the first account, reads the uploaded data back, and only then removes the legacy fitness-data keys. A marker binds the migration to that account; another account is never allowed to claim those same local records automatically. If an exercise cannot be mapped, or cloud verification fails, local data is retained and the app displays an error.

## RLS isolation test

`tests/rls_isolation.sql` creates two temporary Auth users and their records, switches between `authenticated` and `anon`, and raises an error if reads or mutations cross user boundaries. Run the script against a disposable/local Supabase database as a database administrator after applying the migration. It rolls back all fixtures. The repository environment used to implement this change has no Supabase CLI, Docker, or PostgreSQL client, so the SQL migration and isolation script have not been executed here.
