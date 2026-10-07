-- Run after migrations in the Supabase SQL Editor or psql as a database administrator.
-- Fixtures and assertions are rolled back at the end.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-user-a@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-user-b@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

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

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
declare affected integer;
begin
  insert into public.workouts (id, user_id, name, started_at, completed_at)
  values ('20000000-0000-4000-8000-000000000003', auth.uid(), 'A own insert', now() - interval '1 hour', now());
  perform public.persist_workout_preset(
    '50000000-0000-4000-8000-000000000003',
    'A own insert',
    '[{"exerciseId":"9","order":1,"defaultSets":3}]'::jsonb
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
  if (select count(*) from public.workout_presets) <> 2 or (select count(*) from public.preset_exercises) <> 2 then
    raise exception 'User A can read another user preset data.';
  end if;
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
set local role anon;
do $$
begin
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
end;
$$;

rollback;
