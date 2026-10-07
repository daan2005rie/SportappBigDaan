create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.preset_exercises (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  exercise_order integer not null check (exercise_order > 0),
  default_sets integer not null check (default_sets between 1 and 10),
  unique (preset_id, exercise_id),
  unique (preset_id, exercise_order),
  foreign key (preset_id, user_id)
    references public.workout_presets(id, user_id) on delete cascade
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  preset_id uuid references public.workout_presets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (completed_at >= started_at)
);

create table if not exists public.workout_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  started_at timestamptz not null,
  preset_id uuid references public.workout_presets(id) on delete set null,
  draft_data jsonb not null check (jsonb_typeof(draft_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  exercise_order integer not null check (exercise_order > 0),
  unique (workout_id, exercise_id),
  unique (workout_id, exercise_order),
  unique (id, user_id),
  foreign key (workout_id, user_id)
    references public.workouts(id, user_id) on delete cascade
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number integer not null check (set_number > 0),
  weight_kg numeric(8, 2) not null check (weight_kg >= 0),
  reps integer not null check (reps >= 0),
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_number),
  foreign key (workout_exercise_id, user_id)
    references public.workout_exercises(id, user_id) on delete cascade
);

create index if not exists workouts_user_completed_at_idx
  on public.workouts(user_id, completed_at desc);
create index if not exists workout_exercises_user_exercise_idx
  on public.workout_exercises(user_id, exercise_id);
create index if not exists workout_sets_user_idx
  on public.workout_sets(user_id);
create index if not exists presets_user_updated_at_idx
  on public.workout_presets(user_id, updated_at desc);
create index if not exists preset_exercises_user_preset_idx
  on public.preset_exercises(user_id, preset_id, exercise_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.enforce_workout_preset_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  preset_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  select count(*) into preset_count
  from public.workout_presets
  where user_id = new.user_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if preset_count >= 10 then
    raise exception 'A user may have at most 10 workout presets.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workouts_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();
create trigger workout_drafts_updated_at
before update on public.workout_drafts
for each row execute function public.set_updated_at();
create trigger workout_presets_updated_at
before update on public.workout_presets
for each row execute function public.set_updated_at();
create trigger auth_user_profile_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();
create trigger workout_presets_limit
  before insert or update of user_id on public.workout_presets
  for each row execute function public.enforce_workout_preset_limit();

insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', '')
from auth.users u
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_drafts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.workout_presets enable row level security;
alter table public.preset_exercises enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

create policy workouts_select_own on public.workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy workouts_insert_own on public.workouts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (preset_id is null or exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
    ))
  );
create policy workouts_update_own on public.workouts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (preset_id is null or exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
    ))
  );
create policy workouts_delete_own on public.workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_drafts_select_own on public.workout_drafts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_drafts_insert_own on public.workout_drafts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and ((preset_id is null and draft_data ->> 'presetId' is null) or (
      preset_id is not null
      and draft_data ->> 'presetId' = preset_id::text
      and exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
      )
    ))
  );
create policy workout_drafts_update_own on public.workout_drafts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and ((preset_id is null and draft_data ->> 'presetId' is null) or (
      preset_id is not null
      and draft_data ->> 'presetId' = preset_id::text
      and exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
      )
    ))
  );
create policy workout_drafts_delete_own on public.workout_drafts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_exercises_select_own on public.workout_exercises
  for select to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );
create policy workout_exercises_insert_own on public.workout_exercises
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );
create policy workout_exercises_update_own on public.workout_exercises
  for update to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  ) with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );
create policy workout_exercises_delete_own on public.workout_exercises
  for delete to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );

create policy workout_sets_select_own on public.workout_sets
  for select to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_exercises e
      where e.id = workout_exercise_id and e.user_id = (select auth.uid())
    )
  );
create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_exercises e
      where e.id = workout_exercise_id and e.user_id = (select auth.uid())
    )
  );
create policy workout_sets_update_own on public.workout_sets
  for update to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_exercises e
      where e.id = workout_exercise_id and e.user_id = (select auth.uid())
    )
  ) with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_exercises e
      where e.id = workout_exercise_id and e.user_id = (select auth.uid())
    )
  );
create policy workout_sets_delete_own on public.workout_sets
  for delete to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_exercises e
      where e.id = workout_exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy workout_presets_select_own on public.workout_presets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_presets_insert_own on public.workout_presets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_presets_update_own on public.workout_presets
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy workout_presets_delete_own on public.workout_presets
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy preset_exercises_select_own on public.preset_exercises
  for select to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
    )
  );
create policy preset_exercises_insert_own on public.preset_exercises
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
    )
  );
create policy preset_exercises_update_own on public.preset_exercises
  for update to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
    )
  ) with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
    )
  );
create policy preset_exercises_delete_own on public.preset_exercises
  for delete to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_presets p
      where p.id = preset_id and p.user_id = (select auth.uid())
    )
  );

revoke all on table public.profiles, public.workouts, public.workout_exercises,
  public.workout_sets, public.workout_drafts, public.workout_presets, public.preset_exercises from public, anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.workouts, public.workout_exercises,
  public.workout_sets, public.workout_drafts to authenticated;
grant select on table public.workout_presets, public.preset_exercises to authenticated;

create or replace function public.persist_workout_draft(p_draft jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  draft_id uuid := coalesce((p_draft ->> 'id')::uuid, gen_random_uuid());
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if nullif(trim(p_draft ->> 'name'), '') is null then
    raise exception 'Workout name is required.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_draft -> 'exercises') <> 'array' then
    raise exception 'Workout draft exercises must be an array.' using errcode = '22023';
  end if;
  if p_draft ->> 'presetId' is not null and not exists (
    select 1 from public.workout_presets p
    where p.id = (p_draft ->> 'presetId')::uuid and p.user_id = current_user_id
  ) then
    raise exception 'Preset does not belong to the current user.' using errcode = '42501';
  end if;
  insert into public.workout_drafts (id, user_id, name, started_at, preset_id, draft_data)
  values (
    draft_id,
    current_user_id,
    trim(p_draft ->> 'name'),
    (p_draft ->> 'startedAt')::timestamptz,
    (p_draft ->> 'presetId')::uuid,
    case when p_draft ->> 'presetId' is null then p_draft - 'presetId' else p_draft end
  )
  on conflict (user_id) do update set
    id = excluded.id,
    name = excluded.name,
    started_at = excluded.started_at,
    preset_id = excluded.preset_id,
    draft_data = excluded.draft_data;
  return draft_id;
end;
$$;

create or replace function public.persist_workout(p_workout jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  workout_id uuid := coalesce((p_workout ->> 'id')::uuid, gen_random_uuid());
  exercise_item jsonb;
  set_item jsonb;
  workout_exercise_id uuid;
  exercise_index integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_workout ->> 'completedAt' is null then
    raise exception 'Completed workouts require completedAt.' using errcode = '22023';
  end if;
  if nullif(trim(p_workout ->> 'name'), '') is null then
    raise exception 'Workout name is required.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_workout -> 'exercises') <> 'array' then
    raise exception 'Workout exercises must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_workout -> 'exercises') = 0 then
    raise exception 'At least one workout exercise is required.' using errcode = '23514';
  end if;
  if p_workout ->> 'presetId' is not null and not exists (
    select 1 from public.workout_presets p
    where p.id = (p_workout ->> 'presetId')::uuid and p.user_id = current_user_id
  ) then
    raise exception 'Preset does not belong to the current user.' using errcode = '42501';
  end if;

  insert into public.workouts (id, user_id, name, started_at, completed_at, preset_id)
  values (
    workout_id,
    current_user_id,
    trim(p_workout ->> 'name'),
    (p_workout ->> 'startedAt')::timestamptz,
    (p_workout ->> 'completedAt')::timestamptz,
    (p_workout ->> 'presetId')::uuid
  )
  on conflict (id) do update set
    name = excluded.name,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at,
    preset_id = excluded.preset_id
  where public.workouts.user_id = current_user_id;

  if not exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id = current_user_id
  ) then
    raise exception 'Workout is unavailable.' using errcode = '42501';
  end if;
  delete from public.workout_exercises where workout_id = persist_workout.workout_id and user_id = current_user_id;
  for exercise_item in select value from jsonb_array_elements(p_workout -> 'exercises') loop
    exercise_index := exercise_index + 1;
    workout_exercise_id := coalesce((exercise_item ->> 'id')::uuid, gen_random_uuid());
    insert into public.workout_exercises (id, workout_id, user_id, exercise_id, exercise_order)
    values (
      workout_exercise_id,
      workout_id,
      current_user_id,
      exercise_item ->> 'exerciseId',
      coalesce((exercise_item ->> 'order')::integer, exercise_index)
    );
    for set_item in select value from jsonb_array_elements(coalesce(exercise_item -> 'sets', '[]'::jsonb)) loop
      insert into public.workout_sets (id, workout_exercise_id, user_id, set_number, weight_kg, reps)
      values (
        coalesce((set_item ->> 'id')::uuid, gen_random_uuid()),
        workout_exercise_id,
        current_user_id,
        (set_item ->> 'setNumber')::integer,
        (set_item ->> 'weight')::numeric,
        (set_item ->> 'reps')::integer
      );
    end loop;
  end loop;
  delete from public.workout_drafts where id = workout_id and user_id = current_user_id;
  return workout_id;
end;
$$;

create or replace function public.persist_workout_preset(p_preset_id uuid, p_name text, p_exercises jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  preset_id uuid := coalesce(p_preset_id, gen_random_uuid());
  exercise_item jsonb;
  exercise_index integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 60 then
    raise exception 'Preset name must contain 1 to 60 characters.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one preset exercise is required.' using errcode = '23514';
  end if;

  if p_preset_id is null then
    insert into public.workout_presets (id, user_id, name)
    values (preset_id, current_user_id, trim(p_name));
  else
    update public.workout_presets
    set name = trim(p_name)
    where id = p_preset_id and user_id = current_user_id;
    if not found then
      begin
        insert into public.workout_presets (id, user_id, name)
        values (p_preset_id, current_user_id, trim(p_name));
      exception when unique_violation then
        raise exception 'Preset is unavailable.' using errcode = '42501';
      end;
    end if;
  end if;

  delete from public.preset_exercises where preset_id = persist_workout_preset.preset_id and user_id = current_user_id;
  for exercise_item in select value from jsonb_array_elements(p_exercises) loop
    exercise_index := exercise_index + 1;
    insert into public.preset_exercises (preset_id, user_id, exercise_id, exercise_order, default_sets)
    values (
      preset_id,
      current_user_id,
      exercise_item ->> 'exerciseId',
      coalesce((exercise_item ->> 'order')::integer, exercise_index),
      (exercise_item ->> 'defaultSets')::integer
    );
  end loop;
  return preset_id;
end;
$$;

create or replace function public.delete_workout_preset(p_preset_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  delete from public.workout_presets
  where id = p_preset_id and user_id = current_user_id;
  return found;
end;
$$;

revoke all on function public.persist_workout_draft(jsonb) from public, anon;
revoke all on function public.persist_workout(jsonb) from public, anon;
revoke all on function public.persist_workout_preset(uuid, text, jsonb) from public, anon;
revoke all on function public.delete_workout_preset(uuid) from public, anon;
grant execute on function public.persist_workout_draft(jsonb) to authenticated;
grant execute on function public.persist_workout(jsonb) to authenticated;
grant execute on function public.persist_workout_preset(uuid, text, jsonb) to authenticated;
grant execute on function public.delete_workout_preset(uuid) to authenticated;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.enforce_workout_preset_limit() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
grant usage on schema public to authenticated;
