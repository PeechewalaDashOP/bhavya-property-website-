# Getting started — your runway for the next Claude Code session

A practical checklist to go from "files on disk" to "live on the internet."
Do these in order. You can paste each prompt to Claude Code and let it run the commands.

---

## 0. One-time setup (your machine)
- [ ] Install **Node.js LTS** (v18+) from nodejs.org → check: `node -v`
- [ ] Install **Claude Code** (PowerShell): `irm https://claude.ai/install.ps1 | iex` → `claude --version`
- [ ] Open the project: `cd C:\Users\naman\property_website_project\kota-next` then `claude`

---

## 1. First message to paste into Claude Code
> Read CLAUDE.md fully. You are continuing the KotaProperty build (Next.js + TS +
> Tailwind + Supabase, deploy on Vercel). Summarise back to me the project, the
> "NON-NEGOTIABLE design rule", and the "Where we stopped" list so I know you're
> oriented. Then run `npm install` and `npm run dev` and tell me the localhost URL.
> Do not change any UI yet.

---

## 2. Get it running locally
- [ ] `npm install`
- [ ] `npm run dev` → open http://localhost:3000 (runs on sample data, no config needed)
- [ ] Confirm the site looks identical to the prototype (it should — same CSS).

---

## 3. Put it on GitHub (version control + needed for Vercel)
Prompt to Claude Code:
> Initialise a git repo here, make sure `.gitignore` covers node_modules/.next/.env*,
> and make a first commit "Initial KotaProperty Next.js app". Then give me the exact
> commands to create a GitHub repo and push.

Or run manually:
```bash
git init
git add .
git commit -m "Initial KotaProperty Next.js app"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/kotaproperty.git
git branch -M main
git push -u origin main
```

---

## 4. Connect Supabase (real data + leads)
- [ ] Create a project at supabase.com (free).
- [ ] SQL editor → paste & run `supabase/schema.sql`.
- [ ] Copy `.env.local.example` → `.env.local`, fill:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Seed demo data (optional):
      `NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs`
- [ ] Restart `npm run dev` → the site now reads from Supabase; enquiries write to `leads`.

---

## 5. Deploy to Vercel (free, public URL)
- [ ] Go to vercel.com → "Add New Project" → import your GitHub repo.
- [ ] Framework auto-detects **Next.js**. Build command/output: leave defaults.
- [ ] Add Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Deploy → you get a free `kotaproperty.vercel.app` URL.
- [ ] (Later) Settings → Domains → add a custom domain (~₹800/yr).

After this, every `git push` to `main` auto-deploys.

---

## 6. Then build the remaining features (in priority order)
Tell Claude Code to work through the "Where we stopped" list in CLAUDE.md:
1. Wire leads + deal tracker fully to Supabase (admin reads/updates the `leads` table).
2. Dealer/Admin login with Supabase Auth (port logic from ../kota-simple/system.html).
3. Post-a-property page with photo upload to Supabase Storage.
4. Replace sample images with real dealer photos.
5. Per-locality SEO pages (e.g. /kota/talwandi) + sitemap.
6. (Optional) light Framer Motion micro-interactions only — NO 3D. Keep mobile LCP < 2.5s.

---

## Golden rules (repeat to Claude Code if it drifts)
- **Never redesign the UI.** Match `app/globals.css` + existing class names exactly.
- Mobile-first, fast, plain simple English in all copy.
- Never expose the Supabase service-role key client-side (seed script / server only).
- We earn UPFRONT (leads/subscriptions/featured), not per closed deal — keep the
  contact gateway (capture visitor details, THEN reveal dealer contact).
