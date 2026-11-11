-- ONLY run after migrations on a disposable, separate test database as administrator. Never production.
-- Fixtures and assertions are rolled back at the end.
begin;

-- Check the real function privileges/settings, not just their source code.
do $$
declare signature text;
begin
  foreach signature in array array[
    'public.persist_workout(jsonb)', 'public.persist_workout_draft(jsonb)',
    'public.persist_workout_preset(uuid,text,jsonb)', 'public.delete_workout_preset(uuid)'
  ] loop
    if has_function_privilege('anon', signature, 'execute')
      or not has_function_privilege('authenticated', signature, 'execute') then
      raise exception 'Unexpected RPC execution privileges for %', signature;
    end if;
  end loop;
  if not exists (select 1 from pg_proc p
      where p.oid = 'public.persist_workout_preset(uuid,text,jsonb)'::regprocedure
        and p.prosecdef and p.proconfig @> array['search_path=""']) then
    raise exception 'Preset RPC definer/search_path settings are incorrect.';
  end if;
end;
$$;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-user-a@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-user-b@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.personal_exercises (id, user_id, name, primary_muscles)
values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'A private exercise', array['Borst']),
  ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'B private exercise', array['Rug']);

insert into public.workouts (id, user_id, name, started_at, completed_at)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'A workout', now() - interval '1 hour', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'B workout', now() - interval '1 hour', now());
insert into public.workout_exercises (id, workout_id, user_id, exercise_id, exercise_order)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '9', 1),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '9', 1);
insert into public.workout_sets (id, workout_exercise_id, user_id, set_number, weight_kg, reps)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1, 50, 8),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 1, 50, 8);
insert into public.workout_presets (id, user_id, name)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'A preset'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'B preset');
insert into public.preset_exercises (id, preset_id, user_id, exercise_id, exercise_order, default_sets)
values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '9', 1, 3),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '9', 1, 3);
insert into public.preset_exercises (preset_id, user_id, exercise_id, personal_exercise_id, exercise_order, default_sets)
values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  2,
  3
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
declare affected integer; snapshot_workout_id uuid;
begin
  insert into public.workouts (id, user_id, name, started_at, completed_at)
  values ('20000000-0000-4000-8000-000000000003', auth.uid(), 'A own insert', now() - interval '1 hour', now());
  perform public.persist_workout_preset(
    '50000000-0000-4000-8000-000000000003',
    'A own insert',
    '[{"exerciseId":"70000000-0000-4000-8000-000000000001","order":1,"defaultSets":3}]'::jsonb
  );
  if (select count(*) from public.workouts) <> 2 or exists (select 1 from public.workouts where id = '20000000-0000-4000-8000-000000000002') then
    raise exception 'User A can read another user workout.';
  end if;
  begin
    insert into public.workouts (user_id, name, started_at, completed_at)
    values ('10000000-0000-4000-8000-000000000002', 'cross-user insert', now() - interval '1 hour', now());
    raise exception 'User A inserted a workout for User B.';
  exception when insufficient_privilege then null; end;
  update public.workouts set name = 'A workout updated' where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'User A cannot update own workout.'; end if;
  update public.workouts set name = 'stolen' where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User A updated User B workout.'; end if;
  delete from public.workouts where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User A deleted User B workout.'; end if;
  if (select count(*) from public.workout_exercises) <> 1 or (select count(*) from public.workout_sets) <> 1 then
    raise exception 'User A can read another user workout children.';
  end if;
  -- A separate block below tests old-client payloads and resaves without
  -- affecting the fixture counts or the preset-limit checks in this block.
  if (select count(*) from public.workout_presets) <> 2 or (select count(*) from public.preset_exercises) <> 3 then
    raise exception 'User A can read another user preset data.';
  end if;
  if (select count(*) from public.personal_exercises) <> 1
    or not exists (select 1 from public.personal_exercises where id = '70000000-0000-4000-8000-000000000001') then
    raise exception 'User A cannot read own personal exercise or can read another user exercise.';
  end if;
  perform public.assert_exercise_ids_owned('[{"exerciseId":"70000000-0000-4000-8000-000000000001"}]'::jsonb, auth.uid());
  update public.personal_exercises set archived_at = now()
  where id = '70000000-0000-4000-8000-000000000001';
  if not exists (select 1 from public.personal_exercises where id = '70000000-0000-4000-8000-000000000001' and archived_at is not null) then
    raise exception 'User A cannot archive own personal exercise.';
  end if;
  update public.personal_exercises set name = 'stolen'
  where id = '70000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User A updated User B personal exercise.'; end if;
  delete from public.personal_exercises where id = '70000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User A deleted User B personal exercise.'; end if;
  begin
    delete from public.personal_exercises where id = '70000000-0000-4000-8000-000000000001';
    raise exception 'A referenced personal exercise was physically deleted.';
  exception when foreign_key_violation then null; end;
  snapshot_workout_id := public.persist_workout(jsonb_build_object(
    'presetId', '50000000-0000-4000-8000-000000000001',
    'name', 'Personal exercise snapshot',
    'startedAt', now() - interval '1 hour',
    'completedAt', now(),
    'exercises', jsonb_build_array(jsonb_build_object(
      'exerciseId', '70000000-0000-4000-8000-000000000001',
      'sets', jsonb_build_array(jsonb_build_object('setNumber', 1, 'weight', 40, 'reps', 8))
    ))
  ));
  if not exists (
    select 1 from public.workout_exercises as we
    where we.workout_id = snapshot_workout_id
      and we.exercise_name = 'A private exercise'
      and we.primary_muscles = array['Borst']
  ) then
    raise exception 'Completed workout did not retain the personal exercise snapshot.';
  end if;
  -- Rename/archive must not rewrite completed workout snapshots, even if the client sends new metadata.
  update public.personal_exercises set name = 'Changed name', description = 'Changed description',
    primary_muscles = array['Rug'], secondary_muscles = array['Biceps']
    where id = '70000000-0000-4000-8000-000000000001';
  perform public.persist_workout(jsonb_build_object(
    'id', snapshot_workout_id, 'name', 'Resaved snapshot',
    'startedAt', now() - interval '1 hour', 'completedAt', now(),
    'exercises', jsonb_build_array(jsonb_build_object(
      'exerciseId', '70000000-0000-4000-8000-000000000001',
      'name', 'Changed name', 'description', 'Changed description',
      'primaryMuscles', jsonb_build_array('Rug'),
      'sets', jsonb_build_array(jsonb_build_object('setNumber', 1, 'weight', 45, 'reps', 8))
    ))
  ));
  if not exists (select 1 from public.workout_exercises we
      where we.workout_id = snapshot_workout_id and we.exercise_name = 'A private exercise'
        and we.description = '' and we.primary_muscles = array['Borst'] and we.secondary_muscles = '{}') then
    raise exception 'Resave changed historical metadata.';
  end if;
  -- Add a standard exercise, then swap both positions without replacing the personal snapshot.
  perform public.persist_workout(jsonb_build_object(
    'id', snapshot_workout_id, 'name', 'Order test', 'startedAt', now() - interval '1 hour', 'completedAt', now(),
    'exercises', '[{"exerciseId":"9","name":"Bench Press","sets":[{"setNumber":1,"weight":50,"reps":8}]},{"exerciseId":"70000000-0000-4000-8000-000000000001","sets":[{"setNumber":1,"weight":45,"reps":8}]}]'::jsonb));
  perform public.persist_workout(jsonb_build_object(
    'id', snapshot_workout_id, 'name', 'Swapped order', 'startedAt', now() - interval '1 hour', 'completedAt', now(),
    'exercises', '[{"exerciseId":"70000000-0000-4000-8000-000000000001","sets":[{"setNumber":1,"weight":45,"reps":8}]},{"exerciseId":"9","sets":[{"setNumber":1,"weight":50,"reps":8}]}]'::jsonb));
  if not exists (select 1 from public.workout_exercises we where we.workout_id = snapshot_workout_id
      and we.exercise_order = 1 and we.exercise_name = 'A private exercise' and we.description = '') then
    raise exception 'Reordering changed snapshot or failed to save order.';
  end if;
  begin
    update public.workout_exercises set exercise_name = 'Tampered snapshot'
      where workout_id = snapshot_workout_id;
    raise exception 'Direct snapshot rewrite accepted.';
  exception when insufficient_privilege then null; end;
  -- Existing archived preset items can be saved and used for new sessions.
  perform public.persist_workout_preset('50000000-0000-4000-8000-000000000003', 'Existing archive',
    '[{"exerciseId":"70000000-0000-4000-8000-000000000001","defaultSets":2}]'::jsonb);
  perform public.persist_workout_draft(jsonb_build_object(
    'id', '80000000-0000-4000-8000-000000000001', 'name', 'From existing preset',
    'presetId', '50000000-0000-4000-8000-000000000001', 'startedAt', now(),
    'exercises', '[{"exerciseId":"70000000-0000-4000-8000-000000000001","sets":[]}]'::jsonb));
  -- Subsequent saves of that active session need no preset provenance.
  perform public.persist_workout_draft(jsonb_build_object(
    'id', '80000000-0000-4000-8000-000000000001', 'name', 'Existing active session', 'startedAt', now(),
    'exercises', '[{"exerciseId":"70000000-0000-4000-8000-000000000001","sets":[]}]'::jsonb));
  begin
    perform public.persist_workout_preset(null, 'New archive forbidden',
      '[{"exerciseId":"70000000-0000-4000-8000-000000000001","defaultSets":2}]'::jsonb);
    raise exception 'Archived exercise added to new preset.';
  exception when check_violation then null; end;
  begin
    perform public.persist_workout_draft(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'New archived draft', 'startedAt', now(),
      'exercises', '[{"exerciseId":"70000000-0000-4000-8000-000000000001","sets":[]}]'::jsonb));
    raise exception 'Archived exercise added to new draft.';
  exception when check_violation then null; end;
  begin
    perform public.persist_workout(jsonb_build_object(
      'name', 'New archived workout', 'startedAt', now(), 'completedAt', now(),
      'exercises', '[{"exerciseId":"70000000-0000-4000-8000-000000000001","sets":[{"setNumber":1,"weight":20,"reps":8}]}]'::jsonb));
    raise exception 'Archived exercise added to new workout.';
  exception when check_violation then null; end;
  begin
    update public.personal_exercises set id = gen_random_uuid()
      where id = '70000000-0000-4000-8000-000000000001';
    raise exception 'Stable exercise ID changed.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.assert_exercise_ids_owned('[{"exerciseId":"999999"}]'::jsonb, auth.uid());
    raise exception 'Invalid standard exercise ID accepted.';
  exception when check_violation then null; end;
  begin
    insert into public.personal_exercises(user_id, name, primary_muscles, secondary_muscles)
      values (auth.uid(), 'Invalid overlap', array['Borst'], array['Borst']);
    raise exception 'Overlapping muscles accepted.';
  exception when check_violation then null; end;
  begin
    perform public.assert_exercise_ids_owned(null, auth.uid());
    raise exception 'Missing exercises accepted.';
  exception when invalid_parameter_value then null; end;
  perform public.persist_workout(jsonb_build_object(
    'id', '80000000-0000-4000-8000-000000000001', 'name', 'Finish archived active session',
    'startedAt', now() - interval '1 hour', 'completedAt', now(),
    'exercises', '[{"exerciseId":"70000000-0000-4000-8000-000000000001","sets":[{"setNumber":1,"weight":30,"reps":8}]}]'::jsonb));
  if exists (select 1 from public.workout_drafts where id = '80000000-0000-4000-8000-000000000001') then
    raise exception 'Completed active workout draft was not cleared.';
  end if;
  delete from public.workouts where id = '80000000-0000-4000-8000-000000000001';
  delete from public.workouts where id = snapshot_workout_id;
  begin
    update public.personal_exercises set user_id = '10000000-0000-4000-8000-000000000002'
    where id = '70000000-0000-4000-8000-000000000001';
    raise exception 'User A reassigned a personal exercise to User B.';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.personal_exercises (user_id, name, primary_muscles)
    values ('10000000-0000-4000-8000-000000000002', 'Cross-user insert', array['Borst']);
    raise exception 'User A inserted a personal exercise for User B.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.persist_workout_draft(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Cross-user draft', 'startedAt', now(),
      'exercises', jsonb_build_array(jsonb_build_object('exerciseId', '70000000-0000-4000-8000-000000000002'))
    ));
    raise exception 'User A used User B exercise in a draft.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.persist_workout(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Cross-user workout', 'startedAt', now(), 'completedAt', now(),
      'exercises', jsonb_build_array(jsonb_build_object(
        'exerciseId', '70000000-0000-4000-8000-000000000002',
        'sets', jsonb_build_array(jsonb_build_object('setNumber', 1, 'weight', 10, 'reps', 5))
      ))
    ));
    raise exception 'User A used User B exercise in a workout.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.persist_workout_preset(
      gen_random_uuid(), 'Cross-user preset',
      '[{"exerciseId":"70000000-0000-4000-8000-000000000002","order":1,"defaultSets":3}]'::jsonb
    );
    raise exception 'User A used User B exercise in a preset.';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.workout_exercises (workout_id, user_id, exercise_id, personal_exercise_id, exercise_order)
    values (
      '20000000-0000-4000-8000-000000000001',
      auth.uid(),
      '70000000-0000-4000-8000-000000000002',
      '70000000-0000-4000-8000-000000000002',
      2
    );
    raise exception 'User A inserted User B exercise directly into a workout.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.persist_workout_preset(
      '50000000-0000-4000-8000-000000000002',
      'cross-user update',
      '[{"exerciseId":"9","order":1,"defaultSets":3}]'::jsonb
    );
    raise exception 'User A changed User B preset.';
  exception when insufficient_privilege then null; end;
  if public.persist_workout_preset(
    '50000000-0000-4000-8000-000000000001',
    'A preset updated',
    '[{"exerciseId":"9","order":1,"defaultSets":4}]'::jsonb
  ) <> '50000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'User A cannot update own preset.';
  end if;
  begin
    perform public.persist_workout_preset(gen_random_uuid(), 'Empty preset', '[]'::jsonb);
    raise exception 'An empty preset was accepted.';
  exception when check_violation then null; end;
  for preset_index in 1..8 loop
    perform public.persist_workout_preset(
      gen_random_uuid(),
      'A cap ' || preset_index,
      '[{"exerciseId":"9","order":1,"defaultSets":3}]'::jsonb
    );
  end loop;
  if (select count(*) from public.workout_presets) <> 10 then
    raise exception 'User A preset count did not reach the maximum of 10.';
  end if;
  begin
    perform public.persist_workout_preset(
      gen_random_uuid(),
      'A preset 11',
      '[{"exerciseId":"9","order":1,"defaultSets":3}]'::jsonb
    );
    raise exception 'The database accepted an eleventh preset.';
  exception when check_violation then null; end;
  if public.delete_workout_preset('50000000-0000-4000-8000-000000000002') then
    raise exception 'User A deleted User B preset.';
  end if;
  delete from public.workouts where id = '20000000-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'User A cannot delete own workout.'; end if;
  if not public.delete_workout_preset('50000000-0000-4000-8000-000000000003') then
    raise exception 'User A cannot delete own preset.';
  end if;
end;
$$;

do $$
declare
  compatibility_id uuid;
  original_snapshot jsonb;
  weight_input text;
begin
  -- Exact old frontend shape: exercise ID/order/sets, no metadata keys.
  compatibility_id := public.persist_workout(jsonb_build_object(
    'name', 'Old frontend', 'startedAt', now() - interval '1 hour', 'completedAt', now(),
    'exercises', '[{"exerciseId":"9","order":1,"sets":[{"setNumber":1,"weight":0,"reps":0}]}]'::jsonb));
  select to_jsonb(we) - 'exercise_order' into original_snapshot
    from public.workout_exercises we where we.workout_id = compatibility_id;
  if not exists (select 1 from public.workout_exercises we where we.workout_id = compatibility_id
      and we.exercise_name is null and we.description is null
      and we.primary_muscles is null and we.secondary_muscles is null) then
    raise exception 'Old frontend created empty rather than missing snapshots.';
  end if;
  -- Database numeric input must retain the formats accepted by its original types.
  foreach weight_input in array array['.5', '1e1', ' 0 ', '0.00'] loop
    perform public.persist_workout(jsonb_build_object(
      'id', compatibility_id, 'name', 'Resave old frontend',
      'startedAt', now() - interval '1 hour', 'completedAt', now(),
      'exercises', jsonb_build_array(jsonb_build_object(
        'exerciseId', '9', 'name', 'New metadata must not overwrite history',
        'primaryMuscles', jsonb_build_array('Rug'), 'secondaryMuscles', jsonb_build_array('Biceps'),
        'description', 'Changed', 'sets', jsonb_build_array(jsonb_build_object(
          'setNumber', 1, 'weight', weight_input, 'reps', 0))))));
    if (select to_jsonb(we) - 'exercise_order' from public.workout_exercises we
        where we.workout_id = compatibility_id) is distinct from original_snapshot then
      raise exception 'Resave overwrote a legacy snapshot or exercise ID.';
    end if;
  end loop;
  foreach weight_input in array array['-1', 'NaN', 'Infinity', 'not-a-number', '1000000'] loop
    begin
      perform public.persist_workout(jsonb_build_object(
        'id', compatibility_id, 'name', 'Invalid weight',
        'startedAt', now() - interval '1 hour', 'completedAt', now(),
        'exercises', jsonb_build_array(jsonb_build_object('exerciseId', '9',
          'sets', jsonb_build_array(jsonb_build_object('setNumber', 1, 'weight', weight_input, 'reps', 8))))));
      raise exception 'Invalid weight was accepted: %', weight_input;
    exception when check_violation then null; end;
  end loop;
  delete from public.workouts where id = compatibility_id;

  -- JSON null also means absent; explicit [] secondary muscles stays intentional.
  compatibility_id := public.persist_workout(jsonb_build_object(
    'name', 'Nullable metadata', 'startedAt', now(), 'completedAt', now(),
    'exercises', '[{"exerciseId":"9","primaryMuscles":null,"secondaryMuscles":null,"sets":[{"setNumber":1,"weight":0,"reps":1}]}]'::jsonb));
  if not exists (select 1 from public.workout_exercises we where we.workout_id = compatibility_id
      and we.primary_muscles is null and we.secondary_muscles is null) then
    raise exception 'JSON-null metadata did not remain absent.';
  end if;
  delete from public.workouts where id = compatibility_id;

  -- New clients may explicitly snapshot an empty secondary list / description.
  compatibility_id := public.persist_workout(jsonb_build_object(
    'name', 'Explicit snapshot', 'startedAt', now(), 'completedAt', now(),
    'exercises', '[{"exerciseId":"9","name":"Original","primaryMuscles":["Borst"],"secondaryMuscles":[],"description":"","sets":[{"setNumber":1,"weight":20,"reps":8}]}]'::jsonb));
  select to_jsonb(we) - 'exercise_order' into original_snapshot
    from public.workout_exercises we where we.workout_id = compatibility_id;
  if not exists (select 1 from public.workout_exercises we where we.workout_id = compatibility_id
      and we.exercise_name = 'Original' and we.description = ''
      and we.primary_muscles = array['Borst'] and we.secondary_muscles = '{}') then
    raise exception 'Explicit empty snapshot values were lost.';
  end if;
  perform public.persist_workout(jsonb_build_object(
    'id', compatibility_id, 'name', 'Old client resaves newer workout', 'startedAt', now(), 'completedAt', now(),
    'exercises', '[{"exerciseId":"9","sets":[{"setNumber":1,"weight":25,"reps":8}]}]'::jsonb));
  if (select to_jsonb(we) - 'exercise_order' from public.workout_exercises we
      where we.workout_id = compatibility_id) is distinct from original_snapshot then
    raise exception 'Old client erased an existing real snapshot.';
  end if;
  delete from public.workouts where id = compatibility_id;

  -- Simulate a valid legacy row without sets; this was allowed by the old schema.
  insert into public.workouts(user_id, name, started_at, completed_at)
    values (auth.uid(), 'Legacy empty sets', now(), now()) returning id into compatibility_id;
  insert into public.workout_exercises(workout_id, user_id, exercise_id, exercise_order)
    values (compatibility_id, auth.uid(), '9', 1);
  perform public.persist_workout(jsonb_build_object(
    'id', compatibility_id, 'name', 'Resaved legacy empty sets', 'startedAt', now(), 'completedAt', now(),
    'exercises', '[{"exerciseId":"9","sets":[]}]'::jsonb));
  if not exists (select 1 from public.workout_exercises we where we.workout_id = compatibility_id) then
    raise exception 'Legacy exercise without sets was lost.';
  end if;
  delete from public.workouts where id = compatibility_id;

  -- Preserve the old bug's stored arrays too: display fallback must not mutate history.
  insert into public.workouts(user_id, name, started_at, completed_at)
    values (auth.uid(), 'Legacy empty metadata', now(), now()) returning id into compatibility_id;
  insert into public.workout_exercises(workout_id, user_id, exercise_id, exercise_order, primary_muscles, secondary_muscles)
    values (compatibility_id, auth.uid(), '9', 1, '{}', '{}');
  perform public.persist_workout(jsonb_build_object(
    'id', compatibility_id, 'name', 'Resaved empty metadata', 'startedAt', now(), 'completedAt', now(),
    'exercises', '[{"exerciseId":"9","primaryMuscles":["Borst"],"secondaryMuscles":["Triceps"],"sets":[{"setNumber":1,"weight":0,"reps":1}]}]'::jsonb));
  if not exists (select 1 from public.workout_exercises we where we.workout_id = compatibility_id
      and we.exercise_name is null and we.primary_muscles = '{}' and we.secondary_muscles = '{}') then
    raise exception 'Resave repaired stored legacy arrays instead of preserving them.';
  end if;
  delete from public.workouts where id = compatibility_id;

  -- Draft values are intentionally incomplete strings, not completed set results.
  perform public.persist_workout_draft(jsonb_build_object(
    'id', '80000000-0000-4000-8000-000000000009', 'name', 'Incomplete draft', 'startedAt', now(),
    'exercises', '[{"exerciseId":"9","sets":[{"id":"draft-set","weight":"","reps":""}]}]'::jsonb));
  if not exists (select 1 from public.workout_drafts wd
      where wd.id = '80000000-0000-4000-8000-000000000009'
        and wd.draft_data -> 'exercises' -> 0 -> 'sets' -> 0 ->> 'weight' = '') then
    raise exception 'Incomplete draft set did not survive.';
  end if;
  delete from public.workout_drafts where id = '80000000-0000-4000-8000-000000000009';
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
declare affected integer; preset_index integer;
begin
  insert into public.workouts (id, user_id, name, started_at, completed_at)
  values ('20000000-0000-4000-8000-000000000004', auth.uid(), 'B own insert', now() - interval '1 hour', now());
  perform public.persist_workout_preset(
    '50000000-0000-4000-8000-000000000004',
    'B own insert',
    '[{"exerciseId":"9","order":1,"defaultSets":3}]'::jsonb
  );
  if (select count(*) from public.workouts) <> 2 or exists (select 1 from public.workouts where id = '20000000-0000-4000-8000-000000000001') then
    raise exception 'User B can read another user workout or cannot read own.';
  end if;
  update public.workouts set name = 'B workout updated' where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'User B cannot update own workout.'; end if;
  update public.workouts set name = 'stolen' where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User B updated User A workout.'; end if;
  delete from public.workouts where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User B deleted User A workout.'; end if;
  if (select count(*) from public.workout_exercises) <> 1 or (select count(*) from public.workout_sets) <> 1 then
    raise exception 'User B can read another user workout children.';
  end if;
  if (select count(*) from public.workout_presets) <> 2 or (select count(*) from public.preset_exercises) <> 2 then
    raise exception 'User B can read another user preset data.';
  end if;
  if (select count(*) from public.personal_exercises) <> 1
    or not exists (select 1 from public.personal_exercises where id = '70000000-0000-4000-8000-000000000002') then
    raise exception 'User B cannot read own personal exercise or can read another user exercise.';
  end if;
  update public.personal_exercises set name = 'stolen'
  where id = '70000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User B updated User A personal exercise.'; end if;
  delete from public.personal_exercises where id = '70000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User B deleted User A personal exercise.'; end if;
  begin
    perform public.persist_workout_draft(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Cross-user draft', 'startedAt', now(),
      'exercises', jsonb_build_array(jsonb_build_object('exerciseId', '70000000-0000-4000-8000-000000000001'))
    ));
    raise exception 'User B used User A exercise in a draft.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.persist_workout(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Cross-user workout', 'startedAt', now(), 'completedAt', now(),
      'exercises', jsonb_build_array(jsonb_build_object(
        'exerciseId', '70000000-0000-4000-8000-000000000001',
        'sets', jsonb_build_array(jsonb_build_object('setNumber', 1, 'weight', 10, 'reps', 5))
      ))
    ));
    raise exception 'User B used User A exercise in a workout.';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.workout_exercises (workout_id, user_id, exercise_id, personal_exercise_id, exercise_order)
    values (
      '20000000-0000-4000-8000-000000000002',
      auth.uid(),
      '70000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000001',
      2
    );
    raise exception 'User B inserted User A exercise directly into a workout.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.persist_workout_preset(
      gen_random_uuid(), 'Cross-user preset',
      '[{"exerciseId":"70000000-0000-4000-8000-000000000001","order":1,"defaultSets":3}]'::jsonb
    );
    raise exception 'User B used User A exercise in a preset.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.persist_workout_preset(
      '50000000-0000-4000-8000-000000000001',
      'stolen',
      '[{"exerciseId":"9","order":1,"defaultSets":3}]'::jsonb
    );
    raise exception 'User B updated User A preset.';
  exception when insufficient_privilege then null; end;
  if public.delete_workout_preset('50000000-0000-4000-8000-000000000001') then
    raise exception 'User B deleted User A preset.';
  end if;
  if public.persist_workout_preset(
    '50000000-0000-4000-8000-000000000002',
    'B preset updated',
    '[{"exerciseId":"9","order":1,"defaultSets":4}]'::jsonb
  ) <> '50000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'User B cannot update own preset.';
  end if;
  delete from public.workouts where id = '20000000-0000-4000-8000-000000000004';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'User B cannot delete own workout.'; end if;
  if not public.delete_workout_preset('50000000-0000-4000-8000-000000000004') then
    raise exception 'User B cannot delete own preset.';
  end if;
end;
$$;

reset role;
-- Clear both claim formats: RESET ROLE alone retains the previous user ID.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
do $$
begin
  if auth.uid() is not null then
    raise exception 'Anonymous test still has an authenticated user ID.';
  end if;
  begin perform public.persist_workout('{"name":"anon","startedAt":"2026-10-01T10:00:00Z","completedAt":"2026-10-01T11:00:00Z","exercises":[{"exerciseId":"9","sets":[{"setNumber":1,"weight":0,"reps":1}]}]}'::jsonb);
    raise exception 'Anonymous workout RPC unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin perform public.persist_workout_draft('{"name":"anon","startedAt":"2026-10-01T10:00:00Z","exercises":[]}'::jsonb);
    raise exception 'Anonymous draft RPC unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin perform public.delete_workout_preset('50000000-0000-4000-8000-000000000001');
    raise exception 'Anonymous delete preset RPC unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'select * from public.workout_drafts'; raise exception 'Anonymous SELECT drafts unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'select * from public.workouts'; raise exception 'Anonymous SELECT workouts unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'insert into public.workouts (user_id, name, started_at, completed_at) values (''10000000-0000-4000-8000-000000000001'', ''anon'', now(), now())'; raise exception 'Anonymous INSERT workout unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'update public.workouts set name = ''anon'''; raise exception 'Anonymous UPDATE workouts unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'delete from public.workouts'; raise exception 'Anonymous DELETE workouts unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'select * from public.workout_presets'; raise exception 'Anonymous SELECT presets unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'insert into public.workout_presets (user_id, name) values (''10000000-0000-4000-8000-000000000001'', ''anon'')'; raise exception 'Anonymous INSERT preset unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'update public.workout_presets set name = ''anon'''; raise exception 'Anonymous UPDATE presets unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'delete from public.workout_presets'; raise exception 'Anonymous DELETE presets unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'select public.persist_workout_preset(null, ''anon'', ''[{"exerciseId":"9","order":1,"defaultSets":3}]''::jsonb)'; raise exception 'Anonymous preset RPC unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'select * from public.personal_exercises'; raise exception 'Anonymous SELECT personal exercises unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'insert into public.personal_exercises (user_id, name, primary_muscles) values (''10000000-0000-4000-8000-000000000001'', ''anon'', array[''Borst''])'; raise exception 'Anonymous INSERT personal exercise unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'update public.personal_exercises set name = ''anon'''; raise exception 'Anonymous UPDATE personal exercises unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
  begin execute 'delete from public.personal_exercises'; raise exception 'Anonymous DELETE personal exercises unexpectedly succeeded.';
  exception when insufficient_privilege then null; end;
end;
$$;

rollback;
