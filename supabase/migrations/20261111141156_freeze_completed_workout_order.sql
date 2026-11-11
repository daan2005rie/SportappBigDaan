-- Additive protection only: existing workout/exercise/set rows are not rewritten.
-- Apply in a transaction after 20261018000000_private_personal_exercises.sql.
set local lock_timeout = '5s';
lock table public.workouts, public.workout_exercises in share row exclusive mode;

create schema if not exists sportapp_private;
revoke all on schema sportapp_private from public, anon, authenticated;

create table sportapp_private.completed_workout_order (
  workout_id uuid primary key references public.workouts(id) on delete cascade,
  exercise_ids text[] not null
);
alter table sportapp_private.completed_workout_order enable row level security;
revoke all on table sportapp_private.completed_workout_order from public, anon, authenticated;

-- Record the current relative order without modifying original records/timestamps.
insert into sportapp_private.completed_workout_order (workout_id, exercise_ids)
select w.id, coalesce(array_agg(we.exercise_id order by we.exercise_order)
  filter (where we.id is not null), '{}'::text[])
from public.workouts w left join public.workout_exercises we on we.workout_id = w.id
group by w.id;

create function sportapp_private.enforce_completed_workout_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_workout_id uuid := case when tg_op = 'DELETE' then old.workout_id else new.workout_id end;
  v_owner uuid;
  v_ids text[];
  v_saved_ids text[];
begin
  -- Serialize checks for the same parent, including direct table writes.
  select w.user_id into v_owner from public.workouts w where w.id = v_workout_id for update;
  if not found then return null; end if; -- Full workout deletion still cascades normally.
  if auth.uid() is not null and auth.uid() is distinct from v_owner then
    raise exception 'Workout is unavailable.' using errcode = '42501';
  end if;
  select coalesce(array_agg(we.exercise_id order by we.exercise_order), '{}'::text[])
    into v_ids from public.workout_exercises we where we.workout_id = v_workout_id;
  -- New completions freeze their final order at transaction end. Existing
  -- completions already have a protected baseline from the seed above.
  insert into sportapp_private.completed_workout_order (workout_id, exercise_ids)
    values (v_workout_id, v_ids) on conflict (workout_id) do nothing;
  select exercise_ids into v_saved_ids from sportapp_private.completed_workout_order
    where workout_id = v_workout_id;
  if v_ids is distinct from v_saved_ids then
    raise exception 'The exercise order of a completed workout is immutable.' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function sportapp_private.enforce_completed_workout_order() from public, anon, authenticated;

-- Deferred: the existing RPC temporarily shifts order numbers during a resave.
-- Validate its final result, so same-order resaves and snapshots remain compatible.
create constraint trigger completed_workout_order_immutable
  after insert or update or delete on public.workout_exercises
  deferrable initially deferred for each row
  execute function sportapp_private.enforce_completed_workout_order();

create function public.reject_completed_workout_draft()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if exists (select 1 from public.workouts w where w.id = new.id and w.user_id = auth.uid()) then
    raise exception 'A completed workout cannot become an active draft.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_completed_workout_draft() from public, anon, authenticated;
create trigger workout_drafts_reject_completed before insert or update on public.workout_drafts
  for each row execute function public.reject_completed_workout_draft();
