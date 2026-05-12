alter table public.patrol_hour_records
  add column if not exists society_id text not null default 'vihav_trade_center';

update public.patrol_hour_records
set society_id = 'vihav_trade_center'
where society_id is null or society_id = '';

drop index if exists patrol_hour_records_date_hour_idx;
drop index if exists patrol_hour_records_guard_idx;

create index if not exists patrol_hour_records_date_hour_idx
  on public.patrol_hour_records (society_id, date_key, hour_start);

create index if not exists patrol_hour_records_guard_idx
  on public.patrol_hour_records (society_id, guard_id, date_key);
