-- LOCAL TEST DATABASE ONLY. Synthetic users/data; every change is rolled back.
-- Apply all migrations first. Flush deferred constraints to simulate RPC commits.
begin;
insert into auth.users (id, aud, role, email) values
 ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'order-test@example.invalid');
set local role authenticated;
set local request.jwt.claim.sub = '91000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';

select public.persist_workout_draft('{"id":"92000000-0000-4000-8000-000000000001","name":"Order test","startedAt":"2026-11-11T10:00:00Z","exercises":[{"id":"one","exerciseId":"9","sets":[{"id":"set-one","weight":"50","reps":"8"}]},{"id":"two","exerciseId":"10","sets":[{"id":"set-two","weight":"60","reps":"6"}]}]}');
select public.persist_workout_draft('{"id":"92000000-0000-4000-8000-000000000001","name":"Order test","startedAt":"2026-11-11T10:00:00Z","exercises":[{"id":"two","exerciseId":"10","sets":[{"id":"set-two","weight":"60","reps":"6"}]},{"id":"one","exerciseId":"9","sets":[{"id":"set-one","weight":"50","reps":"8"}]}]}');
do $$ begin
 if not exists (select 1 from public.workout_drafts where id='92000000-0000-4000-8000-000000000001'
   and draft_data #>> '{exercises,0,id}'='two' and draft_data #>> '{exercises,0,sets,0,weight}'='60'
   and draft_data #>> '{exercises,1,sets,0,id}'='set-one') then raise exception 'Draft order/data lost'; end if;
end $$;
select public.persist_workout('{"id":"92000000-0000-4000-8000-000000000001","name":"Order test","startedAt":"2026-11-11T10:00:00Z","completedAt":"2026-11-11T11:00:00Z","exercises":[{"exerciseId":"10","name":"Ten","description":"Original snapshot","sets":[{"setNumber":1,"weight":60,"reps":6}]},{"exerciseId":"9","name":"Nine","sets":[{"setNumber":1,"weight":50,"reps":8}]}]}');
set constraints all immediate;
set constraints all deferred;

do $$
declare payload jsonb := '{"id":"92000000-0000-4000-8000-000000000001","name":"Order test","startedAt":"2026-11-11T10:00:00Z","completedAt":"2026-11-11T11:00:00Z","exercises":[{"exerciseId":"10","name":"Changed name","sets":[{"setNumber":1,"weight":60,"reps":6}]},{"exerciseId":"9","sets":[{"setNumber":1,"weight":50,"reps":8}]}]}'::jsonb;
begin
 if exists (select 1 from public.workout_drafts where id='92000000-0000-4000-8000-000000000001') then raise exception 'Completed draft retained'; end if;
 -- Same-order historical resaves still work with the existing RPC.
 perform public.persist_workout(payload);
 set constraints all immediate;
 set constraints all deferred;
 begin
   perform public.persist_workout(payload || jsonb_build_object('exercises', jsonb_build_array(payload->'exercises'->1, payload->'exercises'->0)));
   set constraints all immediate;
   raise exception 'Historical RPC reorder accepted';
 exception when check_violation then null; end;
 begin
   update public.workout_exercises set exercise_order=exercise_order+10 where workout_id='92000000-0000-4000-8000-000000000001';
   update public.workout_exercises set exercise_order=case exercise_id when '9' then 1 else 2 end where workout_id='92000000-0000-4000-8000-000000000001';
   set constraints all immediate;
   raise exception 'Direct historical reorder accepted';
 exception when check_violation then null; end;
 begin
   delete from public.workout_exercises where workout_id='92000000-0000-4000-8000-000000000001' and exercise_id='9';
   set constraints all immediate;
   raise exception 'Historical exercise removal accepted';
 exception when check_violation then null; end;
 begin
   delete from public.workout_exercises where workout_id='92000000-0000-4000-8000-000000000001';
   insert into public.workout_exercises(workout_id,user_id,exercise_id,exercise_order) values
    ('92000000-0000-4000-8000-000000000001', auth.uid(),'9',1),
    ('92000000-0000-4000-8000-000000000001', auth.uid(),'10',2);
   set constraints all immediate;
   raise exception 'Delete/reinsert historical reorder accepted';
 exception when check_violation then null; end;
 begin
   insert into public.workout_exercises(workout_id,user_id,exercise_id,exercise_order) values
    ('92000000-0000-4000-8000-000000000001', auth.uid(),'11',3);
   set constraints all immediate;
   raise exception 'Historical exercise addition accepted';
 exception when check_violation then null; end;
 begin
   perform public.persist_workout_draft(payload);
   raise exception 'Completed workout reopened as draft';
 exception when check_violation then null; end;
 if (select array_agg(exercise_id order by exercise_order) from public.workout_exercises where workout_id='92000000-0000-4000-8000-000000000001') <> array['10','9'] then raise exception 'Final order changed'; end if;
 if not exists (select 1 from public.workout_exercises where workout_id='92000000-0000-4000-8000-000000000001' and exercise_id='10' and exercise_name='Ten' and description='Original snapshot') then raise exception 'Snapshot changed'; end if;
 if (select count(*) from public.workout_sets s join public.workout_exercises e on e.id=s.workout_exercise_id where e.workout_id='92000000-0000-4000-8000-000000000001') <> 2 then raise exception 'Sets lost'; end if;
 if has_schema_privilege('authenticated','sportapp_private','USAGE') or has_schema_privilege('anon','sportapp_private','USAGE') then raise exception 'Private schema exposed'; end if;
 -- Deleting an entire workout remains supported (cascade).
 delete from public.workouts where id='92000000-0000-4000-8000-000000000001';
 set constraints all immediate;
end $$;
rollback;
