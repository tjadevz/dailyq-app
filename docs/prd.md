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
- See whether a **minimal streak confirmation** gently reinforces the habit **without creating pressure**.

Anything that materially influences motivation beyond the question itself (e.g., gamification, strong nudges, rewards) is treated as a **potential confound** and is excluded from MVP v1.

## 3. Core MVP Flow

**First-time user**

1. User opens the app.
2. Onboarding screen appears with gradient background and email input.
3. User enters email and receives magic link.
4. User clicks link and is authenticated.
5. User lands on Today tab with today's question.

**Returning user (daily flow)**

1. User opens the app.
2. Today tab shows the daily question with an empty text field.
3. User types an answer.
4. User submits the answer.
5. A full-screen streak modal appears with celebration and streak count.
6. User taps to dismiss the modal.
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

## 6. Streaks (Included in MVP)

The MVP includes a **very light streak mechanic**.

- A **streak** is the number of **consecutive calendar days** on which the user has submitted an answer.
- The streak increments **only after a successful submission** for a new day (not on app open).
- After submitting, a **full-screen modal overlay** appears with the streak celebration:

> “Yay. This is your 2-day streak.”

**Modal characteristics:**

- Full-screen backdrop with blur effect
- Centered white card with large, clear text
- Enters with a gentle scale-in animation (~300ms)
- Celebratory but calm (no confetti, no excessive animation)
- **Must be manually dismissed** - user taps "Done" button or backdrop to close
- No auto-dismiss timer
- After dismissal, the flow ends immediately with no follow-up prompts

**Constraints:**

- No badges, levels, or visual gamification beyond the modal.
- No penalties or “you lost your streak” messaging.
- Missing a day silently breaks the streak; the next successful submit starts a new streak at 1.
- The streak exists purely as **soft confirmation**, not as a goal or score.

## 7. Accounts & Authentication

Accounts are included in MVP v1 as a **technical necessity** to:

- Persist answers reliably.
- Avoid user frustration from lost data.
- Support repeat usage over time.

They are **not** a product feature.

**Onboarding Screen**

For unauthenticated users, the app displays a full-screen onboarding view before access to any content:

- **Visual design:**
  - Vertical gradient background: `#4F86C6` (top) → `#2F6FAF` (middle) → `#0F3E73` (bottom)
  - All UI elements (text, input, button) in white or near-white for contrast
  - Subtle looping background animation (gentle glow pulse)
- **Layout:**
  - Centered vertically and horizontally
  - "DailyQ" heading at top
  - Email input field (auto-focused on mount)
  - "Continue" button below input
  - Minimal copy, no clutter
- **Behavior:**
  - User enters email → receives magic link
  - Post-submit message: "Check your email."
  - Onboarding screen persists until user is authenticated
  - No way to bypass or skip

**Characteristics**

- **Email-only magic-link authentication**
  - No passwords.
  - No usernames.
  - No profiles.
- User settings screen includes only sign-out button and app version info (see Settings Screen section).
- No social graph or friend system.

**Authentication flow**

- **First-time users** see the onboarding screen immediately upon opening the app.
- User enters email → receives magic link → clicks link → authenticated.
- **Returning users** who are already authenticated skip onboarding and land directly on the Today tab.
- If a user starts typing an answer before authenticating (not currently possible in MVP, but planned for future iteration):
  - Draft is stored locally.
  - On submit, magic link flow is triggered.
  - Draft is restored and saved after authentication.
  - The UI copy is along the lines of:  
    > “We’ve emailed you a login link to save your answer.”

Multi-device behavior (e.g., phone + laptop) is **best-effort only** in MVP v1 and not explicitly optimized.

## 8. Platform & Architecture

**Client**

- **Mobile-first PWA** built with **Next.js** (App Router).
- **Technical stack:**
  - Next.js 15+ with React
  - Inter font via `next/font/google`
  - Supabase client SDK (`@supabase/ssr`, `@supabase/supabase-js`)
  - Service worker for offline caching
  - PWA manifest for installability
- **UI structure:**
  - Top header displaying "DailyQ" text
  - Bottom tab bar with three tabs: Today, Calendar, Settings
  - Tab icons: question mark, calendar, gear
  - Client-side tab switching (no route changes, using state to hide/show content)
  - Dynamic viewport height (`100dvh`) to account for mobile browser chrome
  - Tab switching with fade transitions
- The primary route `/` is the main and almost only user-facing surface.
- The app is designed to be:
  - Installable on mobile home screens.
  - Comfortable on small screens, with larger tap targets and minimal UI.
  - Fully functional offline with pending draft sync.

**Backend**

- **Supabase** is used for:
  - Email magic-link authentication (Supabase Auth).
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

**Streak calculation**

- Streaks are **derived from answers**, not stored as a separate field.
- On submit, the app:
  - Ensures the answer for `(user_id, question_id)` is upserted (allowing same-day edits).
  - Fetches the user’s answered days and computes the length of the **current consecutive run** ending today.

## 10. Behavior: Answering & Editing

**Today’s question**

- “Today” is determined by **local calendar date** on the user’s device.
- The app fetches `questions` by `day = today`.

**Answering**

- If a user is logged in:
  - They see today’s question.
  - On submit/update, the answer row is **updated** (or created), and the streak is recomputed.
- If a user is not logged in:
  - They see the onboarding screen (gradient background with email input).
  - After authentication, they land on Today tab and can answer.

**Same-day editing**

- Users can **edit their answer for the current day until local midnight**.
- Each edit updates the existing record (no extra answers are created).
- Streak is **not double-counted**; only the presence of an answer for that day matters.

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

**Requirements**

- Requires authentication (unauthenticated users see onboarding screen instead)
- Data fetched from Supabase: `answers` joined with `questions(text, day)`
- Handles loading states, empty states, and errors gracefully

## 10b. Settings Screen

The Settings tab provides minimal app controls and information.

**Content**

- User's email address (read-only, displayed as "Signed in as: user@example.com")
- **Sign out** button (logs user out, returns to onboarding screen)
- App version info: "DailyQ Version 1.0"
- Tagline: "One question a day."

**Behavior**

- Tapping "Sign out" calls `supabase.auth.signOut()` and clears session
- After sign out, user is immediately returned to onboarding screen
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
  - No catch-up mechanics (e.g., answering missed days).
  - No badges, levels, or advanced streak visualizations.
- **Social and sharing**
  - No comments, likes, or feeds.
  - No sharing answers to social platforms.
- **Monetization**
  - No ads.
  - No premium tier or in-app purchases.
- **Settings & customization**
  - Settings screen is **included** but only for sign-out and app info (see Section 10b).
  - No theme customization, language selection, or other preferences in MVP v1.

If a feature does not **directly support the daily question ritual**, it does **not** belong in MVP v1.

## 12. UX & Visual Style

The app should feel:

- **Calm**
- **Minimal**
- **Fast**

Principles:

- **First-time users** see a full-screen onboarding screen with:
  - Vertical blue gradient background (#4F86C6 → #2F6FAF → #0F3E73)
  - Simple email input for magic link authentication
  - Minimal copy: just "DailyQ" heading
  - Subtle looping background animation (gentle glow effect)
- **Returning authenticated users** land directly on the Today tab with today's question.
- No instructional language about:
  - Why the question matters.
  - How to answer.
  - How often to return.
- **Navigation:**
  - Top header displaying "DailyQ" text
  - Bottom tab bar with three tabs: Today, Calendar, Settings
  - Tab icons: question mark (Today), calendar (Calendar), gear (Settings)
  - Client-side tab switching with fade transitions
- **Typography:**
  - Inter font (via `next/font/google`) system-wide
  - Mobile-friendly sizing and generous spacing
- **Visual style:**
  - Light mode: Soft off-white background (#f9fafb), near-black text (#111827)
  - Dark mode: Very dark blue-tinted background (#020617), soft light gray text (#e5e7eb)
  - Calm blue accent color: #2563eb (light mode), #60a5fa (dark mode)
  - Minimal chrome; very few elements per screen
- **Feedback:**
  - Full-screen streak modal after submit with scale-in animation and blur backdrop
  - Answer text field always empty (never pre-filled)
  - Button text changes between "Submit" and "Update" based on context
  - Subtle offline indicator when relevant

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