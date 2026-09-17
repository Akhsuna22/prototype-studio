# Prototype Studio

Turn a product idea into a live, working UI mockup — using the language
product managers actually write in (a user story), not a developer's
freeform prompt. Requires a login: every prototype is saved to your own
account in a real database.

## What it does

1. Log in or sign up (required for everything below).
2. Start from the landing page: a hero box, 6 templates, or your recent
   projects.
3. Describe an idea (user story or free-form), optionally attach
   reference images, and generate a live mockup + a written rationale.
4. Refine it conversationally in a chat thread — every follow-up edits
   the SAME design, not a fresh one.
5. Download it as a file, or get a real shareable link anyone can open
   (no login needed to VIEW a shared link — only to create one).
6. Every session is saved to your account and shows up on your landing
   page as a "Recent project."

## Architecture

```
[Browser] --login/queries--> [Supabase: Postgres + Auth]
    |                              (Row Level Security enforces
    |                               "you can only see YOUR rows")
    |
    +--generate/refine--> [Vercel serverless function: api/generate.js]
                                |
                                | 1. Verifies your login is real
                                |    (asks Supabase server-side)
                                | 2. Only then calls Groq with the
                                |    hidden GROQ_API_KEY
                                v
                          [Groq API]
```

Two separate concerns, two separate systems:
- **Supabase** handles who you are (login) and what you own (your
  prototypes) — accessed directly from the browser using Row Level
  Security, no custom backend code needed for that part.
- **Vercel serverless function** handles the one thing that must stay
  secret: the Groq API key. It checks your login is real BEFORE using
  that key, so the AI quota can't be spent by someone bypassing the UI.

## Setup

### 1. Create a free Supabase project
- Sign up at [supabase.com](https://supabase.com/) (free, no card needed).
- Create a new project. Save the database password somewhere.
- Go to **Project Settings → API** and copy your **Project URL** and
  **anon public key**.

### 2. Run the database schema
- In Supabase: **SQL Editor → New query**.
- Paste the contents of `sql/schema.sql` (in this repo) and run it.
- This creates the `prototypes` table with Row Level Security policies
  already applied.

### 3. Turn off email confirmation (recommended for testing/demos)
By default, Supabase requires clicking a confirmation link in an email
before a new signup can log in. For a demo/portfolio project this adds
friction (especially for someone else trying your tool). To disable it:
**Authentication → Providers → Email → toggle off "Confirm email."**
(You can turn this back on later if you want real email verification.)

### 4. Add your credentials to the frontend
Open `app.js`, find these two lines near the top, and replace the
placeholders with your real values from step 1:
```js
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";
```
These two values are meant to be public — safe to ship in frontend code.
Real security comes from the Row Level Security policies in the
database, not from hiding these.

### 5. Add the same credentials to Vercel (for the server-side check)
The serverless function (`api/generate.js`) also needs to verify logins,
so it needs its own copy of these values as environment variables:
- In Vercel: **Project Settings → Environment Variables**
- Add `SUPABASE_URL` = your Project URL
- Add `SUPABASE_ANON_KEY` = your anon public key
- Also make sure `GROQ_API_KEY` is still set (from before).

For local development, run `vercel env pull` after adding these so your
local `.env.local` picks them up too.

### 6. Install dependencies and run
```bash
npm install
vercel dev
```

## Project structure

```
prototype-studio/
├── index.html
├── style.css
├── app.js                 # Frontend: auth, UI, and direct Supabase queries
├── sql/
│   └── schema.sql          # Run this once in Supabase's SQL Editor
├── api/
│   ├── generate.js         # Calls Groq - verifies login first
│   └── _supabaseAuth.js    # Shared helper: verifies a login server-side
├── package.json
└── README.md
```

## Honest notes on this build

- **Old data doesn't carry over.** Before this version, history lived in
  browser localStorage and shares were anonymous public files on Vercel
  Blob. Neither of those connects to a real account, so this is a clean
  cutover, not a migration. Old Blob share links (if any) will keep
  working as plain files, they just won't appear anywhere in the new
  account-based system.
- **Rate limiting is still best-effort.** The per-IP cooldown on
  `api/generate.js` still resets on cold starts. Real accounts mean real
  abuse is much less likely (someone would need to sign up first), but
  it's not a hard guarantee against a determined logged-in user hammering
  the endpoint.
- **Password reset / email confirmation flows** are handled entirely by
  Supabase's own hosted pages if you turn email confirmation back on -
  this project doesn't build custom UI for those flows.

## Cost
Both Groq's and Supabase's free tiers have no per-request dollar cost as
of this writing. Check their pricing pages for current limits.
