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
    select 1 from public.workout_presets as wp
    where wp.id = (p_workout ->> 'presetId')::uuid and wp.user_id = current_user_id
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

  delete from public.workout_exercises as we
  where we.workout_id = v_workout_id and we.user_id = current_user_id;

  for exercise_item in
    select exercise_data.value
    from jsonb_array_elements(p_workout -> 'exercises') as exercise_data(value)
  loop
    exercise_index := exercise_index + 1;
    v_workout_exercise_id := coalesce((exercise_item ->> 'id')::uuid, gen_random_uuid());
    insert into public.workout_exercises (id, workout_id, user_id, exercise_id, exercise_order)
    values (
      v_workout_exercise_id,
      v_workout_id,
      current_user_id,
      exercise_item ->> 'exerciseId',
      coalesce((exercise_item ->> 'order')::integer, exercise_index)
    );

    for set_item in
      select set_data.value
      from jsonb_array_elements(coalesce(exercise_item -> 'sets', '[]'::jsonb)) as set_data(value)
    loop
      insert into public.workout_sets (id, workout_exercise_id, user_id, set_number, weight_kg, reps)
      values (
        coalesce((set_item ->> 'id')::uuid, gen_random_uuid()),
        v_workout_exercise_id,
        current_user_id,
        (set_item ->> 'setNumber')::integer,
        (set_item ->> 'weight')::numeric,
        (set_item ->> 'reps')::integer
      );
    end loop;
  end loop;

  delete from public.workout_drafts as wd
  where wd.id = v_workout_id and wd.user_id = current_user_id;
  return v_workout_id;
end;
$$;
