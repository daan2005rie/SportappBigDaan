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

  delete from public.preset_exercises as pe
  where pe.preset_id = v_preset_id and pe.user_id = current_user_id;

  for exercise_item in
    select exercise_data.value
    from jsonb_array_elements(p_exercises) as exercise_data(value)
  loop
    exercise_index := exercise_index + 1;
    insert into public.preset_exercises (preset_id, user_id, exercise_id, exercise_order, default_sets)
    values (
      v_preset_id,
      current_user_id,
      exercise_item ->> 'exerciseId',
      coalesce((exercise_item ->> 'order')::integer, exercise_index),
      (exercise_item ->> 'defaultSets')::integer
    );
  end loop;
  return v_preset_id;
end;
$$;
