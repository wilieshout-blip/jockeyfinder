-- Supabase Auth expects these token columns to contain strings, not NULL.
-- NULL values cause password sign-in and admin user queries to fail with:
-- "Database error querying schema".
--
-- Safe to run repeatedly. The handle_new_user function in schema.sql also
-- normalizes these fields for newly inserted users.
update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  recovery_token = coalesce(recovery_token, '')
where
  confirmation_token is null
  or email_change is null
  or email_change_token_new is null
  or recovery_token is null;
