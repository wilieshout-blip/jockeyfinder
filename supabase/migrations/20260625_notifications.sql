-- User-toggleable email preferences (default on, opt-out model).
alter table public.profiles
  add column if not exists email_notify_messages boolean not null default true,
  add column if not exists email_notify_marketing boolean not null default true;

-- Per-participant throttle so an active chat doesn't spam the recipient's inbox.
alter table public.chat_participants
  add column if not exists last_emailed_at timestamptz;

-- Shared secret for the message notification hook (mirrors signup_hook_secret).
insert into public.app_config (key, value)
values (
  'message_hook_secret',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
on conflict (key) do nothing;

-- AFTER INSERT on messages -> pg_net -> /api/notify/new-message (mirrors the
-- new-signup hook). Never blocks the message insert if the call fails.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
begin
  select value into v_secret from public.app_config where key = 'message_hook_secret';
  perform net.http_post(
    url := 'https://www.jockeyfinder.com/api/notify/new-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );
  return NEW;
exception when others then
  return NEW;
end;
$$;

revoke execute on function public.notify_new_message() from public, anon, authenticated;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();
