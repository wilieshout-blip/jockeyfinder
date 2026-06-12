# JockeyFinder

The booking layer for New Zealand thoroughbred racing. Trainers see which jockeys are riding at every meeting, jockeys publish their calendars and weights, and ride requests turn into confirmed bookings with built in chat.

Live target: www.jockeyfinder.com

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS, Space Grotesk and Inter |
| Auth, database, storage, realtime | Supabase |
| Payments | Stripe subscriptions |
| Race calendar | LoveRacing NZ public calendar endpoint |
| Hosting | Vercel |

## Who gets what

| Role | Price | Verification |
| --- | --- | --- |
| Jockey | $40 NZD per month after a 100 day free trial | Manual admin approval. Hidden from public pages until approved |
| Trainer | Free | Automatic when their phone matches the NZTR registry |
| Owner | Free, view only | Automatic |
| Agent | Price agreed per deal | Registry match is flagged, admin still approves and marks paid |

The admin account is whoever signs up with the email in `ADMIN_EMAIL`. That account skips verification, gets the Admin link in the sidebar and can approve people, mark agents paid and sync the calendar.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

## 1. Supabase setup

Already done. The live project is `jockeyfinder-prod` (ref `dlqtdflylyknjtpwzedn`, Sydney region) and the app code is pre wired to it, so the first deploy needs zero Supabase configuration. The schema, security hardening, storage bucket, realtime and demo registry rows are all applied.

Two things remain, both in the Supabase dashboard:

1. Import the real NZTR people registry: Table Editor, `nztr_people_registry`, Import data from CSV. Map columns to `role`, `full_name`, `phone`. The `phone_normalized` column fills itself. Five clearly fake demo rows are in there now (phones like 021 000 0001), delete them whenever.
2. Authentication, URL Configuration: set Site URL to your domain and add `https://yourdomain.com/auth/callback` to the redirect list (plus `http://localhost:3000/auth/callback` while developing). Until this is set, signup confirmation emails will link to localhost.

If you ever rebuild from scratch, `supabase/schema.sql` is the complete database and `supabase/seed.sql` the demo rows.

### Why the schema is shaped the way it is

Self service verification is blocked at the database. A trigger on `profiles` resets `verified`, `verification_status`, `status`, `role` and `registry_match` on any update that does not come from the service role or the admin, so even a hand crafted API call cannot fake approval. Public pages never read the `profiles` table directly, they read the `public_profiles` and `public_meeting_attendance` views, which only publish approved people and safe columns. Attendance rows snapshot the jockey's weight and claim at the moment they tick a meeting, so race day lists do not drift when profiles change later.

## 2. Stripe setup

1. Create a product called JockeyFinder Jockey with a recurring price of $40 NZD per month. Copy the price id into `STRIPE_PRICE_ID_JOCKEY`.
2. Do not add a trial on the price itself. The checkout session applies the 100 day trial in code, so the number lives in one place (`JOCKEY_TRIAL_DAYS` in `lib/stripe.ts`).
3. Add a webhook endpoint pointing at `https://yourdomain.com/api/stripe/webhook` listening for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

For local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Agents do not go through checkout. Agree the price off platform, then hit Mark paid on their card in the admin console, which writes an active `agent_custom` subscription row.

## 3. Environment variables

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Optional, the live value is committed as a fallback in `lib/supabase/config.ts` because it is public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. Optional for the same reason |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key, server only, never exposed to the browser |
| `ADMIN_EMAIL` | The admin login email |
| `NEXT_PUBLIC_SITE_URL` | Full site URL, no trailing slash |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PRICE_ID_JOCKEY` | Price id for the $40 NZD monthly plan |
| `CRON_SECRET` | Random string that authorises the daily calendar sync |

## 4. Race calendar sync

Meetings come from the LoveRacing NZ calendar endpoint and upsert on `nztr_day_id`, so re-running is always safe. Three ways to trigger it:

1. Admin console, Sync meetings now button.
2. Vercel cron, already configured in `vercel.json` to call `GET /api/loveracing/sync` daily. Set `CRON_SECRET` in Vercel and the cron sends it automatically as a bearer token.
3. Manually: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/loveracing/sync`

## 5. Deploy to Vercel and point the domain

1. Push the repo to GitHub, import it in Vercel, add every environment variable, deploy.
2. In Vercel, Settings, Domains, add `jockeyfinder.com` and `www.jockeyfinder.com`.
3. In GoDaddy DNS:
   - A record, host `@`, value `76.76.21.21`
   - CNAME, host `www`, value `cname.vercel-dns.com`
4. Set `NEXT_PUBLIC_SITE_URL` to `https://www.jockeyfinder.com`, update the Stripe webhook URL and the Supabase redirect URLs to match, redeploy.

## Project structure

```
app/
  (public)/        landing, meetings, jockeys, trainers, login, signup
  dashboard/       profile, calendar, requests, messages, billing, agent tools
  admin/           approvals, stats, calendar sync
  api/             stripe checkout and webhook, loveracing sync
  auth/            email confirm callback, signout
components/        design system and racing specific pieces
lib/               supabase clients, stripe, loveracing sync, helpers
supabase/          schema.sql, seed.sql
public/brand/      logo marks and lockups
```

## Built now vs next

Built: public meeting calendar with attending jockeys, jockey and trainer directories, role based signup with registry auto verification, jockey availability calendar with weight snapshots, agent managed jockeys, ride requests with accept, decline, assign, realtime chat created on assignment, Stripe billing with the 100 day trial, admin console, daily calendar sync.

Next: race level sync and per race booking, owner horse linking, automatic meeting group chats 24 hours before race day, AI licence document pre check on signup, enforcing the jockey paywall when the trial lapses (the status is already tracked in `subscriptions`, the gate just needs flipping on).

## Security notes

The service role key is only ever used in server code: API routes, server actions and the sync job. Self verification is blocked by a database trigger, not by UI. Anonymous visitors only see data through the two public views. Storage uploads are locked to each user's own folder inside the avatars bucket.
