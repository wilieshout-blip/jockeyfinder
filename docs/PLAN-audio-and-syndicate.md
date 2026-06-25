# Plan: Audio notes + Syndicate/ownership data model

Status: **proposal — awaiting approval. No DB or code changes made yet.**

These are the two "invest in" items from ROADMAP.md §7. Both are bigger than a
single pass, so this doc lays out the schema, storage, RLS and UI before we build.

---

## A. Pre/post-race audio notes

**Goal:** a jockey records a short voice note (pre-race plan, post-race debrief)
that the trainer (and optionally owners) on that booking can play back.

### Storage
- New **private** Supabase Storage bucket `voice-notes` (not public).
- Path convention: `voice-notes/<thread_id>/<note_id>.webm`.
- Free plan gives 1 GB; a 45s Opus clip is ~150 KB, so ~6,500 notes per GB. Cap
  clips at **60s** and reject larger uploads client- and server-side.

### Table `public.voice_notes`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| thread_id | uuid → chat_threads | the ride/booking thread it belongs to |
| sender_id | uuid → profiles | who recorded it |
| kind | text | `pre_race` \| `post_race` \| `note` |
| audio_path | text | storage object path |
| duration_s | int | for the player UI |
| created_at | timestamptz | |

Attaching to the **ride chat thread** reuses the existing participant model
(trainer + jockey + agent already in `chat_participants`), so permissions and
"who can hear it" fall out of existing infra — no new sharing rules to invent.

### RLS
- `voice_notes` SELECT/INSERT: `is_thread_participant(thread_id)` (helper already
  exists). INSERT also requires `sender_id = auth.uid()`.
- Storage policies on `voice-notes`: a user may read/write an object only if they
  participate in the `thread_id` encoded in the path (policy via `storage.foldername`).

### UI
- In the ride thread (`/dashboard/messages/[threadId]`): a record button using the
  browser **MediaRecorder API** (Opus/webm), live timer, 60s cap, preview, then
  upload to storage + insert row. An inline `<audio>` player for each note.
- Optional later: surface the latest pre-race note on the meeting page for the
  trainer.

### Decisions needed from you
1. **Who can listen** — trainer only, or trainer + linked owners? (Default: all
   thread participants = trainer + jockey + agent.)
2. **Where to record** — only inside an assigned ride chat (simplest), or also a
   standalone "leave a note" entry point? (Default: ride chat only for v1.)
3. **Retention** — keep forever, or auto-delete after the meeting + N days?

### Phasing
- **Phase 1:** bucket + table + RLS + record/playback inside ride threads.
- **Phase 2:** email/notify participants when a note is posted (reuse the new
  message-notify hook); surface pre-race note on the meeting page.

---

## B. Syndicate / structured ownership model

**Goal:** replace free-text `owner_text` (off race cards) with a real ownership
structure so a syndicate manager can broadcast one update to all micro-owners,
and owners get alerts when a jockey is assigned to their horse.

### Today
We only have `owner_text` strings on `race_entries` and `owner_horse_links`
(a profile ↔ horse link). There's no concept of a group/syndicate or shares.

### New tables
**`ownership_groups`** — a syndicate/partnership/stable-ownership entity.
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | e.g. "Phar Lap Syndicate" |
| manager_id | uuid → profiles | the owner who manages it |
| created_at | timestamptz | |

**`ownership_memberships`** — micro-owners in a group.
| column | type | notes |
|---|---|---|
| group_id | uuid → ownership_groups | |
| user_id | uuid → profiles | the member (nullable until they sign up — see below) |
| invite_email | text | for members not yet on the app |
| share_label | text | free text e.g. "5%" (percentages optional for v1) |
| role | text | `manager` \| `member` |
| primary key | (group_id, user_id) / (group_id, invite_email) | |

**`group_horses`** — which horses a group owns.
| column | type | notes |
|---|---|---|
| group_id | uuid → ownership_groups | |
| horse_id | uuid → horses | |

**`syndicate_updates`** — manager broadcasts.
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| group_id | uuid → ownership_groups | |
| author_id | uuid → profiles | |
| body | text | |
| created_at | timestamptz | |

### RLS
- `ownership_groups`: manager (manager_id = auth.uid()) manages; members read.
- `ownership_memberships`: manager manages rows; a member reads their own group's
  membership; insert by manager.
- `group_horses`: manager manages; members read.
- `syndicate_updates`: manager inserts; members of the group read.

### Notifications (reuse existing email infra)
- **Syndicate broadcast:** manager posts a `syndicate_updates` row → trigger →
  `/api/notify/syndicate-update` emails all members (respecting marketing pref).
- **Micro-owner alert:** when a ride is assigned on a horse in `group_horses`,
  email the group's members ("a jockey was booked on <horse>").

### UI
- Owner dashboard: "My syndicates" — managers can create a group, add horses
  (from the existing horse registry), invite members (by email), and post updates.
- Members see group updates + their horses.

### Decisions needed from you
1. **Shares** — do we need real percentages/units now, or is a free-text
   share_label ("1/10 share") enough for v1? (Default: free text.)
2. **Membership verification** — can a manager just add anyone by email, or must
   the invitee confirm before they're emailed broadcasts? (Default: invite →
   they confirm on signup/first login before receiving emails.)
3. **Mapping existing data** — do we try to auto-seed groups from `owner_text`
   on race cards, or start groups empty and let managers build them? (Default:
   start empty; auto-seeding `owner_text` is messy and error-prone.)

### Phasing
- **Phase 1:** tables + RLS + manager UI to create a group, add horses, invite
  members.
- **Phase 2:** syndicate broadcast (post update → email members).
- **Phase 3:** micro-owner "jockey assigned" alerts wired into the booking flow.

---

## Suggested build order
1. **Audio Phase 1** (smaller, self-contained, high "wow").
2. **Syndicate Phase 1** (tables + manager UI), then its Phases 2–3.

Tell me the answers to the **Decisions needed** above (or accept the defaults)
and which to build first, and I'll start.
