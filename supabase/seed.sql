-- ============================================================
-- JockeyFinder sample seed data
-- Optional. Run after schema.sql if you want test registry rows
-- before importing the real NZTR CSV.
--
-- These phone numbers are obviously fake. Any trainer who signs
-- up with one of them will auto verify, which makes the flow
-- easy to demo.
-- ============================================================

insert into public.nztr_people_registry (role, full_name, phone) values
  ('trainer', 'Test Trainer One',   '021 000 0001'),
  ('trainer', 'Test Trainer Two',   '+64 21 000 0002'),
  ('trainer', 'Test Trainer Three', '0064210000003'),
  ('agent',   'Test Agent One',     '021 000 0101'),
  ('agent',   'Test Agent Two',     '+64 21 000 0102')
on conflict (role, phone_normalized) do nothing;

-- ------------------------------------------------------------
-- Importing the real registry
-- ------------------------------------------------------------
-- 1. In the Supabase dashboard open Table Editor,
--    pick nztr_people_registry, then Insert > Import data from CSV.
-- 2. Map your CSV columns to: role, full_name, phone.
--    Leave phone_normalized blank, a trigger fills it.
-- 3. role must be exactly trainer, agent or jockey (lowercase).
-- 4. Duplicate role plus phone combinations are rejected by a
--    unique constraint, so re-imports are safe.
