# TapReview Pilot — Claude Code Build Guide

A complete, self-contained brief for building the **TapReview pilot** (Milestone 0) with Claude Code and deploying it to Vercel. The pilot is a hand-built, single-business mock: a customer scans a QR, rates the café, taps a few words, and gets a generated Google review to copy and post. It exists to measure **one number** — of everyone who opens the page, what share posts a review.

Example business throughout: **Kaapi Katte**, a café in Koramangala, Bangalore.

---

## 0. Launch prompt (paste this into Claude Code to start)

```
Read BUILD_GUIDE.md in the project root and build the TapReview pilot exactly as specified.

Work through the sections in order:
  1. Scaffold the Next.js app (Section 5.1).
  2. Create each file using the code in Sections 5.2–5.6.
  3. Make the four screens match the design system in Section 4 and the
     screen specs in Section 5.5.
  4. Wire up environment variables (Section 6) and the analytics events.
  5. Run it locally so I can test on my phone, then walk me through
     deploying to Vercel (Section 7).

Rules:
  - Follow Section 2 (Hard guardrails) without exception.
  - Ask me for the real Google Place ID, my Anthropic API key, and my
    PostHog key when you need them — do not invent them.
  - Stop and confirm with me before deploying or before running any
    command that spends money.

Start with Section 5.1 and tell me what you're doing at each step.
```

---

## 1. Goal and definition of done

**Goal:** the cheapest possible test of the one assumption the whole product rests on — that people will actually complete the post to Google.

**Done when:**
- The app is deployed on Vercel at a public URL.
- A QR code points to it, and it works end-to-end on a real phone.
- Analytics events fire at every step, logged to a Postgres table, so the funnel can be read with SQL.
- The baseline Google review count for the café has been recorded (to cross-check actual posts).

**The number to read after a week:** `post-completion rate = new Google reviews ÷ page opens`.

---

## 2. Hard guardrails (never violate)

These are product-defining, not preferences. If a task seems to require breaking one, stop and flag it.

1. **No review gating.** Every rating — 1 star or 5 — reaches the *same* public Google post path. Never route low ratings to a private form or block anyone from posting. (In this build there is a single `copyAndPost` path; keep it that way.)
2. **No fabricated experience.** The generated review asserts **only** what the customer tapped. The generation system prompt forbids inventing any dish, name, claim, or sentiment. Do not weaken it.
3. **No automated posting.** The customer copies and pastes into Google themselves. Never attempt to submit a review via API or automation.
4. **No scraping.** For the pilot, all business data is hard-coded in one file. Do not scrape Google, Swiggy, Zomato, or anywhere else.
5. **No secrets on the client.** The Anthropic API key and `DATABASE_URL` are used only in server routes. Never expose them in client code or commit them to the repo.

---

## 3. Tech stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS (mobile-first; design for a 390px-wide phone)
- **LLM:** Anthropic Messages API via `@anthropic-ai/sdk`, model **`claude-haiku-4-5`** (fast and cheap — right for latency-critical generation)
- **Analytics:** your own Postgres `events` table via the `postgres` client — events logged through a server route and queried with SQL. Works with any host (Supabase, Neon, or Vercel Postgres)
- **Hosting:** Vercel
- **Fonts:** Poppins via `next/font` (matches the PRD mockups)

---

## 4. Design system (match the mockups)

Use these exact tokens so the app matches the four screenshots in the PRD. They are given as Tailwind arbitrary values (e.g. `bg-[#1767ad]`).

| Token | Hex | Use |
| --- | --- | --- |
| Page background | `#eeece5` | behind the phone/card |
| Surface | `#ffffff` | the screen |
| Ink | `#1a1a18` | primary text |
| Subtle | `#67665e` | secondary text / labels |
| Muted | `#9a9a8e` | captions, placeholders |
| Border | `#d3d1c7` | chip and box outlines |
| Accent | `#1767ad` | primary buttons, selected aspect chips, links |
| Accent bg | `#e6f1fb` | selected aspect chip fill |
| Star | `#ef9f27` | filled stars |
| Star off | `#d6d4cb` | empty stars |
| Item accent | `#0f6e56` | selected menu-item chip text |
| Item bg | `#eaf3ee` | selected menu-item chip fill |
| Success bg | `#dcf4ec` | "copied" check circle |

- Chips are pill-shaped (`rounded-full`), ~`px-4 py-2`, selected state filled + a `✓`.
- Primary buttons: `bg-[#1767ad] text-white rounded-2xl py-4 font-medium`.
- Phone frame: center a `max-w-[430px]` white column on the page background.

---

## 5. Build steps

### 5.1 Scaffold

```bash
npx create-next-app@latest tapreview-pilot --typescript --tailwind --app --eslint
cd tapreview-pilot
npm i @anthropic-ai/sdk postgres
```

Accept defaults (App Router, `src/` optional — this guide assumes no `src/`, so files live at the repo root under `app/` and `lib/`).

### 5.2 Business config — `lib/business.ts`

This file **is** the chip pipeline for the pilot. Hand-write it. Each aspect has a positive and a negative label; the app shows one based on the rating.

```ts
export const BUSINESS = {
  name: "Kaapi Katte",
  locality: "Koramangala, Bangalore",
  // Get this from Google's "Place ID Finder". Ask the user for the real value.
  placeId: "PUT_REAL_PLACE_ID_HERE",
  aspects: [
    { key: "staff",   pos: "Friendly staff",  neg: "Unfriendly staff" },
    { key: "coffee",  pos: "Great coffee",     neg: "Weak coffee" },
    { key: "vibe",    pos: "Cozy vibe",        neg: "Noisy vibe" },
    { key: "speed",   pos: "Quick service",    neg: "Slow at peak" },
    { key: "value",   pos: "Good value",       neg: "Overpriced" },
    { key: "seating", pos: "Laptop-friendly",  neg: "Cramped seating" },
  ],
  items: ["Filter coffee", "Cold coffee", "Croissant", "Masala chai"],
} as const;
```

### 5.3 Generation endpoint — `app/api/generate/route.ts`

The system prompt is the honesty constraint — the heart of the product. Do not weaken it.

```ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export async function POST(req: Request) {
  const { rating, aspects, items, tone, length } = await req.json();
  const chips = [
    ...aspects,
    ...items.map((i: string) => `item: ${i}`),
  ].join(", ");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 250,
    system:
      "Write a first-person Google review that asserts ONLY the experiences named by the " +
      "provided chips. Weave them into varied, natural prose. You MUST NOT add any claim, " +
      "detail, dish, name, or sentiment the chips do not state. Do not invent staff names or " +
      "specific interactions. Match the requested tone and length. Vary sentence structure so " +
      "repeated generations differ. Return plain text only, no quotes or preamble.",
    messages: [
      {
        role: "user",
        content: `Chips: ${chips}\nRating: ${rating}/5\nTone: ${tone}\nLength: ${length}`,
      },
    ],
  });

  const text = msg.content.find((b) => b.type === "text")?.text ?? "";
  return Response.json({ text });
}
```

### 5.4 Event logging (your own Postgres table)

Events are logged to a Postgres `events` table through a server route, so you can query the funnel yourself with SQL. Any Postgres host works — Supabase, Neon, or Vercel Postgres (all have a free tier).

**a. Create the table** — save this as `schema.sql` in the repo root, then run it once against your database (`psql "$DATABASE_URL" -f schema.sql`, the Supabase SQL editor, or any client):

```sql
create table if not exists events (
  id          bigserial   primary key,
  session_id  text        not null,
  name        text        not null,
  props       jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists events_session_idx on events (session_id);
create index if not exists events_name_idx    on events (name);
```

**b. DB client** — `lib/db.ts`:

```ts
import postgres from "postgres";

// Works with any Postgres host. In serverless, use the POOLED connection
// string (e.g. Supabase port 6543, or a Neon pooled endpoint).
export const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
```

**c. Server route** — `app/api/events/route.ts`:

```ts
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const { sessionId, name, props } = await req.json();
  if (!sessionId || !name) return new Response("bad request", { status: 400 });

  await sql`
    insert into events (session_id, name, props)
    values (${sessionId}, ${name}, ${props ? sql.json(props) : null})
  `;
  return Response.json({ ok: true });
}
```

**d. Client logger** — `lib/analytics.ts`. Generates one session id per page load and posts each event:

```ts
let sessionId: string | null = null;
const getSessionId = () => (sessionId ??= crypto.randomUUID());

export function track(name: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: getSessionId(), name, props }),
    keepalive: true,
  }).catch(() => {});
}
```

Events emitted (already wired into the page): `page_open`, `rating_selected`, `chips_selected`, `review_generated`, `copy_and_open`, `posted_tap`. Each one is a row in `events`, grouped by `session_id`.

### 5.5 The four-screen page — `app/page.tsx`

One page, a small state machine (steps 1–4). Two things matter most: the copy-and-open handler must run **inside the click gesture**, and every step fires its event.

```tsx
"use client";

import { useEffect, useState } from "react";
import { BUSINESS } from "@/lib/business";
import { track } from "@/lib/analytics";

type Step = 1 | 2 | 3 | 4;

export default function Page() {
  const [step, setStep] = useState<Step>(1);
  const [rating, setRating] = useState(0);
  const [aspects, setAspects] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState(false);

  useEffect(() => { track("page_open"); }, []);

  // Rating conditions the label: negatives for low ratings, positives otherwise.
  // (Pilot simplification — see Section 8, note 2.)
  const aspectLabel = (a: { pos: string; neg: string }) =>
    rating <= 2 ? a.neg : a.pos;

  const chooseRating = (r: number) => {
    setRating(r);
    track("rating_selected", { rating: r });
    setStep(2);
  };

  const toggle = (v: string, arr: string[], set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const generate = async () => {
    setLoading(true);
    track("chips_selected", { aspectCount: aspects.length, itemCount: items.length });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({ rating, aspects, items, tone: "warm", length: "short" }),
      });
      const { text } = await res.json();
      setReview(text);
      track("review_generated", { length: text.length });
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const copyAndPost = async () => {
    try { await navigator.clipboard.writeText(review); } catch {}
    track("copy_and_open");
    setStep(4); // mock: copy the text and show confirmation — no navigation
  };

  return (
    <main className="min-h-screen bg-[#eeece5] flex justify-center">
      <div className="w-full max-w-[430px] bg-white min-h-screen px-6 py-8 flex flex-col">

        {/* SCREEN 1 — RATE */}
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-[#e6f1fb] flex items-center justify-center text-3xl font-bold text-[#1767ad]">
              K
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1a1a18]">{BUSINESS.name}</h1>
              <p className="text-[#9a9a8e]">{BUSINESS.locality}</p>
            </div>
            <h2 className="text-xl font-medium mt-6 text-[#1a1a18]">How was your visit?</h2>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => chooseRating(n)} aria-label={`${n} stars`}
                  className="text-4xl leading-none text-[#d6d4cb] hover:text-[#ef9f27]">
                  ★
                </button>
              ))}
            </div>
            <p className="text-sm text-[#9a9a8e] mt-4">tap to rate · about 15 seconds</p>
          </div>
        )}

        {/* SCREEN 2 — PICK WORDS */}
        {step === 2 && (
          <div className="flex-1 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="text-lg">
                <span className="text-[#ef9f27]">{"★".repeat(rating)}</span>
                <span className="text-[#d6d4cb]">{"★".repeat(5 - rating)}</span>
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-[#9a9a8e]">edit</button>
            </div>

            <div>
              <p className="font-medium text-[#67665e] mb-2">What stood out?</p>
              <div className="flex flex-wrap gap-2">
                {BUSINESS.aspects.map((a) => {
                  const l = aspectLabel(a);
                  const on = aspects.includes(l);
                  return (
                    <button key={a.key} onClick={() => toggle(l, aspects, setAspects)}
                      className={`px-4 py-2 rounded-full text-sm border ${
                        on ? "bg-[#e6f1fb] text-[#1767ad] border-transparent"
                           : "bg-white text-[#67665e] border-[#d3d1c7]"}`}>
                      {l}{on ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="font-medium text-[#67665e] mb-2">What did you have?</p>
              <div className="flex flex-wrap gap-2">
                {BUSINESS.items.map((i) => {
                  const on = items.includes(i);
                  return (
                    <button key={i} onClick={() => toggle(i, items, setItems)}
                      className={`px-4 py-2 rounded-full text-sm border ${
                        on ? "bg-[#eaf3ee] text-[#0f6e56] border-transparent"
                           : "bg-white text-[#67665e] border-[#d3d1c7]"}`}>
                      {i}{on ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={generate}
              disabled={aspects.length === 0 && items.length === 0}
              className="mt-auto bg-[#1767ad] text-white rounded-2xl py-4 font-medium disabled:opacity-40">
              {loading ? "Writing…" : "Continue"}
            </button>
          </div>
        )}

        {/* SCREEN 3 — REVIEW & EDIT */}
        {step === 3 && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-[#67665e]">Your review</p>
              <button onClick={generate} className="text-[#1767ad] font-medium">Redo</button>
            </div>
            <textarea value={review} onChange={(e) => setReview(e.target.value)}
              className="w-full h-40 rounded-2xl border border-[#d3d1c7] bg-[#fcfbf8] p-4 text-[#1a1a18] resize-none" />
            <button onClick={copyAndPost}
              className="mt-2 bg-[#1767ad] text-white rounded-2xl py-4 font-medium">
              Copy &amp; post to Google
            </button>
            <p className="text-center text-sm text-[#9a9a8e]">edit anything before you post</p>
          </div>
        )}

        {/* SCREEN 4 — PASTE & POST */}
        {step === 4 && (
          <div className="flex-1 flex flex-col items-center text-center gap-4 pt-10">
            <div className="w-16 h-16 rounded-full bg-[#dcf4ec] flex items-center justify-center text-2xl text-[#0f6e56]">
              ✓
            </div>
            <h2 className="text-xl font-medium text-[#1a1a18]">Review copied</h2>
            <p className="text-[#67665e]">
              Your review is on the clipboard. In the live app this button also
              opens Google&apos;s review box to paste into — stubbed out for the mock.
            </p>
            {!posted ? (
              <button onClick={() => { setPosted(true); track("posted_tap"); }}
                className="mt-4 border border-[#d3d1c7] rounded-2xl px-6 py-3 text-[#1a1a18]">
                I&apos;ve posted my review
              </button>
            ) : (
              <p className="mt-4 text-[#0f6e56] font-medium">Thank you! 🎉</p>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
```

### 5.6 Fonts — `app/layout.tsx`

Apply Poppins to match the mockups.

```tsx
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "700"] });

export const metadata: Metadata = {
  title: "Kaapi Katte — leave a review",
  description: "Tap a few words, get a review to post.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={poppins.className}>{children}</body>
    </html>
  );
}
```

---

## 6. Environment variables

Create `.env.local` for local dev, and set the same two in Vercel later.

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://user:password@host:6543/dbname
```

- `ANTHROPIC_API_KEY` — server-only, used by the generate route.
- `DATABASE_URL` — server-only, used by the events route. Use the **pooled** connection string from your Postgres host (Supabase → "Connection pooling", port 6543; Neon → the pooled endpoint) so serverless functions don't exhaust connections.

Run locally and test on your phone (same Wi-Fi, or via a tunnel):

```bash
npm run dev
```

---

## 7. Deploy to Vercel

1. Initialise git and push to a new GitHub repo:
   ```bash
   git init && git add -A && git commit -m "TapReview pilot"
   # create the repo on GitHub, then:
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. Create a Postgres database (Supabase or Neon, free tier). Run `schema.sql` (from Section 5.4a) against it, and copy the **pooled** connection string.
3. In Vercel: **New Project → import the repo**.
4. Add the two environment variables from Section 6 (`ANTHROPIC_API_KEY`, `DATABASE_URL`) in **Project → Settings → Environment Variables**.
5. Deploy. Vercel gives you a public URL like `https://tapreview-pilot.vercel.app`.
6. Redeploy if you added env vars after the first build.

---

## 8. Post-deploy checklist (acceptance)

- [ ] The URL opens cleanly on a real phone at 390px width.
- [ ] Tapping a star advances to the chips screen.
- [ ] Selecting chips and tapping **Continue** returns a review that mentions **only** the selected chips — no invented dishes, names, or claims.
- [ ] A 1-star session shows the negative labels; a 4–5-star session shows the positive ones. Both still reach the same Google post (no gating).
- [ ] **Copy & post to Google** copies the text and advances to the confirmation screen (mock: no navigation — the live app opens the Google review dialog here).
- [ ] After a test run, six rows appear in the `events` table (`select name, count(*) from events group by name`).

Notes:
1. **Streaming** is intentionally omitted for the pilot — a single non-streamed response is simpler. Add streaming in the real MVP.
2. **Chip conditioning is simplified:** the pilot flips each aspect's label by rating. The full product keeps negative chips present-but-sunk even on high ratings. This is fine for measuring conversion; revisit in Milestone 1.
3. **Clipboard:** the copy happens inside the tap gesture (required by some mobile browsers). Because the mock doesn't navigate away, there's no app-switch to clear the clipboard.

---

## 9. Run the pilot and read the number

> This section is for the **live** pilot. As a mock the button doesn't open Google, so you can demo the full flow and read the funnel through `copy_and_open` and `posted_tap` — but not true post-completion. To run it for real, restore the navigation in `copyAndPost` (open the Google deep link `https://search.google.com/local/writereview?placeid=<placeId>`), then follow the steps below.

1. Generate a QR code that points to the Vercel URL. Print a small counter card ("Scan to leave a quick review").
2. **Record the baseline:** note the café's current Google review count and today's date.
3. Place the QR on the counter for a week; brief staff to mention it once at payment.
4. After the week, query the funnel yourself:

   ```sql
   select
     count(distinct session_id) filter (where name = 'page_open')        as opened,
     count(distinct session_id) filter (where name = 'rating_selected')  as rated,
     count(distinct session_id) filter (where name = 'chips_selected')   as selected,
     count(distinct session_id) filter (where name = 'review_generated') as generated,
     count(distinct session_id) filter (where name = 'copy_and_open')    as copied,
     count(distinct session_id) filter (where name = 'posted_tap')       as posted
   from events;
   ```

   The step-to-step drop-offs show where you lose people (expect the biggest fall at copied → posted). Then compute the headline number:

   ```sql
   select round(100.0 *
     count(distinct session_id) filter (where name = 'posted_tap') /
     nullif(count(distinct session_id) filter (where name = 'page_open'), 0), 1)
     as post_completion_pct
   from events;
   ```

   - For the **live** pilot, cross-check reality: `new Google reviews = today's count − baseline`, and post-completion = new Google reviews ÷ opens.
   - For the **mock**, the `posted_tap` self-report is your proxy. Either way, this number decides whether to build Milestone 1.

Everything here except `lib/business.ts` carries forward into the real MVP — the throwaway part is just the hand-written config.
