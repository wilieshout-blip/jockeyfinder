# Feature improvements — "how to make each go further"

Every backlog feature is built. This is the next-level thinking: concrete,
prioritised ways to push each one further. 🟢 = cheap/safe to build now ·
🟡 = bigger build · 🔵 = needs an external input (data/credential).

---

## S.O.S. ride-vacancy beacon
- 🟢 **Targeting filters** — let the trainer cap the blast by weight range or
  apprentice claim so only suitable riders are pinged.
- 🟢 **One-tap "I'll take it"** — an accept link in the email/SMS that pre-fills a
  ride request back to the trainer, instead of "open the app".
- 🟡 **Cool-down + receipts** — show the trainer who was alerted and who responded,
  and stop re-blasting the same race within X minutes.
- 🔵 **True on-course presence** — a "check in at the track" button (or geofence)
  to replace "marked attending" as the on-course signal.

## Black-book tracker
- 🟢 **Proactive ping** — email/notify the jockey when a black-booked horse is
  newly nominated (today it only shows in "racing soon" when they visit).
- 🟢 **Notes + tags** — a private note per horse ("good fresh", "hates the rail").
- 🟡 **Auto-suggest** — seed the black book from horses the jockey has actually
  ridden (needs results history, which the results sync unlocks).

## Preferred-rider shortlists
- 🟢 **Quick-request from the star** — request a shortlisted rider in one tap from
  the meeting page.
- 🟢 **Availability glance** — show each preferred rider's declared weight +
  whether they've marked attendance at the open meeting.

## Syndicate hub
- 🟢 **Update reactions / read receipts** — managers see who's seen an update.
- 🟡 **Share splits** — structured percentages instead of free-text, with a
  prize-money split calculator.
- 🟡 **Member self-serve** — members confirm their own invite + manage their email
  prefs (today the manager adds them).

## Silk previewer
- 🔵 **Capture silk descriptions** in the entries scraper (one HTML-field map) so
  silks actually render on the race card.
- 🟡 **Better renderer** — support quartered/diamonds/striped-sleeves/checked and
  a small library of cap badges for a closer likeness.

## Audio notes
- 🟢 **Auto-expiry** — delete clips N days after the meeting to keep storage lean.
- 🟡 **Transcripts** — a speech-to-text summary line so trainers can skim without
  listening.

## Owner staking/nomination alerts
- 🟢 **Feature-race emphasis** — louder alert styling + "Black-type runner" badge
  when the race is Group/Listed.
- 🟢 **Digest option** — owners can choose one daily digest instead of per-booking.

## Medical stand-down tracker
- 🟢 **Auto-hold the profile** — flip the jockey to a "On hold" badge for the
  affected window (not just email the trainers).
- 🟡 **Suggest replacements** — alongside the alert, list attending unbooked riders
  for the affected race (reuses the S.O.S. targeting query).
- 🔵 **Judicial scrubber** — nightly scrape of NZTR judicial reports into the
  admin review queue (needs a reliable judicial source).

## Geographical feasibility
- 🟢 **Use race times** — compare the first race at track B vs last at track A to
  judge feasibility precisely, not just distance.
- 🟡 **Jockey-facing nudge** — warn the rider at the moment they mark the second
  clashing meeting, not just the admin.

## Gap finder
- 🔵 **Live scratchings** — capture `scratched` in the sync (one HTML-field map);
  then 🟢 email the freed rider + their agent and surface them on the trainer
  directory, not just their own meeting view.

## Apprentice claim
- 🔵 **Auto-flag at milestones** — once results sync, flag (don't auto-change) when
  a claimer nears 10/30/80 wins for one-click admin downgrade.

## SMS gateway
- 🔵 **Add Twilio creds** to switch on every SMS path (request fallback, S.O.S.,
  scratching alerts).
- 🟢 **Opt-in + STOP handling** — capture SMS consent and honour replies.

## Stable seats
- 🟡 **Write access** — let assistants *create/act on* ride requests for the head
  (today it's read-only sharing).
- 🔵 **Single billing seat** — when Stripe is live, members ride on the head's
  subscription.

## Weight check
- 🟡 **Per-jockey band** — base the typo thresholds on each rider's own history/
  average rather than a fixed 30–75kg.

## Cross-cutting
- 🟡 **Push notifications (PWA)** — installable app + web push for instant alerts
  without SMS costs.
- 🟢 **Notification centre** — an in-app bell with a history of every alert.

---

### Suggested first wave (all 🟢, no external input)
1. Black-book proactive ping. 2. S.O.S. one-tap accept + targeting filters.
3. Stand-down auto-hold badge. 4. Owner alert feature-race emphasis + digest.
5. In-app notification centre.

Tell me which to start and I'll build it.
