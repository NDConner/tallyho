# Tallyho → a phone app people can download

_Outline / working plan. Status: draft for discussion (2026‑11‑09)._

The web app already does the hard part: a Next.js front end on top of Supabase
(Postgres + Auth + Realtime + Storage). A phone app doesn't need a new backend —
it talks to the **same Supabase project**. So "make it an app" is mostly a new
front end for the member experience, plus push notifications and app‑store
plumbing. This outlines the options, a recommended path, and the work involved.

---

## 1. Two kinds of "app" — and who each is for

Tallyho really has two surfaces:

| Surface | Who | Where it belongs |
| --- | --- | --- |
| **Player phone** | everyone — join, answer questions, see history, get notified | a real installable app (this plan) |
| **Host / TV game** | the host running the live show, mirrored to a TV | stays on the **web** (big screen, projector, cast) — no app needed |

The win from a downloadable app is almost entirely on the **player** side:
home‑screen icon, push notifications ("you were added to a game", "answers due
tomorrow"), and a native‑feeling answer flow. The live TV game is better left on
the web where it already runs.

---

## 2. Three ways to ship it

### Option A — PWA (installable web app) — _fastest, recommended first step_
Make the existing site installable: add a web manifest + service worker, and the
`/join` + `/me` flows become an "Add to Home Screen" app on iOS and Android with
an icon and full‑screen UI.

- **Pros:** little new code, one codebase, ships in days, instant updates (no app
  review). Web push works on Android and on iOS 16.4+ for installed PWAs.
- **Cons:** not in the App Store / Play Store (people install from the browser
  share sheet); iOS push is slightly more limited; no native share/contacts.
- **Good for:** validating the mobile experience and notifications before
  investing in a native build.

### Option B — React Native via Expo — _the real downloadable app_
A native app (iOS + Android) in React/TypeScript, sharing the Supabase backend
and much of the existing logic. Expo gives us push notifications, deep links,
over‑the‑air updates, and a straightforward path into both stores.

- **Pros:** real store presence, first‑class push, native deep links for join
  codes, reuse of our TS types + Supabase client, OTA updates for most changes.
- **Cons:** a second front end to maintain; store review cycles; Apple's
  $99/yr + Google's one‑time fee.
- **Good for:** the destination once the PWA proves the experience.

### Option C — fully native (Swift / Kotlin)
Not recommended. No meaningful benefit here over Expo, and double the work.

**Recommended path: ship the PWA now (Option A), then build the Expo app
(Option B) reusing everything the PWA taught us.** The Supabase backend and our
member‑account model (already built) carry straight over.

---

## 3. Architecture (what stays, what's new)

```
          ┌─────────────────────────── Supabase (unchanged) ───────────────────────────┐
          │  Postgres + RLS   │   Auth (email OTP/magic link)   │  Realtime  │  Storage  │
          └───────┬───────────────────────┬────────────────────────┬─────────────┬──────┘
                  │                        │                        │             │
     ┌────────────┴─────────┐   ┌──────────┴───────────┐   ┌────────┴─────────────┴──────┐
     │  Web (Next.js)       │   │  Player app          │   │  Host live game             │
     │  host dashboard +    │   │  (PWA, then Expo)     │   │  stays web, cast to TV      │
     │  /join + /me today   │   │  join · answer · me   │   │                             │
     └──────────────────────┘   └──────────────────────┘   └─────────────────────────────┘
```

- **Backend:** no change. The app uses `@supabase/supabase-js` directly for
  auth + reads/writes, exactly like the web client, **or** calls our existing
  `/api/join/*` routes. RLS + the `authorizeMember` gate we just built already
  enforce "your answers are yours" regardless of client.
- **Auth:** email OTP / magic link. On mobile the magic link opens the app via a
  **deep link** (`tallyho://` + universal/app links) instead of the browser.
- **Shared code:** our domain types (`src/lib/types.ts`), scoring, and lock rules
  (`src/lib/lock.ts`) are plain TS and move over as‑is.

---

## 4. Player app — screens (v1)

1. **Join** — enter a code (or open a deep link) → sign in → claim your name.
2. **My questions** — answer the feud prompts, captain topic picks; respects the
   answer lock / deadline.
3. **Home (`/me`)** — games you're in and (if you host) games you host; history
   and recaps.
4. **Notifications** — "added to a game", "answers due soon", "the recap is live".

The web already has #1–#3. v1 of the app is mostly re‑skinning these for native
and wiring #4.

---

## 5. Push notifications (the headline feature)

This is the biggest reason to go native, and it ties directly into the roadmap
item about recognizing returning players and notifying them when they're added.

- **Delivery:** Expo Push (handles APNs + FCM) for the native app; Web Push for
  the PWA.
- **Data model:** a `device_tokens` table (`user_id`, `token`, `platform`) and a
  `notifications` table (`user_id`, `type`, `payload`, `read_at`).
- **Triggers:** a Supabase Edge Function (or our server) sends a push when —
  - a host adds you to a game (links a `members` row to your `user_id`),
  - the answer deadline is approaching,
  - a game you were in posts its recap.
- **Prereq already in place:** member accounts (`members.user_id`) landed this
  week — that's the identity a notification targets. The "recognize returning
  players by username and notify them" feature is the first producer of these.

---

## 6. Rough milestones

1. **PWA shell** — manifest, service worker, installable `/join` + `/me`, Web
   Push on Android/iOS. _(small)_
2. **Notifications backend** — `device_tokens` + `notifications` tables, an Edge
   Function to send, and the "added to a game" + "deadline soon" triggers.
   _(backend; benefits web + app)_
3. **Expo app skeleton** — auth (OTP deep links), Supabase client, the three
   player screens reusing our types. _(medium)_
4. **Expo push + deep links** — join‑code links open the app; push wired to the
   notifications backend. _(medium)_
5. **Store submission** — icons, splash, privacy labels, TestFlight / internal
   testing, then review. _(logistics)_

Steps 1–2 deliver most of the value (installable + notifications) with no store
dependency; 3–5 turn it into a true downloadable app.

---

## 7. Open questions for Noah

- **App vs. PWA urgency:** is "in the App Store" important, or is an installable
  web app (icon + push) enough for now?
- **Who needs the app:** players only (recommended), or do you also want a host
  app vs. keeping hosting on the web?
- **Notifications scope:** which events are worth a push — added to a game,
  deadline reminders, recap ready, anything else?
- **Branding:** app name/icon = Tallyho as‑is, or a variation?
