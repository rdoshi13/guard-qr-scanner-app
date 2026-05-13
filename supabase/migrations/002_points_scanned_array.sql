do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patrol_hour_records'
      and column_name = 'points_scanned'
      and data_type = 'text'
  ) then
    alter table public.patrol_hour_records
      alter column points_scanned drop default;

    alter table public.patrol_hour_records
      alter column points_scanned type text[]
      using case
        when points_scanned is null or trim(points_scanned) = ''
          then array[]::text[]
        else string_to_array(points_scanned, ',')
      end;

    alter table public.patrol_hour_records
      alter column points_scanned set default array[]::text[];
  end if;
end $$;

alter table public.patrol_hour_records
  alter column points_scanned set not null;
