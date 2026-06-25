-- Black-type level of a race, parsed from the race title by the sync.
-- 'G1' | 'G2' | 'G3' | 'Listed'  (null = ordinary race). Used to mark a meeting
-- as "premier" when it contains a Group/Listed race.
alter table public.races
  add column if not exists group_level text;

create index if not exists idx_races_group_level on public.races (nztr_day_id)
  where group_level is not null;
