create table if not exists trip_progress (
  trip_id    text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table trip_progress enable row level security;
drop policy if exists anon_rw on trip_progress;
create policy anon_rw on trip_progress for all to anon using (true) with check (true);
-- This table must never hold anything but checkmark timestamps. The anon key is public.
