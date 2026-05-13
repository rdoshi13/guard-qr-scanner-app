create table if not exists public.patrol_hour_records (
  record_id text primary key,
  date_key text not null,
  hour_start integer not null check (hour_start between 0 and 23),
  hour_window text not null,
  society_id text not null default 'vihav_trade_center',
  society text not null,
  guard_id text not null,
  guard_name text not null,
  status text not null check (status in ('IN_PROGRESS', 'COMPLETED', 'MISSED')),
  completed_count integer not null default 0,
  total_points integer not null default 10,
  points_scanned text[] not null default array[]::text[],
  scans jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  finalized_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists patrol_hour_records_date_hour_idx
  on public.patrol_hour_records (society_id, date_key, hour_start);

create index if not exists patrol_hour_records_guard_idx
  on public.patrol_hour_records (society_id, guard_id, date_key);

alter table public.patrol_hour_records enable row level security;

create policy "Allow app insert patrol records"
  on public.patrol_hour_records
  for insert
  with check (true);

create policy "Allow app update patrol records"
  on public.patrol_hour_records
  for update
  using (true)
  with check (true);

create policy "Allow app read patrol records"
  on public.patrol_hour_records
  for select
  using (true);
