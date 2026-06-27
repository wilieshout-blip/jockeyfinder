-- Tracks when the SMS fallback reminder was sent for an unanswered request,
-- so the fallback script (scripts/sms-fallback.mjs) never double-texts.
alter table public.ride_requests
  add column if not exists sms_reminded_at timestamptz;
