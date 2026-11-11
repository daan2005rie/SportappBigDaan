-- Frozen allowlist from exercises.json; extend deliberately when the catalog grows.
create or replace function public.is_standard_exercise_id(p_id text)
returns boolean language sql immutable security invoker set search_path = ''
as $$ select coalesce(p_id = any (array['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127', '128', '129', '130', '131', '132', '133', '134', '135', '136', '137', '138', '139', '140', '141', '142', '143', '144', '145', '146', '147', '148', '149', '150', '151', '152', '153', '154', '155', '156', '157', '158', '159', '160', '161', '162', '163', '164', '165', '166', '167', '168', '169', '170', '171', '172', '173', '174', '175', '176', '177', '178', '179', '180', '181', '182', '183', '184', '185', '186', '187', '188', '189', '190', '191', '192', '193', '194', '195', '196', '197', '198', '199', '200', '201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '212', '213', '214', '215', '216', '217', '218', '219', '220']::text[]), false); $$;
revoke all on function public.is_standard_exercise_id(text) from public, anon;
grant execute on function public.is_standard_exercise_id(text) to authenticated;

create table public.personal_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 2000),
  primary_muscles text[] not null check (
    cardinality(primary_muscles) > 0
    and array_position(primary_muscles, '') is null
  ),
  secondary_muscles text[] not null default '{}',
  equipment text,
  movement_type text check (movement_type is null or movement_type in ('Cardio', 'Compound', 'Isolation', 'Isometrisch')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index personal_exercises_user_name_idx
  on public.personal_exercises(user_id, name)
  where archived_at is null;

alter table public.workout_exercises
  add column personal_exercise_id uuid,
  add column exercise_name text,
  add column primary_muscles text[],
  add column secondary_muscles text[],
  add column description text,
  add column equipment text,
  add column movement_type text,
  add constraint workout_exercises_personal_exercise_owner_fk
    foreign key (personal_exercise_id, user_id)
    references public.personal_exercises(id, user_id);

alter table public.preset_exercises
  add column personal_exercise_id uuid,
  add constraint preset_exercises_personal_exercise_owner_fk
    foreign key (personal_exercise_id, user_id)
    references public.personal_exercises(id, user_id);

create trigger personal_exercises_updated_at
before update on public.personal_exercises
for each row execute function public.set_updated_at();

alter table public.personal_exercises enable row level security;

create policy personal_exercises_select_own on public.personal_exercises
  for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_exercises_insert_own on public.personal_exercises
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_exercises_update_own on public.personal_exercises
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy personal_exercises_delete_own on public.personal_exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.personal_exercises from public, anon, authenticated;
grant select, insert, delete on table public.personal_exercises to authenticated;
grant update (name, description, primary_muscles, secondary_muscles, equipment, movement_type, archived_at)
  on table public.personal_exercises to authenticated;

create or replace function public.prevent_referenced_personal_exercise_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if pg_catalog.pg_trigger_depth() = 1 then
    raise exception 'Personal exercises must be archived instead of deleted.' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger personal_exercises_prevent_referenced_delete
before delete on public.personal_exercises
for each row execute function public.prevent_referenced_personal_exercise_delete();

create or replace function public.assert_exercise_ids_owned(p_exercises jsonb, p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  exercise_item jsonb;
  v_exercise_id text;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'Exercise ownership validation failed.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_exercises) is distinct from 'array' then
    raise exception 'Exercises must be an array.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_exercises) <> (select count(distinct e ->> 'exerciseId') from jsonb_array_elements(p_exercises) e) then
    raise exception 'Duplicate or missing exercise IDs.' using errcode = '23514';
  end if;
  for exercise_item in select value from jsonb_array_elements(p_exercises) loop
    if jsonb_typeof(exercise_item) is distinct from 'object' then
      raise exception 'Exercise must be an object.' using errcode = '22023';
    end if;
    v_exercise_id := exercise_item ->> 'exerciseId';
    if v_exercise_id is null or v_exercise_id = '' then
      raise exception 'Exercise ID is required.' using errcode = '23514';
    elsif public.is_standard_exercise_id(v_exercise_id) then
      continue;
    elsif v_exercise_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      if not exists (
        select 1 from public.personal_exercises as pe
        where pe.id = v_exercise_id::uuid and pe.user_id = p_user_id
      ) then
        raise exception 'Personal exercise is unavailable.' using errcode = '42501';
      end if;
    else
      raise exception 'Exercise ID is invalid.' using errcode = '23514';
    end if;
  end loop;
end;
$$;

-- Existing references may survive archiving. Context is always checked against auth.uid().
create or replace function public.assert_exercise_availability(
  p_exercises jsonb, p_workout_id uuid default null, p_preset_id uuid default null,
  p_use_draft boolean default false
)
returns void language plpgsql security invoker set search_path = ''
as $$
declare item jsonb; exercise_uuid uuid;
begin
  perform public.assert_exercise_ids_owned(p_exercises, auth.uid());
  for item in select value from jsonb_array_elements(p_exercises) loop
    if public.is_standard_exercise_id(item ->> 'exerciseId') then continue; end if;
    exercise_uuid := (item ->> 'exerciseId')::uuid;
    -- Serialize archive/update against validation until the RPC transaction finishes.
    perform 1 from public.personal_exercises pe
      where pe.id = exercise_uuid and pe.user_id = auth.uid() for share;
    if exists (select 1 from public.personal_exercises pe
        where pe.id = exercise_uuid and pe.user_id = auth.uid() and pe.archived_at is not null)
      and not exists (select 1 from public.workout_exercises we
        where we.workout_id = p_workout_id and we.user_id = auth.uid()
          and we.personal_exercise_id = exercise_uuid)
      and not exists (select 1 from public.preset_exercises pe
        where pe.preset_id = p_preset_id and pe.user_id = auth.uid()
          and pe.personal_exercise_id = exercise_uuid)
      and not exists (select 1 from public.workout_drafts wd,
          lateral jsonb_array_elements(wd.draft_data -> 'exercises') e
        where p_use_draft and wd.id = p_workout_id and wd.user_id = auth.uid()
          and e ->> 'exerciseId' = exercise_uuid::text)
    then
      raise exception 'Archived exercise cannot be newly added.' using errcode = '23514';
    end if;
  end loop;
end;
$$;
revoke all on function public.assert_exercise_availability(jsonb, uuid, uuid, boolean) from public, anon;
grant execute on function public.assert_exercise_availability(jsonb, uuid, uuid, boolean) to authenticated;

-- Validate UI choices at the database boundary too; no owner or identity changes.
create or replace function public.validate_personal_exercise()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.user_id is distinct from old.user_id) then
    raise exception 'Exercise identity and owner are immutable.' using errcode = '42501';
  end if;
  if array_ndims(new.primary_muscles) is distinct from 1
    or cardinality(new.primary_muscles) = 0
    or array_position(new.primary_muscles, null) is not null
    or array_position(new.secondary_muscles, null) is not null
    or (cardinality(new.secondary_muscles) > 0 and array_ndims(new.secondary_muscles) is distinct from 1)
    or new.primary_muscles && new.secondary_muscles
    or cardinality(new.primary_muscles) <> (select count(distinct m) from unnest(new.primary_muscles) m)
    or cardinality(new.secondary_muscles) <> (select count(distinct m) from unnest(new.secondary_muscles) m)
    or exists (select 1 from unnest(new.primary_muscles || new.secondary_muscles) m
      where not (m = any (array['Achterste schouder', 'Achterste schouderkop', 'Adductoren', 'Anconeus', 'Benen', 'Benen/Core', 'Benen/Full body', 'Benen/Glutes', 'Benen/Rug', 'Benen/Schouders/Core', 'Biceps', 'Biceps (stabilisatie)', 'Biceps/Unterarm', 'Borst', 'Borst/Rug', 'Borst/Triceps', 'Bovenrug', 'Brachialis', 'Brachioradialis', 'Core', 'Core/Cardio', 'Core/Grip', 'Enkelstabilisatoren', 'Erector spinae', 'Full body', 'Full body/Cardio', 'Full body/Core', 'Full body/Grip', 'Gastrocnemius', 'Glutes', 'Glutes/Hamstrings', 'Gluteus maximus', 'Gluteus medius', 'Gluteus minimus', 'Gracilis', 'Gripspieren', 'Hamstrings', 'Hamstrings/Glutes', 'Heupflexoren', 'Kuiten', 'Latissimus dorsi', 'Levator scapulae', 'Middelste schouderkop', 'Middelste/onderste trapezius', 'Obliques', 'Onderarmen', 'Onderarmen/Grip', 'Onderrug', 'Onderrug/Glutes', 'Pectineus', 'Pectoralis major', 'Pectoralis major (bovenkant)', 'Polsflexoren/extensoren', 'Polsstabilisatoren', 'Quadriceps', 'Quadriceps/Glutes', 'Rectus abdominis', 'Rectus femoris', 'Rhomboids', 'Rotator cuff', 'Rug', 'Rug/Benen', 'Rug/Biceps', 'Scheenbeen', 'Schouders', 'Schouders/Borst', 'Schouders/Rug', 'Schouders/Trapezius', 'Serratus anterior', 'Soleus', 'Supraspinatus', 'Tibialis posterior', 'Transversus abdominis', 'Trapezius', 'Triceps', 'Triceps lange kop', 'Triceps/Borst', 'Vastus lateralis', 'Vastus medialis', 'Vingerflexoren', 'Voet- en enkelstabilisatoren', 'Voorste schouderkop']::text[])))
    or (new.equipment is not null and not (new.equipment = any (array['Ab wheel', 'Bank', 'Barbell', 'Barbell/Dumbbell', 'Barbell/Dumbbells', 'Barbell/Machine', 'Box', 'Dumbbell', 'Dumbbell/Kabel', 'Dumbbells', 'Dumbbells/Kettlebells', 'EZ-bar', 'Gewicht', 'Kabel', 'Kabel/Machine', 'Kettlebell', 'Lichaamsgewicht', 'Lichaamsgewicht/Gewicht', 'Lichaamsgewicht/Machine', 'Machine', 'Machine/Dumbbells', 'Machine/EZ-bar', 'Machine/Gewicht', 'Medicine ball', 'Plate', 'Sled', 'Smith machine', 'Touwen']::text[]))) then
    raise exception 'Invalid muscle groups or equipment.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger personal_exercises_validate before insert or update on public.personal_exercises
for each row execute function public.validate_personal_exercise();
revoke all on function public.validate_personal_exercise() from public, anon, authenticated;

create or replace function public.validate_workout_draft_exercise_ownership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.assert_exercise_ids_owned(new.draft_data -> 'exercises', new.user_id);
  perform public.assert_exercise_availability(new.draft_data -> 'exercises', new.id, new.preset_id, true);
  if exists (select 1 from jsonb_array_elements(new.draft_data -> 'exercises') e
      where jsonb_typeof(e -> 'sets') is distinct from 'array') then
    raise exception 'Draft exercise sets must be arrays.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger workout_draft_exercise_ownership
before insert or update on public.workout_drafts
for each row execute function public.validate_workout_draft_exercise_ownership();

revoke all on function public.assert_exercise_ids_owned(jsonb, uuid) from public, anon;
grant execute on function public.assert_exercise_ids_owned(jsonb, uuid) to authenticated;
revoke all on function public.prevent_referenced_personal_exercise_delete() from public, anon, authenticated;
revoke all on function public.validate_workout_draft_exercise_ownership() from public, anon, authenticated;

drop policy workout_exercises_insert_own on public.workout_exercises;
create policy workout_exercises_insert_own on public.workout_exercises
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts as w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
    and (
      (personal_exercise_id is null and public.is_standard_exercise_id(exercise_id))
      or (
        personal_exercise_id is not null
        and exercise_id = personal_exercise_id::text
        and exists (
          select 1 from public.personal_exercises as pe
          where pe.id = personal_exercise_id and pe.user_id = (select auth.uid())
        )
      )
    )
  );

drop policy workout_exercises_update_own on public.workout_exercises;
create policy workout_exercises_update_own on public.workout_exercises
  for update to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts as w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  ) with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts as w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
    and (
      (personal_exercise_id is null and public.is_standard_exercise_id(exercise_id))
      or (
        personal_exercise_id is not null
        and exercise_id = personal_exercise_id::text
        and exists (
          select 1 from public.personal_exercises as pe
          where pe.id = personal_exercise_id and pe.user_id = (select auth.uid())
        )
      )
    )
  );

create or replace function public.validate_workout_exercise_reference()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare parent_preset_id uuid;
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.user_id, new.workout_id, new.exercise_id, new.personal_exercise_id,
        new.exercise_name, new.primary_muscles, new.secondary_muscles, new.description,
        new.equipment, new.movement_type) is distinct from
       (old.id, old.user_id, old.workout_id, old.exercise_id, old.personal_exercise_id,
        old.exercise_name, old.primary_muscles, old.secondary_muscles, old.description,
        old.equipment, old.movement_type) then
      raise exception 'Historical exercise identity and snapshot are immutable.' using errcode = '42501';
    end if;
  end if;
  if auth.uid() is null and current_user not in ('anon', 'authenticated') then return new; end if;
  select w.preset_id into parent_preset_id from public.workouts w
    where w.id = new.workout_id and w.user_id = auth.uid();
  perform public.assert_exercise_availability(
    jsonb_build_array(jsonb_build_object('exerciseId', new.exercise_id)),
    new.workout_id, parent_preset_id, true);
  return new;
end;
$$;
create trigger workout_exercises_validate_reference before insert or update on public.workout_exercises
for each row execute function public.validate_workout_exercise_reference();
revoke all on function public.validate_workout_exercise_reference() from public, anon, authenticated;

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
  if jsonb_typeof(p_draft -> 'exercises') is distinct from 'array' then
    raise exception 'Workout draft exercises must be an array.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 1));
  perform public.assert_exercise_availability(p_draft -> 'exercises', draft_id, (p_draft ->> 'presetId')::uuid, true);
  if p_draft ->> 'presetId' is not null and not exists (
    select 1 from public.workout_presets as p
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
  v_workout_id uuid := coalesce((p_workout ->> 'id')::uuid, gen_random_uuid());
  exercise_item jsonb;
  set_item jsonb;
  v_workout_exercise_id uuid;
  exercise_index integer := 0;
  v_exercise_id text;
  exercise_name_value text;
  primary_muscles_value text[];
  secondary_muscles_value text[];
  description_value text;
  equipment_value text;
  movement_type_value text;
  personal_exercise_id_value uuid;
  previous_exercise public.workout_exercises%rowtype;
  exercise_sets jsonb;
  set_weight numeric(8, 2);
  set_reps integer;
  set_number_value integer;
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
  if jsonb_typeof(p_workout -> 'exercises') is distinct from 'array' or jsonb_array_length(p_workout -> 'exercises') = 0 then
    raise exception 'At least one workout exercise is required.' using errcode = '23514';
  end if;
  perform public.assert_exercise_availability(p_workout -> 'exercises', v_workout_id, (p_workout ->> 'presetId')::uuid, true);
  if p_workout ->> 'presetId' is not null and not exists (
    select 1 from public.workout_presets as p
    where p.id = (p_workout ->> 'presetId')::uuid and p.user_id = current_user_id
  ) then
    raise exception 'Preset does not belong to the current user.' using errcode = '42501';
  end if;

  insert into public.workouts (id, user_id, name, started_at, completed_at, preset_id)
  values (
    v_workout_id,
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
    select 1 from public.workouts as w
    where w.id = v_workout_id and w.user_id = current_user_id
  ) then
    raise exception 'Workout is unavailable.' using errcode = '42501';
  end if;

  -- Parent upsert locks the workout. Move old orders out of the way so swaps do not
  -- violate the existing immediate unique(workout_id, exercise_order) constraint.
  update public.workout_exercises we set exercise_order = we.exercise_order +
    (select coalesce(max(other.exercise_order), 0) from public.workout_exercises other
      where other.workout_id = v_workout_id and other.user_id = current_user_id) +
    jsonb_array_length(p_workout -> 'exercises')
  where we.workout_id = v_workout_id and we.user_id = current_user_id;

  for exercise_item in select value from jsonb_array_elements(p_workout -> 'exercises') loop
    exercise_index := exercise_index + 1;
    v_exercise_id := exercise_item ->> 'exerciseId';
    v_workout_exercise_id := coalesce((exercise_item ->> 'id')::uuid, gen_random_uuid());
    personal_exercise_id_value := null;

    select we.* into previous_exercise from public.workout_exercises we
      where we.workout_id = v_workout_id and we.user_id = current_user_id and we.exercise_id = v_exercise_id;
    if found then
      exercise_name_value := previous_exercise.exercise_name;
      primary_muscles_value := previous_exercise.primary_muscles;
      secondary_muscles_value := previous_exercise.secondary_muscles;
      description_value := previous_exercise.description;
      equipment_value := previous_exercise.equipment;
      movement_type_value := previous_exercise.movement_type;
      personal_exercise_id_value := previous_exercise.personal_exercise_id;
    elsif v_exercise_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      personal_exercise_id_value := v_exercise_id::uuid;
      select pe.name, pe.primary_muscles, pe.secondary_muscles, pe.description, pe.equipment, pe.movement_type
      into exercise_name_value, primary_muscles_value, secondary_muscles_value, description_value, equipment_value, movement_type_value
      from public.personal_exercises as pe
      where pe.id = v_exercise_id::uuid and pe.user_id = current_user_id;
    else
      exercise_name_value := exercise_item ->> 'name';
      -- Missing/JSON-null metadata from old frontends must remain SQL NULL.
      -- In particular, missing secondary muscles differ from an explicit [].
      select array_agg(value) into primary_muscles_value
      from jsonb_array_elements_text(coalesce(nullif(exercise_item -> 'primaryMuscles', 'null'::jsonb), '[]'::jsonb));
      if coalesce(cardinality(primary_muscles_value), 0) = 0 and nullif(exercise_item ->> 'muscleGroup', '') is not null then
        primary_muscles_value := array[exercise_item ->> 'muscleGroup'];
      end if;
      secondary_muscles_value := null;
      if jsonb_typeof(exercise_item -> 'secondaryMuscles') = 'array' then
        select coalesce(array_agg(value), '{}'::text[]) into secondary_muscles_value
        from jsonb_array_elements_text(exercise_item -> 'secondaryMuscles');
      elsif nullif(exercise_item -> 'secondaryMuscles', 'null'::jsonb) is not null then
        raise exception 'Secondary muscles must be an array.' using errcode = '22023';
      end if;
      description_value := exercise_item ->> 'description';
      equipment_value := exercise_item ->> 'type';
      movement_type_value := exercise_item ->> 'movementType';
    end if;

    insert into public.workout_exercises (
      id, workout_id, user_id, exercise_id, personal_exercise_id, exercise_order, exercise_name,
      primary_muscles, secondary_muscles, description, equipment, movement_type
    ) values (
      v_workout_exercise_id, v_workout_id, current_user_id, v_exercise_id, personal_exercise_id_value,
      exercise_index, exercise_name_value,
      primary_muscles_value, secondary_muscles_value,
      description_value, equipment_value, movement_type_value
    ) on conflict (workout_id, exercise_id) do update set
      exercise_order = excluded.exercise_order
    returning id into v_workout_exercise_id;

    exercise_sets := coalesce(exercise_item -> 'sets', '[]'::jsonb);
    if jsonb_typeof(exercise_sets) is distinct from 'array' then
      raise exception 'Workout sets must be an array.' using errcode = '22023';
    end if;
    -- The original schema allowed historical exercises without sets. Preserve
    -- those on resave, but do not silently erase existing results or accept a
    -- new completed exercise without sets.
    if jsonb_array_length(exercise_sets) = 0 and (
      previous_exercise.id is null or exists (
        select 1 from public.workout_sets ws where ws.workout_exercise_id = v_workout_exercise_id
          and ws.user_id = current_user_id
      )
    ) then
      raise exception 'At least one set is required.' using errcode = '23514';
    end if;
    delete from public.workout_sets ws
      where ws.workout_exercise_id = v_workout_exercise_id and ws.user_id = current_user_id;

    for set_item in select value from jsonb_array_elements(exercise_sets) loop
      if jsonb_typeof(set_item) is distinct from 'object' then
        raise exception 'Invalid workout set.' using errcode = '23514';
      end if;
      -- Use the original column types instead of a formatting regex. This keeps
      -- valid decimals (including .5 / exponent notation) and historical 0 reps.
      begin
        set_weight := (set_item ->> 'weight')::numeric(8, 2);
        set_reps := (set_item ->> 'reps')::integer;
        set_number_value := (set_item ->> 'setNumber')::integer;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Invalid workout set.' using errcode = '23514';
      end;
      if set_weight is null or set_weight < 0 or set_weight = 'NaN'::numeric
        or set_reps is null or set_reps < 0
        or set_number_value is null or set_number_value <= 0 then
        raise exception 'Invalid workout set.' using errcode = '23514';
      end if;
      insert into public.workout_sets (id, workout_exercise_id, user_id, set_number, weight_kg, reps)
      values (
        coalesce((set_item ->> 'id')::uuid, gen_random_uuid()),
        v_workout_exercise_id,
        current_user_id,
        set_number_value,
        set_weight,
        set_reps
      );
    end loop;
  end loop;

  delete from public.workout_exercises we
    where we.workout_id = v_workout_id and we.user_id = current_user_id
      and not exists (select 1 from jsonb_array_elements(p_workout -> 'exercises') e
        where e ->> 'exerciseId' = we.exercise_id);

  delete from public.workout_drafts as wd
  where wd.id = v_workout_id and wd.user_id = current_user_id;
  return v_workout_id;
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
  v_preset_id uuid := coalesce(p_preset_id, gen_random_uuid());
  exercise_item jsonb;
  exercise_index integer := 0;
  v_exercise_id text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 60 then
    raise exception 'Preset name must contain 1 to 60 characters.' using errcode = '23514';
  end if;
  if jsonb_typeof(p_exercises) is distinct from 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one preset exercise is required.' using errcode = '23514';
  end if;

  if p_preset_id is null then
    insert into public.workout_presets (id, user_id, name)
    values (v_preset_id, current_user_id, trim(p_name));
  else
    update public.workout_presets as wp
    set name = trim(p_name)
    where wp.id = p_preset_id and wp.user_id = current_user_id;
    if not found then
      begin
        insert into public.workout_presets (id, user_id, name)
        values (p_preset_id, current_user_id, trim(p_name));
      exception when unique_violation then
        raise exception 'Preset is unavailable.' using errcode = '42501';
      end;
    end if;
  end if;

  perform public.assert_exercise_availability(p_exercises, null, v_preset_id, false);

  delete from public.preset_exercises as pe
  where pe.preset_id = v_preset_id and pe.user_id = current_user_id;
  for exercise_item in select value from jsonb_array_elements(p_exercises) loop
    exercise_index := exercise_index + 1;
    v_exercise_id := exercise_item ->> 'exerciseId';
    if coalesce(exercise_item ->> 'defaultSets', '') !~ '^([1-9]|10)$' then
      raise exception 'Default sets must be between 1 and 10.' using errcode = '23514';
    end if;
    insert into public.preset_exercises (preset_id, user_id, exercise_id, personal_exercise_id, exercise_order, default_sets)
    values (
      v_preset_id,
      current_user_id,
      v_exercise_id,
      case when v_exercise_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then v_exercise_id::uuid else null end,
      exercise_index,
      (exercise_item ->> 'defaultSets')::integer
    );
  end loop;
  return v_preset_id;
end;
$$;

revoke all on function public.persist_workout_draft(jsonb) from public, anon;
revoke all on function public.persist_workout(jsonb) from public, anon;
revoke all on function public.persist_workout_preset(uuid, text, jsonb) from public, anon;
grant execute on function public.persist_workout_draft(jsonb) to authenticated;
grant execute on function public.persist_workout(jsonb) to authenticated;
grant execute on function public.persist_workout_preset(uuid, text, jsonb) to authenticated;
