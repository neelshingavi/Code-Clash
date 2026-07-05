# Code Clash (Daily Code Clash) — Production Readiness Audit & Engineering Roadmap

> **Scope of this document**: This is a full-depth, line-level audit of the actual repository at
> `/Users/macbook/Leetcode Challenge` (package name `daily-code-clash`), performed by reading every
> source file, every SQL schema file, the git history, and the installed Next.js 16 docs shipped in
> `node_modules/next/dist/docs`. Nothing in this document is generic boilerplate advice — every
> finding below is tied to a specific file, line, or table in your repo as it exists today.
>
> **Audit date**: July 2026
> **Reviewed as**: Senior/Staff-level engineer doing a pre-production architecture + security review.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Snapshot](#2-current-state-snapshot)
3. [🔴 Critical Functional Bugs (Read This First)](#3-critical-functional-bugs-read-this-first)
4. [🔒 Security Audit](#4-security-audit)
5. [🗄️ Data Model Redesign (Full SQL)](#5-data-model-redesign-full-sql)
6. [🏗️ Application Architecture Redesign (Next.js 16 idiomatic)](#6-application-architecture-redesign-nextjs-16-idiomatic)
7. [✨ Feature Roadmap (Fixes + New Features)](#7-feature-roadmap-fixes--new-features)
8. [🎨 UI/UX & Accessibility Audit](#8-uiux--accessibility-audit)
9. [🧪 Testing Strategy](#9-testing-strategy)
10. [⚡ Performance & Scalability](#10-performance--scalability)
11. [📈 Observability & Operations](#11-observability--operations)
12. [🚀 DevOps, CI/CD & Deployment Hardening](#12-devops-cicd--deployment-hardening)
13. [📦 Dependency & Tooling Audit](#13-dependency--tooling-audit)
14. [🗺️ Prioritized Roadmap (Phased Execution Plan)](#14-prioritized-roadmap-phased-execution-plan)
15. [Appendix: Ready-to-use Code](#15-appendix-ready-to-use-code)

---

## 1. Executive Summary

Code Clash is a 1v1/small-group LeetCode competition tracker built on **Next.js 16.2.10 (App
Router) + React 19.2.4 + Supabase (Postgres/Auth/Realtime)**. The visual design (glassmorphism,
dark theme, Toast system) is genuinely polished for an early-stage project, and the ambition
(time-boxed challenges, configurable penalty modes, realtime leaderboards) is a strong product
idea. The repository has **3 commits total** and is a very young codebase — this audit found it at
exactly the right time, before real users are trusting it with a scoring system.

**The headline finding is this: the core scoring loop is completely non-functional.** Because
`src/app/submit/page.tsx` never writes a `challenge_id` onto a submission, and nothing anywhere
increments `challenge_participants.score` when a problem is solved, **every leaderboard in the app
will only ever show scores trending toward zero or negative**, regardless of how many problems
anyone actually solves. This isn't a polish issue — it's a "the product doesn't do the one thing it
promises" issue, and it's fixed in Section 3 with exact code.

Beyond that, this audit found a working set of security holes that would let any signed-in user
edit anyone else's score, read every user's email address, forge arbitrary point totals, and change
the global scoring rules for the whole app. None of this is theoretical — it's directly exploitable
from the browser console with the anon key that already ships to the client.

### Severity Summary

| # | Finding | Severity | Section |
|---|---|---|---|
| 1 | Submissions never linked to a challenge → leaderboard scores are permanently broken | 🔴 Blocker | [3.1](#31-blocker-submissions-are-never-linked-to-a-challenge) |
| 2 | `challenge_participants.score` is never incremented on a correct solve — only ever decremented | 🔴 Blocker | [3.2](#32-blocker-score-only-goes-down-never-up) |
| 3 | Any authenticated user can UPDATE any row in `challenge_participants` (edit anyone's score/rank) | 🔴 Critical | [4.1](#41-rls-any-authenticated-user-can-overwrite-any-score) |
| 4 | Any authenticated user can rewrite the global scoring rules (`point_settings`) | 🔴 Critical | [4.2](#42-fake-admin-gate-on-settings) |
| 5 | `points_earned` on a submission is 100% client-supplied and unvalidated server-side | 🔴 Critical | [4.3](#43-client-controlled-points-trivial-score-forgery) |
| 6 | Public `get_email_by_username` RPC leaks every registered email address | 🟠 High | [4.4](#44-email-enumeration-via-get_email_by_username) |
| 7 | `users` table is fully readable (including `email`) by anyone with the anon key, even signed-out | 🟠 High | [4.5](#45-pii-leak-users-table-is-world-readable) |
| 8 | No uniqueness constraint on `username` — two accounts can register the same username | 🟠 High | [4.6](#46-username-collisions-break-login) |
| 9 | No problem-verification / anti-cheat — users self-report difficulty and completion | 🟠 High | [7.1](#71-leetcode-verification-anti-cheat-new-feature) |
| 10 | Penalty evaluation runs client-side, triggered by whoever happens to open the page | 🟡 Medium | [3.4](#34-penalty-evaluation-runs-on-the-wrong-side-of-the-network) |
| 11 | 100% client components, zero Server Components/Actions, zero `proxy.ts` route protection | 🟡 Medium | [6](#6-application-architecture-redesign-nextjs-16-idiomatic) |
| 12 | Three unversioned, non-idempotent, hand-run SQL files instead of real migrations | 🟡 Medium | [5](#5-data-model-redesign-full-sql) |
| 13 | Zero automated tests, zero CI pipeline | 🟡 Medium | [9](#9-testing-strategy) |
| 14 | No rate limiting anywhere (login, signup, submission spam) | 🟡 Medium | [4.7](#47-no-rate-limiting-anywhere) |
| 15 | `next.config.ts` is the default empty scaffold — no security headers, no image config | 🟡 Medium | [12.3](#123-nextconfigts-hardening) |

Everything above is expanded with exact file/line references, exploit walkthroughs, and copy-paste
fixes in the sections that follow.

---

## 2. Current State Snapshot

### 2.1 Tech Stack (as installed)

| Layer | Technology | Version (from `package.json`) | Notes |
|---|---|---|---|
| Framework | Next.js | `16.2.10` (App Router) | Very recent major version — see [§13.1](#131-nextjs-16--react-192-you-are-on-the-bleeding-edge) |
| UI Runtime | React / React DOM | `19.2.4` | Ships React Compiler support, View Transitions, `useEffectEvent` |
| Language | TypeScript | `^5` | `strict: true` is on — good baseline |
| Backend/DB | Supabase (Postgres, Auth, Realtime) | `@supabase/supabase-js ^2.110.0` | Client-only usage today (no `@supabase/ssr`) |
| Icons | `lucide-react` | `^1.23.0` | ⚠️ verify — see [§13.2](#132-verify-the-lucide-react-version-pin) |
| Styling | Hand-written vanilla CSS + inline styles | — | No Tailwind, no CSS Modules used in real pages |
| Validation | **None** | — | No Zod/Yup anywhere in the repo |
| Testing | **None** | — | No test runner installed |
| CI/CD | **None** | — | No `.github/workflows`, no CI config found |
| Migrations | **None** | — | Three loose `.sql` files meant to be pasted into the Supabase SQL editor by hand |

### 2.2 Annotated Repository Structure

```text
Leetcode Challenge/
├── .env.local                     # NEXT_PUBLIC_SUPABASE_URL + ANON_KEY only (good: no service key committed)
├── AGENTS.md                      # ⚠️ Explicitly warns: "This is NOT the Next.js you know"
├── CLAUDE.md                      # @AGENTS.md (import-style reference)
├── README.md                      # Aspirational marketing copy; claims MIT license (no LICENSE file exists)
├── schema.sql                     # V1 schema — users, point_settings, submissions
├── schema_v2.sql                  # V2 — challenges, challenge_participants, realtime publication
├── schema_v3.sql                  # V3 — username→email lookup RPC (security issue, see §4.4)
├── package.json                   # next 16.2.10, react 19.2.4, no test/lint-staged/husky
├── next.config.ts                 # Empty scaffold — zero hardening
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout, inline-styled nav, no active-link state, no mobile nav
│   │   ├── page.tsx                # Dashboard — client component, `any` types, window.location redirects
│   │   ├── page.module.css        # 🗑️ Dead file — leftover create-next-app boilerplate, not imported anywhere
│   │   ├── globals.css             # Real design tokens/utility classes used by the actual UI
│   │   ├── auth/page.tsx           # Username/password auth via a custom RPC-based username→email flow
│   │   ├── submit/page.tsx         # 🔴 THE BUG LIVES HERE — insert never includes challenge_id
│   │   ├── settings/page.tsx       # "Dynamic Rules Engine" — fake admin gate, edits dead `daily_target` field
│   │   ├── challenges/
│   │   │   ├── create/page.tsx     # Challenge creation form
│   │   │   └── [id]/page.tsx       # Leaderboard + consistency calendar + realtime subscription
│   ├── components/
│   │   ├── features/               # Empty directory — no feature components extracted yet
│   │   └── ui/Toast.tsx            # Context-based toast system, no aria-live, Math.random() ids
│   ├── lib/
│   │   ├── supabase.ts             # Bare `createClient()`, silently falls back to '' on missing env vars
│   │   └── penaltyEngine.ts        # 🔴 Client-side penalty engine — see §3.1/§3.4
│   └── types/
│       └── database.ts             # Hand-written, already drifted from the real DB schema (see §6.4)
└── (no tests/, no .github/, no middleware.ts or proxy.ts, no LICENSE)
```

### 2.3 Data Flow As It Exists Today

```
[Browser]
   │  supabase-js (anon key, localStorage session)
   ▼
[Supabase Postgres] ── RLS policies (several are wide open, see §4)
   │
   ├── auth.users  (Supabase-managed)
   ├── public.users            (profile + email + total_score, world-readable)
   ├── public.point_settings   (global singleton, editable by ANY logged-in user)
   ├── public.challenges       (per-challenge rules, INSERT-only, never UPDATE-able)
   ├── public.challenge_participants (score/rank, UPDATE-able by ANY logged-in user)
   └── public.submissions      (problem log — challenge_id column exists but is NEVER populated)
```

There is no server-side layer at all today: no API routes, no Server Actions, no `proxy.ts`. Every
page is `"use client"` and every mutation is a direct `supabase.from(...).insert/update()` call from
the browser, protected only by whatever the RLS policy happens to allow (and several allow far too
much).

---

## 3. 🔴 Critical Functional Bugs (Read This First)

These are not style nits — the app's central value proposition (a fair, competitive, live-updating
leaderboard) does not currently work. Fix this section before anything else in this document.

### 3.1 [BLOCKER] Submissions are never linked to a challenge

**File**: `src/app/submit/page.tsx`, the insert call inside `handleSubmit`:

```ts
const { error: submitError } = await supabase.from("submissions").insert({
  user_id: user.id,
  problem_name: name,
  problem_url: url,
  difficulty,
  points_earned: points,
  // ❌ no `challenge_id` — this field exists in the schema (schema_v2.sql) but is never set
});
```

Meanwhile, both the leaderboard's consistency calendar (`src/app/challenges/[id]/page.tsx`) and the
penalty engine (`src/lib/penaltyEngine.ts`) filter submissions with `.eq("challenge_id", id)`. Since
`challenge_id` is `NULL` on every single row ever inserted, **every one of those queries returns an
empty set**, forever — no matter how many problems a user actually solves inside a challenge window.

**User-visible symptom**: the "Consistency Grid" on every challenge page shows every day as
`0 points`, and every past/current day is rendered red (failed), permanently, for every participant,
even the most active ones.

**Root cause**: the submission form has no concept of "which challenge am I logging this for,"
because a user can be in zero, one, or many concurrent challenges, and the UI never asks.

**The fix** requires both a UI change and a data model change (detailed with full code in
[§7.1](#71-leetcode-verification-anti-cheat-new-feature) and [§15.3](#153-rewritten-submitpagetsx)):
the submit flow must let the user pick an active challenge (or "personal log / no challenge"), and
the insert must carry that `challenge_id`.

### 3.2 [BLOCKER] Score only goes down, never up

Search the entire codebase for anywhere `challenge_participants.score` is increased. There is
exactly one place `score` is written outside of initialization: `src/lib/penaltyEngine.ts`, and it
only ever **subtracts**:

```ts
case "minus_points":
  newScore -= challenge.penalty_amount;
  break;
```

There is no code path anywhere — not in `submit/page.tsx`, not in a database trigger, not in an RPC
— that adds `points_earned` to `challenge_participants.score` when a user logs a correct solve.
Combined with §3.1 (which means the penalty engine sees `totalPoints = 0` for literally every day of
every challenge, because it's always querying by a `challenge_id` that was never written), the real
end-to-end behavior right now is:

> Every participant's score in every challenge trends **monotonically toward negative infinity**,
> at a rate of `penalty_amount` per day, purely as a side effect of opening the challenge page,
> regardless of effort. Nobody's score can ever go up.

This is fixable only by moving scoring into a single atomic, server-side operation. See the
`submit_solution()` Postgres function in [§5.4](#54-rpc-submit_solution-the-fix-for-31--32--43).

### 3.3 Race condition on `users.total_score`

`src/app/submit/page.tsx`:

```ts
const { data: userData } = await supabase.from("users").select("total_score").eq("id", user.id).single();
const currentScore = userData?.total_score || 0;
await supabase.from("users").update({ total_score: currentScore + points }).eq("id", user.id);
```

This is a classic **read-modify-write race**. If a user has two tabs open, or double-clicks submit,
or the request is retried, two concurrent submissions can both read `total_score = 10`, both compute
`10 + points`, and the second write clobbers the first — one submission's points are silently lost.
Fix: never round-trip a counter through the client. Use `UPDATE users SET total_score = total_score
+ $1` (atomic at the row level) or, better, compute `total_score` from `SUM(submissions.points_earned)`
inside the same `submit_solution()` RPC transaction described in §5.4.

### 3.4 Penalty evaluation runs on the wrong side of the network

`evaluatePenalties(userId, challengeId)` in `src/lib/penaltyEngine.ts` is invoked from
`src/app/challenges/[id]/page.tsx` only for the **currently signed-in user**, only when **that
specific user** happens to load that specific challenge page:

```ts
const isParticipant = parts?.some(p => p.user_id === session.user.id);
if (isParticipant) {
  await evaluatePenalties(session.user.id, id as string);
}
```

Problems with this design, independent of §3.1/§3.2:

1. **A user can dodge penalties indefinitely by simply not opening the challenge page** until they've
   caught up, since penalties are only computed as a side effect of their own page view.
2. **A user can bypass the entire engine** by calling the Supabase client directly from devtools —
   nothing stops `supabase.from('challenge_participants').update({score: 99999})` (see §4.1), which
   makes this client-side "enforcement" purely cosmetic against a motivated user.
3. There is no durable, queryable record of *why* a penalty fired (no `penalty_events` audit table),
   so disputes ("why did my score drop?") are undebuggable after the fact — `last_evaluated_date`
   overwrites itself with no history.
4. It silently double-runs / skips runs if the participant's client crashes mid-loop between the
   `SELECT` and the final `UPDATE`, since it's not wrapped in a transaction.

**Fix**: move penalty evaluation into a Postgres function invoked by a scheduled job (Supabase Cron
/ `pg_cron`, or a Vercel Cron hitting a Route Handler that calls the RPC with the **service role**
key), so it runs once, for everyone, on a fixed daily schedule, server-side, regardless of who is
online. Full implementation in [§5.5](#55-rpc-run_daily_penalty_sweep-server-scheduled).

### 3.5 Realtime subscription is listening for the wrong signal

`src/app/challenges/[id]/page.tsx` subscribes only to:

```ts
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'challenge_participants', filter: `challenge_id=eq.${id}` }, fetchLeaderboard)
```

Once scoring is fixed to happen via the `submit_solution()` RPC (§5.4), a new solve will indeed
produce an `UPDATE` on `challenge_participants.score`, so this part will start working — but it's
fragile: a brand-new participant **joining** the challenge produces an `INSERT`, not an `UPDATE`, on
`challenge_participants`, and today that case is handled only by a manual `window.location.reload()`
in `handleJoin`. Add an `INSERT` listener too, and drop the full-page reload in favor of local state
update (see [§7](#7-feature-roadmap-fixes--new-features) and [§15.4](#154-realtime-hook)).

### 3.6 Dead / duplicated state: two "rank" fields, two "target" fields

- `public.users.global_rank` (schema.sql/v2) is set once at signup to `'Bronze'` and never updated
  anywhere in the codebase. `src/app/page.tsx` displays it prominently as "Global Rank" on the
  dashboard — it is permanently `'Bronze'` for every user, forever. Meanwhile the *actual* rank that
  the penalty engine mutates lives on `challenge_participants.rank`, which is per-challenge. These
  are two unrelated concepts wearing the same name.
- `public.point_settings.daily_target` (edited on the Settings page) has **zero effect** on any real
  logic — the value that actually gates pass/fail is `challenges.daily_target`, set once at creation
  time and never editable afterward (there is no `UPDATE` RLS policy on `challenges` at all, so even
  a determined attacker calling the API directly cannot change it — the *absence* of a policy is
  accidentally the only thing keeping this safe). The Settings page's "Daily Target (Compulsory)"
  field is fully dead code that misleads the user into thinking they're changing challenge behavior.

**Fix**: delete `point_settings.daily_target` and `users.global_rank` entirely (see the consolidated
schema in §5), and either (a) add a real "edit challenge" flow with a proper RLS `UPDATE` policy
scoped to `created_by = auth.uid()`, or (b) make challenges explicitly immutable after creation and
say so in the UI, removing the dead Settings field.

---

## 4. 🔒 Security Audit

This section assumes an adversary who has done nothing more than open browser devtools and read
your `.env.local`'s public anon key (which is, by design, visible to anyone visiting the site).

### 4.1 RLS: Any authenticated user can overwrite any score

`schema_v2.sql`:

```sql
CREATE POLICY "Participants can update" ON public.challenge_participants
  FOR UPDATE USING (auth.role() = 'authenticated');
```

**Exploit** (from any logged-in user's browser console, zero special access required):

```js
await supabase
  .from('challenge_participants')
  .update({ score: 999999, rank: 'Diamond' })
  .eq('challenge_id', '<any-challenge-uuid>'); // even someone else's challenge
```

This policy checks *only* that the caller is logged in — not that the row belongs to them. In an app
whose entire premise is a fair head-to-head competition, this is the single most damaging finding in
the audit: **any player can silently max out their own score, or zero out an opponent's, at any
time.**

**Fix**:

```sql
-- Only the row owner can touch their own participant row, and only non-score fields.
-- Score/rank/temporary_quota must ONLY be mutated by the SECURITY DEFINER RPCs in §5.
DROP POLICY IF EXISTS "Participants can update" ON public.challenge_participants;
-- No general client-side UPDATE policy at all. All score/rank mutation goes through
-- submit_solution() / run_daily_penalty_sweep(), which run as SECURITY DEFINER and
-- bypass RLS deliberately and auditably.
```

### 4.2 Fake admin gate on Settings

`src/app/settings/page.tsx`:

```ts
const [isAdmin, setIsAdmin] = useState(false); // In a real app we might check roles, here we just let any logged in user update
...
setIsAdmin(true);
```

Combined with the matching RLS policy (`"Authenticated users can update settings" ... USING
(auth.role() = 'authenticated')`), **every signed-in user can rewrite the global point values for
every difficulty**, for every challenge in the system, at any time — this is a shared global
singleton row (`id = 1`), not per-challenge, per-user, or per-tenant. One malicious or careless user
can set `hard_points = 100000` and immediately max out their own score on the next submission (this
compounds with §4.3 below).

**Fix**: remove the `point_settings` table entirely in favor of per-challenge point configuration
(columns on `challenges`, set once at creation and immutable, exactly like `daily_target` already
is) — see the consolidated schema in §5. If you want admin-tunable global defaults later, that
requires an actual `role` column + RLS check like `USING (auth.jwt() ->> 'role' = 'admin')`, not a
hardcoded `true`.

### 4.3 Client-controlled points: trivial score forgery

`src/app/submit/page.tsx` fetches `point_settings` client-side, computes `points`, and inserts it
directly:

```ts
const { data: settings } = await supabase.from("point_settings").select("*").eq("id", 1).single();
const points = settings ? settings[`${difficulty}_points`] : ...;
await supabase.from("submissions").insert({ ..., points_earned: points });
```

Nothing on the server validates that `points_earned` actually corresponds to `difficulty`. The RLS
`INSERT` policy on `submissions` only checks `auth.uid() = user_id` — it does not check the value of
`points_earned` at all. **Any authenticated user can do this directly**, bypassing your UI entirely:

```js
await supabase.from('submissions').insert({
  user_id: (await supabase.auth.getUser()).data.user.id,
  problem_name: 'Two Sum',
  problem_url: 'https://leetcode.com/problems/two-sum/',
  difficulty: 'easy',
  points_earned: 999999,  // completely unchecked
});
```

**Fix**: never trust `points_earned` from the client. Compute it **inside** the `submit_solution()`
Postgres function from the challenge's own point configuration, and don't accept it as a client
parameter at all (full code in §5.4). Add a `CHECK` constraint as defense-in-depth:

```sql
ALTER TABLE public.submissions ADD CONSTRAINT points_earned_positive CHECK (points_earned > 0);
```

Also add **duplicate-submission protection** — right now a user can log "Two Sum" 50 times in one
day to trivially blow past any daily target:

```sql
ALTER TABLE public.submissions
  ADD CONSTRAINT unique_problem_per_user_per_day
  UNIQUE (user_id, challenge_id, problem_url, solved_date);
```

### 4.4 Email enumeration via `get_email_by_username`

`schema_v3.sql`:

```sql
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;
```

This function is callable by **unauthenticated (`anon`) visitors** and returns the exact registered
email address for any username that exists (and `NULL` for ones that don't), with no rate limiting.
This is a textbook **user-enumeration / PII-harvesting oracle**: an attacker can script through a
wordlist of usernames, harvest a full list of `{username → real email}` pairs for every user in your
system, and use that for targeted phishing or credential-stuffing against those emails elsewhere.

**Fix options, from simplest to most robust**:
1. **Rate-limit it hard** behind a Supabase Edge Function with IP-based throttling (e.g., Upstash
   Ratelimit) instead of exposing the Postgres function directly to `anon`.
2. **Don't leak existence** — always return a response, and let `signInWithPassword` fail generically
   regardless of whether the lookup succeeded, so timing/response shape doesn't reveal existence.
3. **Best**: drop username-based login entirely and log in by email (usernames remain a public
   display handle only). This removes the entire class of vulnerability. If username login is a hard
   product requirement, put it behind Supabase's native support or a CAPTCHA-gated Edge Function, and
   never grant `EXECUTE` to `anon` directly on a raw SQL function.

### 4.5 PII leak: `users` table is world-readable

`schema.sql`:

```sql
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
```

RLS policies without a `TO` clause apply to **every role**, including `anon`. Combined with the fact
that `email` lives on this same table, **anyone with your public anon key — including someone who
has never signed up — can run `supabase.from('users').select('*')` and download every user's email
address**, alongside their LeetCode handle and score. This is separate from and additive to §4.4.

**Fix**: split public-safe fields from private ones using a view, and restrict the base table:

```sql
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
CREATE POLICY "Users can view own row" ON public.users FOR SELECT USING (auth.uid() = id);

CREATE VIEW public.public_profiles AS
  SELECT id, username, leetcode_id, avatar_url, total_score, created_at
  FROM public.users;
GRANT SELECT ON public.public_profiles TO anon, authenticated;
```

Update every client query that currently does `.from('users').select('*')` for leaderboard/profile
display purposes to query `.from('public_profiles')` instead. Full migration in §5.

### 4.6 Username collisions break login

Neither `schema.sql` nor `schema_v2.sql` puts a `UNIQUE` constraint on `public.users.username`, and
`src/app/auth/page.tsx` never checks uniqueness before calling `supabase.auth.signUp()`. Two
different people can register the literal same username today. Because `get_email_by_username` does
`... WHERE LOWER(username) = LOWER(p_username) LIMIT 1` with **no `ORDER BY`**, Postgres is free to
return either matching row — meaning an existing user's login can non-deterministically start
resolving to a *different* person's email address the moment someone else registers a colliding
username, silently breaking that user's ability to log in.

**Fix**:

```sql
CREATE UNIQUE INDEX users_username_unique_idx ON public.users (LOWER(username));
ALTER TABLE public.users ADD CONSTRAINT username_format
  CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$');
```

And catch the resulting Postgres `unique_violation` in the sign-up Server Action with a friendly
"username taken" message (see §15 for the rewritten auth flow using Server Actions + Zod).

### 4.7 No rate limiting anywhere

There is no rate limiting on: login attempts, the `get_email_by_username` RPC, signups, or
submission inserts. This exposes you to credential stuffing, enumeration (§4.4), and submission-spam
score inflation (mitigated partially by the uniqueness constraint in §4.3, but still worth limiting
at the edge). Recommended: [Upstash Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
in front of any Route Handler/Server Action that touches auth or writes, using a sliding window per
IP + per user ID.

### 4.8 Session storage & CSRF posture

The app uses `@supabase/supabase-js`'s default browser session storage (`localStorage`), which is
readable by any script running on the page — meaning a single XSS bug anywhere in the app (including
in a future third-party script you add) is enough to steal a live session token. There's currently no
first-party XSS vector I found (React escapes all interpolated text; no `dangerouslySetInnerHTML`
usage anywhere in the repo), but this is a "one mistake away" posture. Migrating to
`@supabase/ssr` with `httpOnly` cookies (§6.2) removes this entire risk class and is also required to
do auth checks in `proxy.ts`/Server Components at all.

### 4.9 Data-model conflation as a security smell

`Section 3.6` already covers this functionally, but it's worth stating as a security point too: when
a "global settings" table and a "per-challenge settings" concept both claim to control the same
thing (`daily_target`), it becomes very easy to reason incorrectly about which value is authoritative
during a security review — exactly the kind of ambiguity that produces bugs like §4.2. Single source
of truth per concept is a security property, not just a tidiness one.

---

## 5. 🗄️ Data Model Redesign (Full SQL)

Stop hand-pasting `schema.sql` → `schema_v2.sql` → `schema_v3.sql` into the Supabase SQL editor.
None of these files are idempotent in the way a real migration needs to be (`CREATE TYPE` has no
`IF NOT EXISTS` guard in Postgres, for example — re-running `schema_v2.sql` on a database that
already has the `penalty_type` enum will hard-error), and there is no record of which migrations
have already been applied to which environment.

### 5.1 Adopt the Supabase CLI migration workflow

```bash
npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase migration new init_schema
# ... write SQL into supabase/migrations/<timestamp>_init_schema.sql ...
npx supabase db push
# Generate types that can never drift from the real schema:
npx supabase gen types typescript --linked > src/types/database.ts
```

This gives you: a linear, ordered history of every schema change; the ability to spin up a local
Postgres via `supabase start` for tests; and **generated TypeScript types**, which directly fixes
the drift documented in §6.4 (`database.ts` already disagrees with the live schema on nullability of
`username`, `problem_url`, etc.).

### 5.2 Consolidated schema (replaces `schema.sql` + `schema_v2.sql` + `schema_v3.sql`)

```sql
-- ============================================================================
-- 0001_init.sql — Code Clash consolidated schema
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- users: public profile row, 1:1 with auth.users
-- ----------------------------------------------------------------------------
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  username        text not null,
  leetcode_id     text,
  avatar_url      text,
  total_score     integer not null default 0,
  current_streak  integer not null default 0,
  is_admin        boolean not null default false,
  created_at      timestamptz not null default timezone('utc', now())
);

-- Case-insensitive uniqueness + format validation (fixes §4.6)
create unique index users_username_unique_idx on public.users (lower(username));
alter table public.users add constraint username_format
  check (username ~ '^[a-zA-Z0-9_]{3,20}$');

alter table public.users enable row level security;

-- Only the owner can read their own row (this table now carries email — PII)
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from public.users where id = auth.uid()));
  -- ^ prevents a user from granting themselves is_admin via a client-side update

-- Public-safe leaderboard/profile view (fixes §4.5) — no email exposed
create view public.public_profiles as
  select id, username, leetcode_id, avatar_url, total_score, current_streak, created_at
  from public.users;
grant select on public.public_profiles to anon, authenticated;

-- Auto-create a profile row on signup, capturing metadata from the client
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, username, leetcode_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'leetcode_id'
  );
  return new;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- challenges: single source of truth for rules (replaces point_settings entirely)
-- ----------------------------------------------------------------------------
create type penalty_type as enum ('none', 'minus_points', 'double_quota_next_day', 'rank_reduction', 'streak_reset');

create table public.challenges (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null check (char_length(name) between 3 and 80),
  start_date      date not null,
  end_date        date not null,
  daily_target    integer not null default 5 check (daily_target > 0),
  easy_points     integer not null default 1 check (easy_points >= 0),
  medium_points   integer not null default 2 check (medium_points >= 0),
  hard_points     integer not null default 3 check (hard_points >= 0),
  penalty_mode    penalty_type not null default 'minus_points',
  penalty_amount  integer not null default 5 check (penalty_amount >= 0),
  created_by      uuid not null references public.users(id),
  created_at      timestamptz not null default timezone('utc', now()),
  constraint end_after_start check (end_date > start_date)
);

alter table public.challenges enable row level security;
create policy "challenges_select_all" on public.challenges for select using (true);
create policy "challenges_insert_own" on public.challenges
  for insert with check (auth.uid() = created_by);
-- Only the creator can edit their own challenge, and only before it starts
create policy "challenges_update_own_before_start" on public.challenges
  for update using (auth.uid() = created_by and start_date > current_date);

-- ----------------------------------------------------------------------------
-- challenge_participants: score/rank are NEVER client-writable (fixes §4.1)
-- ----------------------------------------------------------------------------
create table public.challenge_participants (
  id                    uuid primary key default uuid_generate_v4(),
  challenge_id          uuid not null references public.challenges(id) on delete cascade,
  user_id               uuid not null references public.users(id) on delete cascade,
  score                 integer not null default 0,
  rank                  text not null default 'Novice',
  temporary_quota       integer,
  last_evaluated_date   date not null default current_date,
  created_at            timestamptz not null default timezone('utc', now()),
  unique (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;
create policy "participants_select_all" on public.challenge_participants for select using (true);
create policy "participants_insert_self" on public.challenge_participants
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id and current_date <= c.end_date
    )
  );
-- Deliberately: NO client-side UPDATE policy. Score/rank only change via the
-- SECURITY DEFINER functions below, which bypass RLS intentionally and auditably.

-- ----------------------------------------------------------------------------
-- submissions: challenge_id is now required at the type level; anti-cheat ready
-- ----------------------------------------------------------------------------
create table public.submissions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  challenge_id    uuid references public.challenges(id) on delete cascade, -- nullable = "personal log"
  problem_name    text not null check (char_length(problem_name) between 1 and 200),
  problem_url     text not null check (problem_url ~ '^https://leetcode\.com/problems/'),
  difficulty      text not null check (difficulty in ('easy', 'medium', 'hard')),
  points_earned   integer not null check (points_earned > 0),
  verified        boolean not null default false, -- see §7.1 LeetCode verification
  solved_date     date not null default current_date,
  created_at      timestamptz not null default timezone('utc', now()),
  constraint unique_problem_per_user_per_day
    unique (user_id, challenge_id, problem_url, solved_date)
);

create index submissions_challenge_user_date_idx
  on public.submissions (challenge_id, user_id, solved_date);
create index submissions_user_date_idx
  on public.submissions (user_id, solved_date);

alter table public.submissions enable row level security;
create policy "submissions_select_all" on public.submissions for select using (true);
-- Direct client INSERT is disabled entirely — all writes go through submit_solution()
-- (see §4.3). If you want to keep a client-insert escape hatch for the "no challenge"
-- personal-log case, scope it tightly:
create policy "submissions_insert_self_personal_log_only" on public.submissions
  for insert with check (auth.uid() = user_id and challenge_id is null);
create policy "submissions_delete_own" on public.submissions
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- penalty_events: durable audit trail (fixes §3.4 point 3)
-- ----------------------------------------------------------------------------
create table public.penalty_events (
  id              uuid primary key default uuid_generate_v4(),
  challenge_id    uuid not null references public.challenges(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  penalized_date  date not null,
  penalty_mode    penalty_type not null,
  score_delta     integer not null default 0,
  details         jsonb,
  created_at      timestamptz not null default timezone('utc', now()),
  unique (challenge_id, user_id, penalized_date)
);
alter table public.penalty_events enable row level security;
create policy "penalty_events_select_own" on public.penalty_events
  for select using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.challenge_participants;
```

### 5.3 What got deleted and why

| Removed | Reason |
|---|---|
| `public.point_settings` (whole table) | Superseded by per-challenge `easy_points`/`medium_points`/`hard_points` on `challenges`. Fixes §4.2 and §3.6 by construction — there is no longer a "global rules" concept to accidentally leave open to every user. |
| `public.users.global_rank` | Dead field, never updated, displayed misleadingly on the dashboard (§3.6). Rank is inherently per-challenge (`challenge_participants.rank`). |
| `get_email_by_username()` RPC | Removed in favor of email-based login (§4.4). If you truly need username login, reintroduce it behind rate limiting per §4.4's fix options — do not restore the raw un-throttled version. |
| Wide-open `SELECT`/`UPDATE` policies on `users`/`challenge_participants` | Replaced with owner-scoped policies + a public view (§4.1, §4.5). |

### 5.4 RPC: `submit_solution` (the fix for §3.1 + §3.2 + §4.3)

This single atomic, `SECURITY DEFINER` function replaces the three separate, racy, client-trusted
round-trips currently in `src/app/submit/page.tsx`. It is the **only** way a submission can be
recorded and a score can go up.

```sql
create or replace function public.submit_solution(
  p_challenge_id  uuid,
  p_problem_name  text,
  p_problem_url   text,
  p_difficulty    text
)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_challenge    public.challenges;
  v_points       integer;
  v_submission   public.submissions;
  v_is_member    boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'invalid_difficulty';
  end if;

  select * into v_challenge from public.challenges where id = p_challenge_id;
  if v_challenge is null then
    raise exception 'challenge_not_found';
  end if;

  if current_date < v_challenge.start_date or current_date > v_challenge.end_date then
    raise exception 'challenge_not_active';
  end if;

  select exists(
    select 1 from public.challenge_participants
    where challenge_id = p_challenge_id and user_id = v_user_id
  ) into v_is_member;
  if not v_is_member then
    raise exception 'not_a_participant';
  end if;

  -- Points are derived SERVER-SIDE from the challenge's own config. The client
  -- never gets to specify points_earned. This closes §4.3 completely.
  v_points := case p_difficulty
    when 'easy' then v_challenge.easy_points
    when 'medium' then v_challenge.medium_points
    else v_challenge.hard_points
  end;

  insert into public.submissions (
    user_id, challenge_id, problem_name, problem_url, difficulty, points_earned
  ) values (
    v_user_id, p_challenge_id, p_problem_name, p_problem_url, p_difficulty, v_points
  ) returning * into v_submission;
  -- The UNIQUE constraint on (user_id, challenge_id, problem_url, solved_date)
  -- will raise unique_violation for duplicate same-day submissions — catch this
  -- in the calling Server Action and surface a friendly "already logged today" error.

  -- Atomic increment — no read-modify-write race (fixes §3.3), and this is the
  -- ONLY place score ever goes UP (fixes §3.2).
  update public.challenge_participants
  set score = score + v_points
  where challenge_id = p_challenge_id and user_id = v_user_id;

  update public.users
  set total_score = total_score + v_points
  where id = v_user_id;

  return v_submission;
end;
$$;

grant execute on function public.submit_solution(uuid, text, text, text) to authenticated;
```

Call it from a Next.js Server Action (full code in §15.2), never directly from the browser:

```ts
const { data, error } = await supabase.rpc('submit_solution', {
  p_challenge_id: challengeId,
  p_problem_name: name,
  p_problem_url: url,
  p_difficulty: difficulty,
});
```

### 5.5 RPC: `run_daily_penalty_sweep` (server-scheduled)

Replaces the client-triggered `evaluatePenalties()` in `src/lib/penaltyEngine.ts` (fixes §3.4).

```sql
create or replace function public.run_daily_penalty_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  v_target integer;
  v_total_points integer;
  v_yesterday date := current_date - interval '1 day';
begin
  for p in
    select cp.*, c.daily_target, c.penalty_mode, c.penalty_amount, c.start_date, c.end_date
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
    where v_yesterday between c.start_date and c.end_date
      and cp.last_evaluated_date < v_yesterday
  loop
    v_target := coalesce(p.temporary_quota, p.daily_target);

    select coalesce(sum(points_earned), 0) into v_total_points
    from public.submissions
    where user_id = p.user_id and challenge_id = p.challenge_id and solved_date = v_yesterday;

    if v_total_points < v_target then
      insert into public.penalty_events (challenge_id, user_id, penalized_date, penalty_mode, score_delta, details)
      values (p.challenge_id, p.user_id, v_yesterday, p.penalty_mode,
              case p.penalty_mode when 'minus_points' then -p.penalty_amount else 0 end,
              jsonb_build_object('target', v_target, 'actual', v_total_points));

      if p.penalty_mode = 'minus_points' then
        update public.challenge_participants set score = score - p.penalty_amount, last_evaluated_date = v_yesterday where id = p.id;
      elsif p.penalty_mode = 'double_quota_next_day' then
        update public.challenge_participants set temporary_quota = p.daily_target * p.penalty_amount, last_evaluated_date = v_yesterday where id = p.id;
      elsif p.penalty_mode = 'rank_reduction' then
        update public.challenge_participants set rank = case rank
          when 'Diamond' then 'Platinum' when 'Platinum' then 'Gold'
          when 'Gold' then 'Silver' else 'Bronze' end, last_evaluated_date = v_yesterday where id = p.id;
      else
        update public.challenge_participants set last_evaluated_date = v_yesterday where id = p.id;
      end if;
    else
      update public.challenge_participants
      set temporary_quota = null, last_evaluated_date = v_yesterday
      where id = p.id;
    end if;
  end loop;
end;
$$;
```

Schedule it with `pg_cron` (available on all Supabase plans):

```sql
select cron.schedule('daily-penalty-sweep', '5 0 * * *', $$select public.run_daily_penalty_sweep()$$);
```

> ⏰ **Timezone note**: this runs at 00:05 UTC because `CURRENT_DATE` in Postgres uses the session/
> database timezone (UTC by default on Supabase). If your users are concentrated in one timezone,
> consider setting the database timezone accordingly, or — better — store a `timezone` preference
> per user/challenge and adjust `solved_date` bucketing client-side before it hits the DB, since a
> single global "day boundary" is inherently unfair to a global user base.

---

## 6. 🏗️ Application Architecture Redesign (Next.js 16 idiomatic)

> ⚠️ **Read this before touching routing code.** Your `AGENTS.md` file is right to warn that Next.js
> 16 has real breaking changes vs. what most training data (mine included) assumes about "Next.js."
> I verified the specifics below directly against `node_modules/next/dist/docs` in your repo rather
> than assuming — do the same for anything not covered here before implementing it.

### 6.1 `middleware.ts` is gone — you need `proxy.ts`

Confirmed from `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`: in Next.js
16, `middleware.ts` is renamed to **`proxy.ts`**, and the exported function must be named `proxy`
(not `middleware`). The `edge` runtime is **not** supported in `proxy.ts` — it always runs on
`nodejs`. Your project currently has **no middleware or proxy file at all**, which is exactly why
every page today does its own ad-hoc `getSession()` check in a `useEffect` with a jarring
`window.location.href` redirect and a flash of loading/blank content.

```ts
// proxy.ts  (project root, next to `src/`)
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PATHS = ['/', '/submit', '/settings', '/challenges'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isProtected = PROTECTED_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !user && request.nextUrl.pathname !== '/auth') {
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  if (user && request.nextUrl.pathname === '/auth') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)'],
};
```

This is an **optimistic** check only (per the official auth guide quoted in full below) — it stops
unauthenticated users from ever seeing protected HTML/JS, but every RPC/query must still be
independently protected by RLS, which Section 5 already covers.

### 6.2 Move off pure client-side Supabase to `@supabase/ssr`

Your current `src/lib/supabase.ts` is a single browser-only client. To use `proxy.ts` and Server
Components/Actions at all, you need the split client/server pattern:

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
export const createClient = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies(); // async in Next 16 — see §6.3
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // ignore — called from a Server Component, not a Server Action/Route Handler
          }
        },
      },
    }
  );
}
```

This moves the session out of `localStorage` and into `httpOnly` cookies, closing §4.8 entirely and
enabling real server-side auth checks in layouts, pages, and Server Actions.

### 6.3 Async Request APIs are now mandatory, not optional

Confirmed from the same version-16 upgrade doc: as of Next.js 16, **synchronous** access to
`cookies()`, `headers()`, `params`, and `searchParams` has been **fully removed** (Next.js 15 only
deprecated it with a temporary shim). Your dynamic route `src/app/challenges/[id]/page.tsx` currently
reads the id via the client-side `useParams()` hook, which still works in Client Components, but the
moment you convert that page to a Server Component (recommended below), you must write:

```tsx
export default async function ChallengePage(props: PageProps<'/challenges/[id]'>) {
  const { id } = await props.params; // params is a Promise now — must await it
  // ...
}
```

Run `npx next typegen` to get the `PageProps`/`LayoutProps` helper types mentioned in the official
docs, so this stays type-safe automatically instead of hand-typing `params: { id: string }`, which is
now wrong.

### 6.4 Convert data-fetching pages to Server Components + a real Data Access Layer

Per `node_modules/next/dist/docs/01-app/02-guides/data-security.md` (quoted directly from your
installed docs), Next.js explicitly recommends a **Data Access Layer (DAL)** for new projects: a
`server-only` module that performs the auth check and returns only the minimal safe data (a "DTO"),
so route files never touch `process.env` or raw table rows directly. Your project today does the
opposite everywhere — every page independently calls `supabase.from(...).select('*')` inline.

```ts
// src/data/challenges.ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const verifySession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  return user;
});

export const getChallengeWithLeaderboard = cache(async (challengeId: string) => {
  const user = await verifySession();
  const supabase = await createClient();

  const [{ data: challenge }, { data: participants }] = await Promise.all([
    supabase.from('challenges').select('*').eq('id', challengeId).single(),
    supabase
      .from('challenge_participants')
      .select('*, public_profiles(username, leetcode_id, avatar_url)')
      .eq('challenge_id', challengeId)
      .order('score', { ascending: false }),
  ]);

  return { user, challenge, participants: participants ?? [] };
});
```

```tsx
// src/app/challenges/[id]/page.tsx  (now a Server Component — no more loading spinner flash)
import { getChallengeWithLeaderboard } from '@/data/challenges';
import { LeaderboardRealtime } from './leaderboard-realtime'; // client component, see §15.4

export default async function ChallengePage(props: PageProps<'/challenges/[id]'>) {
  const { id } = await props.params;
  const { user, challenge, participants } = await getChallengeWithLeaderboard(id);
  if (!challenge) return notFound();

  return <LeaderboardRealtime challenge={challenge} initialParticipants={participants} currentUserId={user.id} />;
}
```

This also directly fixes the current waterfall (`getSession()` → then `users` fetch → then
`challenge_participants` fetch, each `await`ed sequentially in a `useEffect`) — `Promise.all` plus
server-side execution means the leaderboard's initial HTML arrives fully populated, with no client
round-trip and no loading flash, and it fixes the `any`-typed state (`useState<any>(null)`) you have
throughout `src/app/page.tsx` and `src/app/challenges/[id]/page.tsx` by using the types generated in
§5.1 end-to-end.

Realtime updates and mutations (join challenge, submit solution) still need Client Components/Server
Actions — Realtime is inherently a client-side WebSocket concern, and mutations should be Server
Actions per §6.5. The pattern is: **Server Component fetches the initial page; a small Client
Component wraps just the interactive/live part** and receives the server-fetched data as its initial
prop, exactly like `LeaderboardRealtime` above.

### 6.5 Replace direct client mutations with Server Actions

Per the data-security guide: *"Treat Server Actions with the same security considerations as
public-facing API endpoints... always re-verify inside the action."* Your current mutations
(`handleSubmit` in `submit/page.tsx`, `handleJoin` in `challenges/[id]/page.tsx`, `handleSave` in
`settings/page.tsx`) all call `supabase.from(...)` directly from the browser using the anon key —
functional today only because RLS happens to allow it (and, per §4, allows far too much of it).

```ts
// src/app/challenges/[id]/actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { verifySession } from '@/data/challenges';

const SubmitSchema = z.object({
  challengeId: z.string().uuid(),
  problemName: z.string().min(1).max(200),
  problemUrl: z.string().url().startsWith('https://leetcode.com/problems/'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export async function submitSolutionAction(formData: FormData) {
  await verifySession(); // re-authenticate inside the action — never trust the page-level check alone
  const parsed = SubmitSchema.safeParse({
    challengeId: formData.get('challengeId'),
    problemName: formData.get('problemName'),
    problemUrl: formData.get('problemUrl'),
    difficulty: formData.get('difficulty'),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_solution', {
    p_challenge_id: parsed.data.challengeId,
    p_problem_name: parsed.data.problemName,
    p_problem_url: parsed.data.problemUrl,
    p_difficulty: parsed.data.difficulty,
  });
  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/challenges/${parsed.data.challengeId}`);
  return { success: true };
}
```

This gives you, for free: server-side re-validation (closing the loophole where a user disables
client-side `required`/`type="url"` HTML validation via devtools), a single audit point for every
mutation, and `revalidatePath` cache invalidation instead of a full `window.location.reload()`.

### 6.6 Everything else in `next.config.ts` you're leaving on the table

Your `next.config.ts` is the untouched scaffold:

```ts
const nextConfig: NextConfig = { /* config options here */ };
```

At minimum for production:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactCompiler: true, // stable in Next 16 — reduces unnecessary re-renders with zero code changes
  images: {
    // `images.domains` is deprecated in Next 16 — remotePatterns is required going forward
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
```

Also worth adopting from the same upgrade doc since you're already on Next 16: `turbopack` is now
the **default and stable** builder for both `next dev` and `next build` — no config change needed —
but if you ever add a custom Webpack config, `next build` will now hard-fail instead of silently
ignoring it, so keep that in mind if you introduce e.g. a Sentry Webpack plugin later (use its
Turbopack-compatible integration instead).

---

## 7. ✨ Feature Roadmap (Fixes + New Features)

### 7.1 LeetCode verification / anti-cheat (new feature)

**This is the single highest-leverage feature you're missing.** Right now, `src/app/submit/page.tsx`
is a pure honor-system form — a user types *any* problem name, *any* URL, and picks *any* difficulty
from a `<select>`, and nothing checks that they actually solved it, or that the difficulty they
picked is even real. In an app explicitly framed as a head-to-head competition ("Destroy your
rivals"), this is a bigger integrity gap than any of the RLS holes in Section 4, because fixing the
RLS holes doesn't stop a user from simply lying in a form.

Two viable approaches, in increasing order of rigor:

1. **Difficulty cross-check (cheap, do this first)**: LeetCode exposes an unauthenticated GraphQL
   endpoint that returns a problem's canonical difficulty and title given its slug. Parse the slug out
   of the submitted URL and cross-check the client-selected difficulty server-side inside
   `submit_solution`'s calling Server Action, rejecting mismatches. This alone stops the "log a Hard
   as Easy... wait, log an Easy as Hard for more points" class of cheating.
2. **Full verification (do this next)**: LeetCode's GraphQL API also exposes a user's recent accepted
   submissions by username (`recentAcSubmissionList`). At submission time, fetch the target user's
   recent ACs (stored `leetcode_id` from their profile) and only accept the submission if a matching,
   recently-accepted problem is found. Mark the row `verified = true` (column already added in §5.2)
   and consider only counting `verified` submissions toward challenge scoring — this makes the
   leaderboard trustworthy without requiring OAuth into LeetCode itself (which they don't offer
   publicly anyway).

```ts
// src/lib/leetcode.ts  (server-only)
import 'server-only';

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

export async function getProblemMeta(slug: string) {
  const res = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query getQ($slug: String!) { question(titleSlug: $slug) { title difficulty } }`,
      variables: { slug },
    }),
    next: { revalidate: 3600 }, // problem difficulty essentially never changes
  });
  const json = await res.json();
  return json?.data?.question as { title: string; difficulty: 'Easy' | 'Medium' | 'Hard' } | null;
}

export async function hasRecentAccept(leetcodeUsername: string, titleSlug: string) {
  const res = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query recent($username: String!) {
        recentAcSubmissionList(username: $username, limit: 20) { titleSlug timestamp }
      }`,
      variables: { username: leetcodeUsername },
    }),
    cache: 'no-store',
  });
  const json = await res.json();
  const list = json?.data?.recentAcSubmissionList ?? [];
  return list.some((s: { titleSlug: string }) => s.titleSlug === titleSlug);
}
```

> This is an unofficial, undocumented endpoint used widely by the LeetCode-tracker community — treat
> it as best-effort (cache aggressively, fail open with a "pending verification" state rather than
> blocking submission entirely if LeetCode is unreachable, and revisit if LeetCode ever publishes an
> official API or changes this contract).

### 7.2 Fix the submit flow to select an active challenge

Directly required by §3.1. The submit page needs to fetch the user's active `challenge_participants`
rows (via the DAL) and render a `<select>` (or "personal log, not tied to a challenge" default),
passing the chosen `challengeId` into `submit_solution`. Full rewritten component in §15.3.

### 7.3 Make `current_streak` real

The column exists on `users` and is displayed nowhere and computed nowhere. Compute it as part of
`run_daily_penalty_sweep` (§5.5): increment `current_streak` for a user on any day they meet at least
one challenge's target, reset to `0` on a missed day with no verified submissions at all. Surface it
on the dashboard next to the (currently unused) `Flame` icon already imported but unused in
`src/app/page.tsx`.

### 7.4 Global activity feed

You already store every submission; you're just not rendering them anywhere outside a single
challenge's calendar. A simple `/activity` Server Component page — `select * from submissions join
public_profiles ... order by created_at desc limit 50` — combined with a Realtime subscription on
`INSERT` gives you a "live feed" that reads well for a competitive product and costs almost nothing
given the schema already supports it.

### 7.5 Notifications

At minimum: an in-app toast/badge when a `penalty_events` row is inserted for the current user (via
Realtime `INSERT` subscription — no polling needed), and a daily reminder email (Supabase supports
sending transactional email via an Edge Function + Resend/Postmark) a few hours before the UTC day
boundary if the user hasn't hit `daily_target` yet. This is a natural extension of `penalty_events`
existing as a durable table rather than a fire-and-forget client mutation.

### 7.6 Admin roles, if you intend to scale beyond 1v1

`is_admin` is already added to the consolidated `users` schema in §5.2 as a forward-compatible hook.
If/when you need real moderation (banning cheaters, editing a challenge after it starts, viewing
global analytics), gate it with `USING (exists (select 1 from users where id = auth.uid() and
is_admin))` policies rather than the current `auth.role() = 'authenticated'` pattern, which — as
Section 4 demonstrates — means "admin" today.

### 7.7 Pagination & challenge discovery

Right now every challenge is invite-link-only (via its UUID) and every query is unbounded (`select
*` with no `.range()`/`.limit()`). Fine at your current scale; add `.range()`-based pagination to the
leaderboard and a public "browse open challenges" view before this becomes a real product with more
than a handful of concurrent players.

### 7.8 PWA / daily reminder push

Given the entire mechanic is "did you hit your daily target," a installable PWA with a scheduled
local/push notification ("2 hours left, you're 3 points short today") is a very natural fit and
directly reduces the number of people who get penalized for simply forgetting — pairs well with
§7.5.

---

## 8. 🎨 UI/UX & Accessibility Audit

- **Toast system (`src/components/ui/Toast.tsx`)**: the container has no `role="status"`/`aria-live`
  region, so screen readers never announce success/error toasts at all. `Math.random().toString(36)`
  for IDs is fine for this low-stakes use, but prefer `crypto.randomUUID()` (available in all modern
  browsers and Node) for correctness. `.substr()` is a legacy/deprecated method — use `.slice()`.
- **No `error.tsx`, `not-found.tsx`, or `loading.tsx`** anywhere in `src/app/`. A thrown error in any
  Server Component today produces Next's default unstyled error screen instead of your branded UI.
  Add at least a root `src/app/error.tsx` and `src/app/not-found.tsx`, plus per-segment `loading.tsx`
  for `challenges/[id]` so the leaderboard shows a skeleton instead of nothing during the initial
  server fetch.
- **No mobile navigation.** `src/app/layout.tsx`'s header is a `display:flex; justify-content:
  space-between` row with no wrap/collapse behavior — on a narrow viewport, "Dashboard / Log Problem
  / Settings" will overflow or crowd against the logo. No hamburger menu, no responsive breakpoints
  in `globals.css` at all (the only media queries in the repo are in the *unused* `page.module.css`).
- **Color contrast**: `--foreground: #f8f9fa` on `--background: #0f111a` is comfortably AA/AAA. The
  secondary text color `#a1a1aa` used for descriptions on the dark `--surface: #1e1e2f` background is
  borderline — run it through a contrast checker (WCAG AA requires 4.5:1 for normal text) before
  shipping, especially for the "Rules of Engagement" list and calendar tooltips which use it.
- **`window.location.href` for every navigation/redirect** (`auth/page.tsx`, `page.tsx`,
  `submit/page.tsx`, `settings/page.tsx`, `challenges/[id]/page.tsx`) forces a full document reload
  on every login, logout, and challenge join, discarding all of Next's client-side navigation
  benefits and causing a visible white-flash on every transition. Replace with `redirect()` (Server
  Actions) or `useRouter().push()` (Client Components) per §6.
- **Inline styles everywhere** (literally hundreds of `style={{ ... }}` objects across every page)
  instead of the utility classes already defined in `globals.css` or CSS Modules — this is a
  maintainability problem more than a correctness one, but it means design tweaks (spacing, colors)
  require hunting through JSX instead of one stylesheet, and it defeats CSS specificity/cascade
  benefits. Recommend consolidating into either the existing hand-rolled CSS classes or adopting
  Tailwind for anything net-new.
- **`alert()` used for the invite-link copy confirmation** in `challenges/[id]/page.tsx`
  (`handleCopyLink`) — a native browser `alert()` blocks the main thread and looks completely out of
  place next to your custom Toast system that already exists; swap it for `showToast(...)`.
- **Unused imports** signal unfinished features: `Flame` and `Target` are imported into
  `src/app/page.tsx` but never rendered — exactly the icons you'd want for the still-uncomputed
  `current_streak` (§7.3) and `daily_target` display.

---

## 9. 🧪 Testing Strategy

There is currently no test runner, no test files, and no CI configuration in the repository at all.
For a project whose entire value is "trustworthy scoring," this is a real gap — the score bug in
§3.1/§3.2 is exactly the kind of regression a single integration test would have caught on day one.

### 9.1 Unit tests — extract pure logic first

`src/lib/penaltyEngine.ts` currently mixes Supabase I/O with the actual day-diffing/penalty-selection
logic, making it nearly impossible to unit test without a live database. Once penalty logic moves
into the `run_daily_penalty_sweep` SQL function (§5.5), test **that** with `pgTAP` (Supabase's
recommended SQL-level testing tool) directly against a local `supabase start` instance:

```sql
-- supabase/tests/penalty_sweep.test.sql
begin;
select plan(2);

-- Arrange: a participant who missed yesterday's target
-- ... insert fixture rows ...

select public.run_daily_penalty_sweep();

select is(
  (select score from public.challenge_participants where id = '<fixture-id>'),
  95, -- 100 - 5 penalty
  'minus_points penalty applied correctly for a missed day'
);
select is(
  (select count(*)::int from public.penalty_events where user_id = '<fixture-user>'),
  1,
  'exactly one penalty_event row is recorded, not zero and not duplicated'
);

select * from finish();
rollback;
```

### 9.2 Recommended stack

| Layer | Tool | Why |
|---|---|---|
| Unit (JS/TS logic) | **Vitest** | Fast, native ESM/TS support, works cleanly with Next 16 + Turbopack |
| SQL/RLS/RPC | **pgTAP** via `supabase test db` | Tests run against a real local Postgres, catching exactly the class of bug in §3–§5 |
| Component | **React Testing Library** + Vitest | For Toast, forms, leaderboard row rendering |
| E2E | **Playwright** (Next's own docs list it alongside Cypress) | Full signup → create challenge → submit solution → verify score increased flow |

### 9.3 Minimum E2E smoke suite (would have caught every §3 bug)

1. Register user A and user B.
2. User A creates a challenge with `daily_target = 5`, `easy_points = 1`.
3. User A joins automatically; user B joins via invite link.
4. User A submits 5 "easy" problems for that challenge.
5. **Assert**: user A's `challenge_participants.score` for that challenge is now `5` (would have
   failed against the current code, since score never goes up at all — this is the single most
   valuable test you could write today).
6. Run the (mocked-forward-in-time) penalty sweep for a day user B did nothing.
7. **Assert**: user B's score dropped by the configured penalty amount, and exactly one
   `penalty_events` row exists for that day.

### 9.4 CI pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.9', cache: 'npm' }
      - run: npm ci
      - run: npx eslint .
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npx supabase start && npx supabase test db
      - run: npm run build
```

Node **20.9+** is a hard requirement per the Next.js 16 upgrade doc (Node 18 is no longer supported)
— pin this explicitly in CI and in a `"engines"` field in `package.json` so a contributor on an old
Node version gets a clear error instead of a confusing build failure.

---

## 10. ⚡ Performance & Scalability

- **Sequential `await` waterfalls** in every page (`getSession()` → then a `users` query → then a
  `challenge_participants` query, each blocking the next) should become `Promise.all([...])` at
  minimum, or disappear entirely once moved server-side per §6.4 (a Server Component can fetch in
  parallel and stream the result as one response instead of three round-trips from the browser).
- **No pagination anywhere.** `challenge_participants` and `submissions` queries all fetch unbounded
  result sets. Fine today at hobby scale; add `.range(0, 49)`-style pagination before a challenge
  grows past a few dozen participants or a few hundred submissions.
- **No caching of anything.** Next.js 16's `cacheComponents` config (formerly experimental PPR) and
  the now-stable `cacheLife`/`cacheTag`/`use cache` directives are a good fit for genuinely
  semi-static reads like a challenge's rules (`name`, `start_date`, `penalty_mode` — these never
  change after creation per §3.6's immutability fix), while leaving the live leaderboard itself
  dynamic/uncached.
- **Realtime channel churn**: `challenges/[id]/page.tsx` creates a new channel named
  `` `challenge-${id}-${Date.now()}` `` on every mount — fine for correctness (guarantees uniqueness)
  but means remounting the component (e.g., via Fast Refresh in dev, or a key change) leaks the old
  channel if the cleanup function doesn't run in time. Double-check `removeChannel` always fires by
  testing rapid navigation between two challenge pages.
- **`next/image` not used at all** — `avatar_url` values are never rendered through `next/image`
  anywhere in the current pages (no avatar image is displayed yet), but when you do add one, remember
  `images.domains` is deprecated in Next 16 in favor of `images.remotePatterns` (already reflected in
  the `next.config.ts` proposal in §6.6).

---

## 11. 📈 Observability & Operations

You currently have zero error tracking — every failed Supabase call in the codebase either shows a
generic `alert()`/toast or is silently swallowed (many `const { data } = await supabase...` calls
destructure only `data`, discarding `error` entirely, e.g. in `src/app/page.tsx`'s
`fetchUserAndData` and `src/app/challenges/[id]/page.tsx`'s `init`). This means a production RLS
misconfiguration or a Supabase outage would currently manifest to you only as vague user complaints.

**Minimum viable observability stack**:
1. **Sentry** (or an equivalent) wired into both client and server — Next.js 16 has first-class
   Sentry integration docs; use their Turbopack-compatible SDK setup given webpack configs now hard-
   fail `next build` per §6.6.
2. **Never silently discard `{ error }`** from a Supabase call again — at minimum log it
   (`console.error` is a start; Sentry capture is better), and surface a user-facing message via the
   existing Toast system rather than showing a misleading empty state (e.g., "Challenge not found"
   when the real cause was an RLS-denied query or a network failure).
3. **Supabase's own dashboard logs** (Postgres logs, Auth logs, Realtime logs) — turn on log
   drains/alerts for spikes in `permission denied` errors, which is exactly the signal you'd see if
   someone starts probing the RLS holes in Section 4 before you patch them.
4. **Structured audit log**: `penalty_events` (§5.2) already gives you this for scoring; consider a
   similar lightweight `admin_actions` table once §7.6 (admin roles) exists.

---

## 12. 🚀 DevOps, CI/CD & Deployment Hardening

### 12.1 Environment variable hygiene

`src/lib/supabase.ts` today:

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Silently falling back to an empty string means a missing env var fails **later, cryptically**, deep
inside `supabase-js`'s network layer, instead of at startup with a clear message. Validate eagerly:

```ts
// src/lib/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export const env = EnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
```

This throws a clear, specific error the moment the app boots with a misconfigured environment,
instead of a confusing runtime fetch failure three clicks into the app.

Add a **`.env.example`** (currently missing) so anyone cloning the repo — including future-you on a
new machine — knows exactly which variables are required without reverse-engineering `lib/supabase.ts`:

```env
# .env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 12.2 Migration & deployment workflow

Replace "paste `schema.sql`, then `schema_v2.sql`, then `schema_v3.sql` into the Supabase SQL editor"
with the CLI workflow in §5.1, wired into CI: `supabase db push` against a staging project on merge
to a `staging` branch, and a manual promotion step (or a GitHub Actions environment gate) before
pushing to production. Never hand-run SQL against production directly again once this exists.

### 12.3 `next.config.ts` hardening

Already detailed in full in §6.6 — security headers, `remotePatterns`, `poweredByHeader: false`.

### 12.4 License & repo hygiene

`README.md` claims `MIT` license with a badge, but **there is no `LICENSE` file in the repository**.
If you intend this to be MIT-licensed (or public at all), add the actual `LICENSE` file — an
unlicensed public repo is technically "all rights reserved" by default regardless of what a badge
claims, which matters if you ever want contributions or reuse.

### 12.5 Deployment checklist (condensed)

- [ ] All Section 4 RLS fixes applied and re-verified with the Supabase dashboard's policy simulator
- [ ] `supabase gen types typescript` run and committed — no hand-maintained `database.ts` drift
- [ ] `pg_cron` job for `run_daily_penalty_sweep` confirmed running (check `cron.job_run_details`)
- [ ] `.env.example` committed; real secrets confirmed absent from git history (`git log -p -- .env*`)
- [ ] Security headers verified live via `curl -I` against the deployed URL
- [ ] Sentry (or equivalent) receiving events from a deliberate test error in both client and server
- [ ] CI green on lint + typecheck + unit + pgTAP + build before merging to `main`
- [ ] `LICENSE` file matches the README's claim

---

## 13. 📦 Dependency & Tooling Audit

### 13.1 Next.js 16 + React 19.2: you are on the bleeding edge

Your `AGENTS.md` explicitly states: *"This is NOT the Next.js you know — APIs, conventions, and file
structure may all differ from your training data."* I took that seriously for this audit: every
Next.js-specific claim in Sections 6 and 12 above was verified directly against the docs shipped in
your own `node_modules/next/dist/docs`, not recalled from general training knowledge, specifically
because:

- `middleware.ts` → `proxy.ts` rename (§6.1)
- Fully mandatory async `params`/`cookies()`/`headers()` (§6.3)
- `next lint` removed entirely — you must invoke `eslint` directly (your `package.json`'s `"lint":
  "eslint"` script is, happily, already correct for Next 16 — don't "fix" it back to `next lint`)
- Turbopack now default for both `dev` and `build`
- `images.domains` deprecated in favor of `remotePatterns`
- PPR replaced by the `cacheComponents` config flag

All of these are **breaking or semantic changes** versus Next.js 14/15, which is what most public
tutorials, Stack Overflow answers, and (likely) any AI assistant's default training data will assume.
**Any time you or a future AI coding assistant touches routing, caching, or the `params`/`cookies`
APIs, re-check `node_modules/next/dist/docs` (or the live Next.js changelog) first** rather than
trusting memorized patterns — this project is genuinely outside the range most tooling assumes by
default.

### 13.2 Verify the `lucide-react` version pin

`package.json` pins `"lucide-react": "^1.23.0"`. This is worth a manual double-check next time you
run `npm outdated` — historically `lucide-react` has shipped versions in the 0.3xx–0.4xx range, so a
`1.x` line is either a newer major release (post-dating this audit's ability to verify from training
knowledge) or worth confirming resolves to the icon set/API you expect (`Trophy`, `Flame`, `Swords`,
etc. are all used in your code — confirm they still exist under whatever major version actually
installs) via `npm ls lucide-react` and the installed package's own changelog.

### 13.3 Missing dependencies you should add

| Package | Purpose |
|---|---|
| `zod` | Server-side input validation (Server Actions, RPC parameter shaping) — currently zero validation anywhere |
| `@supabase/ssr` | Required for the cookie-based auth model in §6.2 |
| `vitest`, `@testing-library/react` | Unit/component testing (§9) |
| `@playwright/test` | E2E testing (§9) |
| `server-only` | Enforce the DAL boundary in §6.4 at build time, not just by convention |
| `@upstash/ratelimit`, `@upstash/redis` | Rate limiting (§4.7) |
| `eslint-plugin-jsx-a11y` | Catch accessibility regressions (§8) automatically in CI |

---

## 14. 🗺️ Prioritized Roadmap (Phased Execution Plan)

### Phase 0 — Stop the bleeding (do before any real user touches this again)

- [ ] Lock down `challenge_participants` UPDATE policy (§4.1) — this is actively exploitable today
- [ ] Remove the fake admin gate + `point_settings` global-write policy (§4.2)
- [ ] Add `points_earned > 0` CHECK + duplicate-submission UNIQUE constraint (§4.3)
- [ ] Rate-limit or remove `get_email_by_username` (§4.4)
- [ ] Restrict `users` SELECT + introduce `public_profiles` view (§4.5)
- [ ] Add `UNIQUE (LOWER(username))` (§4.6)

### Phase 1 — Make the product actually work (the core bug)

- [ ] Ship the consolidated schema + `submit_solution` + `run_daily_penalty_sweep` RPCs (§5)
- [ ] Rewrite the submit flow to select a challenge and call the RPC (§7.2, §15.3)
- [ ] Wire `pg_cron` for the daily sweep (§5.5)
- [ ] Migrate off hand-run SQL files to `supabase/migrations` (§5.1)
- [ ] Write the E2E smoke test from §9.3 and confirm it passes end-to-end

### Phase 2 — Architecture modernization

- [ ] Introduce `@supabase/ssr` + `proxy.ts` (§6.1, §6.2)
- [ ] Convert dashboard/challenge pages to Server Components + DAL (§6.4)
- [ ] Convert mutations to Server Actions with Zod validation (§6.5)
- [ ] Regenerate `database.ts` via `supabase gen types typescript` and delete the hand-written version
- [ ] Harden `next.config.ts` (§6.6)

### Phase 3 — Trust & quality

- [ ] LeetCode difficulty cross-check, then full verification (§7.1)
- [ ] CI pipeline: lint, typecheck, Vitest, pgTAP, build (§9.4)
- [ ] Sentry + stop silently discarding `{ error }` everywhere (§11)
- [ ] Accessibility pass: toast `aria-live`, mobile nav, contrast check (§8)

### Phase 4 — Feature expansion

- [ ] `current_streak` computation (§7.3)
- [ ] Global activity feed (§7.4)
- [ ] Notifications / daily reminders (§7.5)
- [ ] Admin roles (§7.6), pagination + challenge discovery (§7.7)
- [ ] PWA + push reminders (§7.8)

---

## 15. Appendix: Ready-to-use Code

### 15.1 `.env.example`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 15.2 Zod schemas (`src/lib/schemas.ts`)

```ts
import { z } from 'zod';

export const SignupSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, 'Letters, numbers, underscore only, 3-20 chars'),
  email: z.string().email(),
  leetcodeId: z.string().min(1).max(50),
  password: z.string().min(8, 'At least 8 characters')
    .regex(/[0-9]/, 'At least one number')
    .regex(/[^a-zA-Z0-9]/, 'At least one special character'),
});

export const CreateChallengeSchema = z.object({
  name: z.string().min(3).max(80),
  startDate: z.string().date(),
  endDate: z.string().date(),
  dailyTarget: z.number().int().positive(),
  easyPoints: z.number().int().min(0),
  mediumPoints: z.number().int().min(0),
  hardPoints: z.number().int().min(0),
  penaltyMode: z.enum(['none', 'minus_points', 'double_quota_next_day', 'rank_reduction', 'streak_reset']),
  penaltyAmount: z.number().int().min(0),
}).refine((v) => v.endDate > v.startDate, { message: 'End date must be after start date', path: ['endDate'] });

export const SubmitSolutionSchema = z.object({
  challengeId: z.string().uuid().nullable(), // null = personal log
  problemName: z.string().min(1).max(200),
  problemUrl: z.string().url().startsWith('https://leetcode.com/problems/'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});
```

### 15.3 Rewritten `submit/page.tsx` (fixes §3.1, §7.2)

```tsx
// src/app/submit/page.tsx
import { getMyActiveChallenges } from '@/data/challenges';
import { SubmitForm } from './submit-form'; // client component holding the interactive form

export default async function SubmitPage() {
  const activeChallenges = await getMyActiveChallenges(); // server-fetched, no waterfall
  return <SubmitForm activeChallenges={activeChallenges} />;
}
```

```tsx
// src/app/submit/submit-form.tsx
'use client';

import { useActionState } from 'react';
import { submitSolutionAction } from './actions';

export function SubmitForm({ activeChallenges }: { activeChallenges: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(submitSolutionAction, undefined);

  return (
    <form action={action} className="card glass">
      <div className="form-group">
        <label className="form-label">Challenge</label>
        <select name="challengeId" className="form-select" defaultValue="">
          <option value="">Personal log (no challenge)</option>
          {activeChallenges.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {/* problemUrl / problemName / difficulty fields unchanged from the original UI */}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Logging…' : 'Submit Problem'}
      </button>
      {state?.error?._form && <p className="form-error">{state.error._form[0]}</p>}
    </form>
  );
}
```

### 15.4 Realtime leaderboard client wrapper

```tsx
// src/app/challenges/[id]/leaderboard-realtime.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type Participant = Database['public']['Tables']['challenge_participants']['Row'];

export function LeaderboardRealtime({
  challenge,
  initialParticipants,
  currentUserId,
}: {
  challenge: Database['public']['Tables']['challenges']['Row'];
  initialParticipants: Participant[];
  currentUserId: string;
}) {
  const [participants, setParticipants] = useState(initialParticipants);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`challenge-${challenge.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'challenge_participants', filter: `challenge_id=eq.${challenge.id}` },
        async () => {
          const { data } = await supabase
            .from('challenge_participants')
            .select('*, public_profiles(username, leetcode_id, avatar_url)')
            .eq('challenge_id', challenge.id)
            .order('score', { ascending: false });
          setParticipants(data ?? []);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [challenge.id]);

  // render `participants`, unchanged visual design from the original page
  return null; // placeholder — port your existing JSX from the original component here
}
```

Note the listener above uses `event: '*'` instead of `'UPDATE'` only, so both a brand-new participant
`INSERT` (joining) and a score `UPDATE` (solving/penalty) both trigger a refetch — this fixes §3.5.

---

**End of audit.** Sections 3, 4, and 5 are the load-bearing ones — everything else compounds on top
of a correct, secure foundation. If you only do one thing from this document, ship the
`submit_solution` RPC in §5.4 and lock down the `challenge_participants` UPDATE policy in §4.1; those
two changes alone take the app from "the leaderboard doesn't work and anyone can cheat it" to "the
leaderboard works and only the server can write scores."
