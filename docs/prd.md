# DailyQ – Product Requirements Document (MVP v1)

## 1. Product Vision

DailyQ is a lightweight, mobile-first app that asks users **one question per day**.

The core hypothesis of the MVP is that **answering a single daily question is intrinsically enjoyable**, without relying on:
- Reflection mechanics
- Analytics or insights
- External rewards or pressure

The MVP intentionally strips the product down to the **daily ritual itself**. No explanation, no framing, and no long-term payoff is required to enjoy the act of answering.

## 2. MVP Goal

**Primary goal**

- Validate whether users enjoy answering **one daily question** on its own.

**Secondary goals**

- Observe whether users return organically on multiple days.
- See whether **light catch-up** (jokers for missed days) supports the habit **without creating pressure**.

Anything that materially influences motivation beyond the question itself (e.g., gamification, strong nudges, rewards) is treated as a **potential confound** and is excluded from MVP v1.

## 3. Core MVP Flow

**First-time user**

1. User opens the app.
2. Onboarding screen appears with email and password inputs.
3. User signs up with email + password (or signs in if they already have an account).
4. User is authenticated and lands on Today tab with today's question.

**Returning user (daily flow)**

1. User opens the app (session is restored; no re-login required).
2. Today tab shows the daily question with an empty text field (or existing answer if already submitted).
3. User types an answer.
4. User submits the answer.
5. For a **new** answer: optional Monday recap modal may appear (e.g. “You answered X of Y questions last week”); user can dismiss or go to Calendar to answer a missed day.
6. For an **edit** (same day, changing existing answer): a brief “Answer changed” confirmation modal or toast appears; user dismisses.
7. The user can browse past answers in Calendar tab or leave the app.

The flow is intentionally short and repeatable, with minimal friction.

## 4. Daily Question System

- There is exactly **one global question per calendar day**.
- All users worldwide receive **the same question on the same day**.
- Questions are:
  - Short
  - Open-ended
  - Non-therapeutic

They should **avoid**:
- Emotional evaluation (“How do you feel about…?”)
- Growth language (“How will you improve…?”)
- Introspection framing (“Reflect on…”)

The **question itself is the product**.

**Scheduling (MVP v1)**

- Questions are **manually curated and scheduled**.
- A question is active for a given **calendar date (local time)**.
- Users do **not** see tomorrow’s question in MVP v1.

## 5. Answers

- Answers are **text-only**.
- No minimum or maximum length is enforced in MVP v1 (aside from technical limits).
- An answer is considered **complete only when the user explicitly submits it**.
  - Merely opening the app or typing in the field does **not** count.
- Answers are **private** and only visible to the user (no social or sharing features).

**Retention**

- Answers are kept **indefinitely** for MVP v1.
- Any data-retention policy is a **future decision**.

## 6. Jokers (Included in MVP)

The MVP includes a **light catch-up mechanic** via **jokers**.

- **Jokers** let the user answer a **missed day** within the **past 7 calendar days** (one joker per missed day).
- Each user has a **joker balance** (stored in `profiles`). A **monthly grant** (e.g. via RPC `grant_monthly_jokers`) tops up jokers once per calendar month.
- **Header:** On the Today and Calendar tabs, the header shows a **joker indicator** (e.g. ⭐ plus the balance). Tapping it opens a **small informational modal** (no navigation, no RPC): title “Jokers” / “Joker” (singular when balance is 1); body explains balance and that a joker lets you answer a missed day in the last 7 days; close via X, tapping outside, or Escape. The balance number in the modal is emphasized (e.g. bold, accent color). Dutch copy uses singular “Joker” when balance is 1, plural “Jokers” otherwise.
- **Calendar – missed day:** Tapping a missed day (within 7 days, on or after account creation) opens a modal. If the user has at least one joker: message e.g. “Je hebt deze dag gemist. Met een joker kun je de vraag alsnog beantwoorden.” with **Joker inzetten** and Cancel. Choosing “Joker inzetten” calls `use_joker` RPC and opens the full-screen answer overlay for that day. If the user has no jokers: informational “Je hebt geen jokers meer” (or similar) with OK. Days older than 7 days or before account creation show “Deze dag is gesloten” (informational only).
- **Constraints:** Jokers are for catch-up only. No gamification beyond the balance and the informational modal. No penalties or “you lost your jokers” messaging.

## 7. Accounts & Authentication

Accounts are included in MVP v1 as a **technical necessity** to:

- Persist answers reliably.
- Avoid user frustration from lost data.
- Support repeat usage over time.

They are **not** a product feature.

**Onboarding Screen**

For unauthenticated users, the app displays a full-screen onboarding view before access to any content:

- **Visual design:**
  - Warm beige background (#eee9e0) with subtle gradient variation
  - Near-black text (#1A1A1A) for readability
  - Email and password input fields; primary button inverts to dark background
- **Layout:**
  - Centered vertically and horizontally
  - "DailyQ" heading at top
  - Email input field and password input field
  - "Sign Up" / "Sign In" primary button; toggle link for "Already have an account? Sign in" / "Need an account? Sign up"
  - Minimal copy, no clutter
- **Behavior:**
  - User signs up with email + password or signs in with existing credentials
  - Onboarding screen persists until user is authenticated; no way to bypass or skip
  - Session is persisted (e.g. localStorage) so returning users stay signed in; works reliably in PWA

**Characteristics**

- **Email + password authentication** (Supabase Auth): `signUpWithEmailAndPassword`, `signInWithEmailAndPassword`; no magic links or OTP in MVP v1. No usernames or profiles.
- User settings screen includes signed-in email, **Log Out** button, and app version info (see Settings Screen section).
- No social graph or friend system.

**Authentication flow**

- **First-time users** see the onboarding screen immediately upon opening the app.
- User signs up or signs in with email + password → authenticated.
- **Returning users** who are already authenticated skip onboarding and land directly on the Today tab.
- Session is restored on app reload without requiring re-login (auth state is listened to).

Multi-device behavior (e.g., phone + laptop) is **best-effort only** in MVP v1 and not explicitly optimized.

## 8. Platform & Architecture

**Client**

- **Mobile-first PWA** built with **Next.js** (App Router).
- **Technical stack:**
  - Next.js 15+ with React
  - Inter font via `next/font/google`
  - Supabase client SDK (`@supabase/ssr`, `@supabase/supabase-js`)
  - Service worker for shell caching and aggressive update strategy on new deployments
  - PWA manifest for installability
- **UI structure:**
  - **Top header:** Centered "DailyQ" logo; on Today and Calendar tabs: **joker indicator** (e.g. ⭐ + balance) in the top-right. Background and text use app theme (e.g. #F4F6F9, navy accent #14316A).
  - Bottom tab bar with three tabs: Today, Calendar, Settings
  - Tab icons: question mark, calendar, gear
  - Client-side tab switching (no route changes, using state to hide/show content)
  - Dynamic viewport height (`100dvh`) to account for mobile browser chrome
  - **Mobile layout:** Today tab and Calendar tab use responsive top spacing (e.g. `clamp(1rem, 12–15vh, 5–6rem)`) so the main content (textarea / calendar grid) sits slightly lower and feels roughly vertically centered on small screens; desktop layout unchanged.
  - Tab switching with fade transitions
- The primary route `/` is the main and almost only user-facing surface.
- The app is designed to be:
  - Installable on mobile home screens.
  - Comfortable on small screens, with larger tap targets and minimal UI.
  - Fully functional offline with pending draft sync.

**Backend**

- **Supabase** is used for:
  - Email + password authentication (Supabase Auth).
  - Postgres database (questions and answers).
  - Row-level security (RLS) so users can only access their own answers.
  - Simple APIs via Supabase JS client.

**Offline behavior**

- The PWA includes:
  - A minimal **service worker**.
  - Caching of:
    - The app shell.
    - Today’s question (when previously loaded).
    - The user’s current draft answer.
- When offline:
  - The app shows any cached question and draft.
  - The user can still type and press submit.
  - The answer is stored locally as a **pending draft** and synced when back online.
  - A subtle message indicates offline state (e.g. “You are offline. Your answer will sync when you’re back online.”).

## 9. Data Model (High-Level)

Supabase Auth provides the `users` table; DailyQ adds:

**questions**

- `id` (uuid, primary key)
- `text` (text) – the question
- `day` (date) – calendar date key for which the question is active
- `inserted_at` (timestamptz) – audit field

**answers**

- `id` (uuid, primary key)
- `user_id` (uuid, FK to `auth.users.id`)
- `question_id` (uuid, FK to `questions.id`)
- `answer_text` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- Unique constraint on `(user_id, question_id)` to ensure **one logical answer per user per day**.

**profiles** (or equivalent)

- `joker_balance` (integer), `last_joker_grant_month` (e.g. date or string) for monthly joker grants.
- RPCs: `grant_monthly_jokers` (idempotent per month), `use_joker` (consumes one joker and allows submitting an answer for a missed day within the 7-day window).
- On submit for today, the app upserts the answer (same-day edits). After a **new** answer, Monday recap modal may show; after an **edit**, an “Answer changed” confirmation is shown. Joker balance is shown in the header and in the joker informational modal.

## 10. Behavior: Answering & Editing

**Today’s question**

- “Today” is determined by **local calendar date** on the user’s device.
- The app fetches `questions` by `day = today`.

**Answering**

- If a user is logged in:
  - They see today’s question.
  - On submit/update, the answer row is **updated** (or created).
- If a user is not logged in:
  - They see the onboarding screen (gradient background with email input).
  - After authentication, they land on Today tab and can answer.

**Same-day editing**

- Users can **edit their answer for the current day until local midnight**.
- Each edit updates the existing record (no extra answers are created).
- Only one answer per day is stored; edits update the same record.

**Multiple submissions**

- If the user tries to “submit again” after already answering that day, the system treats this as an **edit**, not a new submission.
- There is no separate “second submission” concept; it’s always one logical answer per day.

## 10a. Calendar View

The Calendar tab provides a simple month-by-month view of answered days.

**Navigation**

- Month selector with "previous" and "next" buttons
- Displays one month at a time (current month by default)
- Standard 7-column calendar grid (Su-Sa or Mo-Su depending on locale)

**Visual indicators**

- Days with submitted answers show a **small dot** beneath the date
- Days without answers show nothing (blank, no special indicator)
- Current day may be highlighted with a subtle border or background

**Interaction**

- Tapping a day with a dot opens a **modal overlay**
- Modal displays:
  - The question text for that day
  - The user's answer text for that day
  - "Close" or "Done" button to dismiss
- Modal appears centered with backdrop blur
- Read-only view (no editing of past answers in MVP v1)

**Missed days (rolling 7-day window)**

- Days in the **past 7 calendar days** (from today) that have no answer are treated as **missed** (if on or after the user’s account-creation date).
- Tapping a missed day opens a confirmation modal: “Je hebt deze dag gemist” with “Nu beantwoorden” and “Annuleren”.
- Choosing **“Nu beantwoorden”** opens a **full-screen answer overlay** on top of the Calendar (no navigation to the Today tab):
  - Background (Calendar) stays mounted and is dimmed/blurred.
  - Overlay shows the question for that date, a text input, and a submit button.
  - Top-right **close (X)** closes the overlay without saving and returns to the Calendar.
  - **No** close on backdrop tap; close only via X or after successful submit.
  - Before submit, the app validates that the date is within the 7-day window and on or after the user’s account-creation date; invalid submissions are rejected.
  - On successful submit, the answer is saved (same backend as Today), the overlay closes, and the Calendar view is updated (dot appears for that day).
- Days **older than 7 days** or **before account creation** are not answerable; tapping them shows “Deze dag is gesloten” (informational only).

**Requirements**

- Requires authentication (unauthenticated users see onboarding screen instead; Calendar and Settings receive user from app state so they work consistently with the rest of the app).
- Data fetched from Supabase: `answers` joined with `questions(text, day)`.
- **Optimistic update:** After the user saves an answer on the Today tab, the calendar's local state is updated immediately so the current day shows the "answered" indicator without a full refetch or reload.
- Handles loading states, empty states, and errors gracefully.

## 10b. Settings Screen

The Settings tab provides minimal app controls and information.

**Content**

- User's email address when available (read-only, displayed as "Signed in as: user@example.com")
- **Log Out** button (always visible when the tab is shown; logs user out, returns to onboarding screen)
- App version info: "DailyQ Version 1.0"
- Tagline: "One question a day."
- Optional link to creator (e.g. @handle)

**Behavior**

- Tapping "Log Out" calls `supabase.auth.signOut()` and reloads the app so the user sees the onboarding screen
- No other settings or preferences in MVP v1

## 11. What Is Explicitly NOT in MVP v1

The following are **deliberately out of scope** to keep the experiment clean and focused on the daily ritual:

- **History or archive**
  - Calendar view is **included** but limited to read-only month view with dots (see Section 10a).
  - No advanced list views or filtering of past answers.
  - No weekly, monthly, or yearly comparisons or analytics.
- **Reflection & analytics**
  - No charts, trends, or insights.
  - No AI interpretation of answers.
- **Engagement mechanics**
  - No notifications or reminders.
  - No badges, levels, or advanced streak visualizations.
  - **Limited catch-up:** answering a missed day is supported only within the **rolling 7-day window** and only via the **Calendar overlay** (no navigation to Today); see Section 10a.
- **Social and sharing**
  - No comments, likes, or feeds.
  - No sharing answers to social platforms.
- **Monetization**
  - No ads.
  - No premium tier or in-app purchases.
- **Settings & customization**
  - Settings screen is **included** for sign-out, app info, and **language selection** (e.g. Dutch / English) (see Section 10b).
  - No theme customization or other preferences in MVP v1 beyond language.

If a feature does not **directly support the daily question ritual**, it does **not** belong in MVP v1.

## 12. UX & Visual Style

The app should feel:

- **Calm**
- **Minimal**
- **Fast**

Principles:

- **First-time users** see a full-screen onboarding screen with:
  - Warm beige background (#eee9e0)
  - Email + password inputs and Sign Up / Sign In flow
  - Minimal copy: "DailyQ" heading and toggle between sign up and sign in
- **Returning authenticated users** land directly on the Today tab with today's question (session restored).
- No instructional language about:
  - Why the question matters.
  - How to answer.
  - How often to return.
- **Navigation:**
  - Top header: centered "DailyQ" logo; on Today and Calendar: joker indicator (⭐ + balance) top-right
  - Bottom tab bar: Today, Calendar, Settings; tab icons: question mark, calendar, gear
  - Client-side tab switching with fade transitions
- **Typography:**
  - System font (e.g. Inter or system UI) system-wide
  - Mobile-friendly sizing and generous spacing
- **Visual style:**
  - Single theme: light background (e.g. #F4F6F9), navy accent (#14316A), near-black text
  - No dark mode in MVP v1; consistent calm palette
  - Minimal chrome; very few elements per screen
  - Buttons and inputs use the same palette (e.g. accent for primary actions)
- **Feedback:**
  - **Modals and overlays** are rendered via **React portal** into `document.body` so the **entire viewport** (header, main content, tab bar) dims **together** when a popup is open; no staggered fade (backdrop and content animate as one).
  - Monday recap modal (if shown) after a new answer; “Answer changed” confirmation when editing
  - Joker balance in header; tapping it opens the informational joker modal (no title line; balance number emphasized; close via X, outside tap, or Escape)
  - Button text: “Submit” / “Update” by context; subtle offline indicator when relevant

The product should **never pressure** the user to return. Any return behavior should be voluntary.

## 13. Success Criteria (MVP)

The MVP is considered successful if:

- Users voluntarily answer questions on **multiple days**.
- Users report that **the questions themselves** are enjoyable or interesting.
- Drop-off is primarily caused by **question quality**, not confusion or friction.
- The app can be explained simply as:

> “It asks you one question a day.”

Daily engagement *length* is **not** a success metric.

## 14. Known Risks

**Primary risk**

- **Poor question quality.**  
  If questions are uninteresting, the product fails regardless of UX or technology.

**Secondary risks**

- Over-signaling meaning or accidentally drifting toward:
  - Self-reflection apps.
  - Wellness or self-improvement framing.
- Adding features that unintentionally shift the focus away from the daily ritual.

## 15. Future Considerations (Out of Scope for MVP)

These ideas are intentionally postponed until the **core ritual is validated**:

- Weekly or long-term comparison mechanics.
- Calendar or archive views of past answers.
- Community or social layers.
- Advanced streak mechanics and visualizations.
- Notifications or gentle reminders.
- Monetization and export options.
- Question generation or personalization (e.g. via AI).

Any future feature must be evaluated against a single criterion:

> Does this preserve the simplicity and neutrality of the daily question ritual?

---

## Implementation notes (changelog)

- **Auth:** Sign up / sign in use email + password. Session is restored on load via Supabase auth state; no hash-based redirect.
- **UI:** Single theme (e.g. background #F4F6F9, accent #14316A). Header and nav use the same background.
- **Header:** On Today and Calendar tabs, top-right shows **joker indicator** (e.g. ⭐ + balance). Tapping opens informational joker modal (close: X, outside tap, Escape). Dutch: "Joker" when balance 1, "Jokers" otherwise.
- **Jokers:** Balance and monthly grant in profiles; RPCs grant_monthly_jokers, use_joker. Calendar missed-day: has joker → "Joker inzetten" and answer overlay; no jokers → "Je hebt geen jokers meer".
- **Calendar:** After saving an answer, calendar updates optimistically. Month change: no full-screen loading; new month grid shows immediately, data loads in background (full-screen loading only on initial load).
- **PWA:** Service worker uses aggressive update (skipWaiting, clear caches on activate, reload on new worker) to avoid stale cache after deploys.
- **Settings:** Log Out and language selection (e.g. Dutch/English) visible. Calendar and Settings receive user from Home so dev mock user is respected.
- **Mobile:** Today and Calendar use spacing (e.g. clamp) so main content sits lower on small screens for a more centered feel.
- **Calendar – missed-day answer (see Jokers):** “Nu beantwoorden” opens a full-screen modal overlay on the Calendar (no route change). User answers in the overlay; validation (7-day window, account start) before submit; close via X or successful submit only; background dimmed/blurred.
- **Pop-up screens (modals):** All full-screen overlay modals are rendered via **React portal** into document.body so the entire viewport (header, main, tab bar) dims together with the backdrop; no staggered fade. Every pop-up has a top-right **X**; close runs 200 ms exit animation (fadeOut + scaleOut) before unmount. - **Pop-up animations:** Open: fadeIn (backdrop) and scaleIn/streakEnter (card), 0.2 s, with forwards so the end state is kept. Close: fadeOut + scaleOut, 200 ms, then unmount. Applied to Monday recap, joker modal, edit confirmation, missed-day answer overlay, Calendar view-answer and missed/closed modals.