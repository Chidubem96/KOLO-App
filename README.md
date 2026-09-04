# Kolo — V1 (deployable)

A consumer money app for Nigeria. Shows the one honest number — **Safe to Spend** —
with a personal ledger, goals, an alert/statement auto-logger, a guardrailed
"Ask Kolo" assistant, and **ajo circles that sync live between friends**.

- **Frontend + API:** Next.js 14 (App Router), deploy to Vercel
- **Data + auth + realtime:** Supabase (Postgres)
- **Adviser + alert parsing:** Anthropic API (server-side only)

Everything a user enters lives in their own account. Circles are shared with
whoever has the circle's 6-letter code. There is **no escrow / money movement** in
V1 — contributions are *recorded*, not moved.

---

## Deploy in ~20 minutes

You need three free accounts: **Supabase**, **Vercel**, **Anthropic**.

### 1. Supabase

1. Create a project at <https://supabase.com/dashboard> (any region near your users; free tier is fine).
2. Open **SQL Editor → New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), click **Run**, then do the same with
   [`supabase/schema-v2.sql`](supabase/schema-v2.sql) (Discover, disputes, guarantee
   fund, Grow, identity). Both are safe to re-run.
3. **Authentication → Sign In / Providers → Email**: keep **Email** enabled, and
   turn **Confirm email** *off* (so first sign-in is one step). Leave "Enable email
   OTP" on (default).
4. **Authentication → Emails → Templates → Magic Link**: the app asks users for a
   **6-digit code**, not a link, so replace the template body with:

   ```html
   <h2>Your Kolo code</h2>
   <p>Enter this code to sign in:</p>
   <p style="font-size:26px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   ```

5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### 2. Anthropic

1. Create a key at <https://console.anthropic.com/settings/keys>.
2. Add a little credit (the adviser + parser use small requests).

### 3. Run locally (optional but recommended)

```bash
cp .env.local.example .env.local     # then fill in the three values
npm install
npm run dev                          # http://localhost:3000
```

### 4. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. <https://vercel.com/new> → import the repo (Vercel auto-detects Next.js).
3. Add the environment variables (**Settings → Environment Variables**), all three:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon public key |
   | `ANTHROPIC_API_KEY` | your Anthropic key |

4. Deploy. Send the resulting `https://your-app.vercel.app` URL to your friends.
5. Back in Supabase → **Authentication → URL Configuration**, add your Vercel URL to
   **Site URL** / redirect allow-list (the OTP-code flow doesn't strictly need it,
   but set it anyway).

---

## How testing works

- A friend opens the URL, enters name + email, gets a **6-digit code** by email, and is in.
- They set up accounts / income (3 steps), then land on **Safe to Spend**.
- **Money tab → Paste an alert**: paste a real bank debit SMS; Claude extracts it,
  they confirm the category. **Import statement** takes a CSV export.
- **Circles**: one person taps **＋**, creates a circle, and shares the **6-letter code**.
  Everyone else taps **Find**, enters the code, joins. Contributions and the roster
  update live for everyone.
- Recurring obligations (and circle contributions with auto-debit on) post
  themselves on their due dates.

## The adviser guardrail

`src/app/api/adviser/route.ts` sends the user's question plus a JSON of
engine-computed figures to Claude with hard rules: narrate only, never compute a
new number. The reply is then scanned (`src/lib/adviser.ts`) — any money-shaped
number not traceable to that JSON or the question fails the message, and the user
sees the engine's own read instead, flagged.

## Project map

```
supabase/schema.sql        tables, RLS, circle RPCs, realtime
src/lib/engine.ts          Safe-to-Spend, accruals, circle math, parsers (pure)
src/lib/askContext.ts      builds the JSON the adviser is allowed to quote
src/lib/adviser.ts         prompt + numeral guardrail (client + server)
src/lib/api.ts             Supabase reads/writes + row→domain mappers
src/lib/store.tsx          load, realtime, recurring auto-post
src/app/api/adviser        Anthropic call for "Ask Kolo"
src/app/api/parse          Anthropic call for alert parsing
src/components/…            screens + sheets (ported from the prototype)
```

## Known V1 limits

- No escrow / payments. Circles record contributions; nothing moves money.
- No bank linking. Data comes from manual entry, pasted alerts, and CSV import.
- `next.config.mjs` sets `ignoreBuildErrors` / `ignoreDuringBuilds` so a stray
  type/lint issue never blocks a deploy. Flip them off once it's stable.
- Circle slot assignment on join is "next free number", not chosen.
