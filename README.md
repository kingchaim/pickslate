# PickSlate — Daily Sports Picks MVP

Wordle for sports. 7 games. Pick winners. Flex on your friends.

**Fully automated** — fetches games, checks scores, awards points. Zero daily management.

---

## Quick Start (15 minutes)

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `pickslate`, pick a region, set a DB password
3. Once created, go to **SQL Editor** → paste contents of `supabase/schema.sql` → Run
4. Go to **Authentication** → **Providers** → make sure **Email** is enabled
5. In Authentication settings, set **Site URL** to your Vercel URL (or `http://localhost:3000` for now)
6. Add redirect URL: `https://your-app.vercel.app/auth/callback`
7. Copy your **Project URL** and **anon key** from Settings → API
8. Copy your **service_role key** from Settings → API (keep this secret!)

### 2. The Odds API

1. Go to [the-odds-api.com](https://the-odds-api.com) → Sign up
2. Get your free API key (500 requests/month — plenty for MVP)
3. Save the key

### 3. Resend (Email - Optional for now)

1. Go to [resend.com](https://resend.com) → Sign up
2. Get API key
3. (Email notifications are stretch — app works without this)

### 4. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Add environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
THE_ODDS_API_KEY=your_key_here
RESEND_API_KEY=your_key_here (optional)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
ADMIN_EMAILS=your@email.com
CRON_SECRET=generate_a_random_string_here
```

4. Deploy!

### 5. First Login & Admin Setup

1. Visit your app → enter your email → click magic link
2. In Supabase **Table Editor** → `profiles` table → find your row → set `is_admin` to `true`
3. Create the First Class Dicks group:
   - Go to Admin tab in the app, or run in Supabase SQL:
   ```sql
   INSERT INTO public.groups (name, invite_code, created_by)
   VALUES ('First Class Dicks', 'DICKS', 'YOUR_USER_UUID_HERE');
   ```
4. Share the invite link: `https://your-app.vercel.app/join/DICKS`

### 6. Test the Flow

1. Go to Admin → click "FETCH TODAY'S SLATE" → should pull 7 games
2. Go to Picks → you should see today's 7 games
3. Pick all 7 → picks auto-save
4. Wait for games to finish (or manually trigger "CHECK SCORES" in admin)
5. Click "FINALIZE & AWARD POINTS" in admin
6. Check Results tab → you should see your share card

---

## How It Works (Automated)

Once deployed, this runs itself:

| Time (EST) | What Happens |
|---|---|
| **8:00 AM** | Cron fetches all today's games from The Odds API, ranks them by competitiveness + sport diversity + prime time, picks the top 7, creates the slate |
| **Every 30 min** | Cron checks scores for all games in the slate. Updates live scores. Marks final games. Marks picks correct/incorrect. Locks slate when first game starts. |
| **11:00 PM** | Cron finalizes the slate. Calculates points for every user (base + performance + perfect bonus + streak bonus). Updates streaks. |

**Your only job:** Share the invite link. That's it.

---

## Game Selection Algorithm

Games are ranked by:
- **Competitiveness (60%)** — closer moneyline odds = more competitive = better game to pick
- **Prime time bonus (20%)** — games between 6-10pm EST get a boost
- **Sport priority (20%)** — NBA/NFL get slight priority over smaller sports

Diversity rule: Max 3 games from the same sport, so you always get a mix.

---

## Points System

| Action | Points |
|---|---|
| Participate (make all picks) | +10 |
| Per correct pick | +15 |
| 5/7 or better | +20 bonus |
| 6/7 | +35 bonus |
| Perfect 7/7 | +100 bonus |
| 3-day streak | +25 |
| 7-day streak | +100 |
| 14-day streak | +250 |
| 30-day streak | +1000 |

---

## Tech Stack

- **Next.js 14** (App Router, React Server Components)
- **Supabase** (Postgres, Auth, RLS)
- **Tailwind CSS** (dark theme, mobile-first)
- **The Odds API** (game data + scores)
- **Vercel** (hosting + cron jobs)

All free tier. $0/month to run.

---

## File Structure

```
pickslate/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing/login
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Styles
│   │   ├── auth/callback/        # Magic link callback
│   │   ├── join/[code]/          # Group invite page
│   │   ├── picks/                # Daily picks (main screen)
│   │   ├── leaderboard/          # All-time standings
│   │   ├── results/              # Share card + results
│   │   ├── admin/                # Admin controls
│   │   └── api/cron/
│   │       ├── fetch-slate/      # Auto-fetch top 7 games
│   │       ├── check-scores/     # Auto-check scores
│   │       └── finalize/         # Auto-award points
│   ├── components/
│   │   ├── BottomNav.tsx
│   │   ├── GameCard.tsx
│   │   └── ShareCard.tsx
│   ├── lib/
│   │   ├── supabase-browser.ts
│   │   ├── supabase-admin.ts
│   │   ├── odds-api.ts           # The Odds API integration
│   │   ├── points.ts             # Points calculation
│   │   └── dates.ts              # Date utilities
│   └── types/
│       └── index.ts
├── supabase/
│   └── schema.sql                # Full database schema
├── vercel.json                   # Cron job config
└── README.md
```

---

## Invite Your Friends

Share this link:
```
https://your-app.vercel.app/join/DICKS
```

They click it, enter email, get a magic link, and they're in.
