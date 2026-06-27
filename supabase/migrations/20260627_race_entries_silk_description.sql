-- Free-text racing-silk description from the race card (e.g. "Cambridge blue,
-- black V, white sleeves"). Rendered by components/silk-preview.tsx. Captured by
-- the entries scraper once the source HTML field is mapped.
alter table public.race_entries
  add column if not exists silk_description text;
