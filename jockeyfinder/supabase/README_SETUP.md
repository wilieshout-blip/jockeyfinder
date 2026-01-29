# JockeyFinder — Clean Supabase Setup (Beginner)

## 1) Create a brand new Supabase project
1. Go to Supabase Dashboard
2. Click **New project**
3. Pick an organisation
4. Name: `jockeyfinder`
5. Generate a strong DB password (save it)
6. Region: pick the closest (Sydney is common for NZ)
7. Click **Create new project**

Wait until it says the project is ready.

## 2) Run the database schema
1. Left menu → **SQL Editor**
2. Click **New query**
3. Open `supabase/schema.sql` in this project folder
4. Copy all → paste into SQL Editor
5. Click **Run**

## 3) Create Storage bucket for licence photos (optional for later)
1. Left menu → **Storage**
2. Click **New bucket**
3. Name: `verification-docs`
4. Public bucket: OFF (keep private)
5. Click **Create**

(We will add upload policies later when you turn licence uploads back on.)

## 4) Add Environment Variables (local dev)
Create/edit file `.env.local` in the project root (same level as package.json):

NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

ADMIN_EMAIL=Wilieshout@gmail.com

## 5) Import NZTR trainer/agent phone list
Use the CSV provided (we generated it from your PDF): `nztr_people_registry.csv`

In Supabase:
1. Left menu → **Table Editor**
2. Click table `nztr_people_registry`
3. Click **Import data**
4. Upload the CSV
5. Confirm mapping (it should auto-map)
6. Import

This enables trainer auto-approval (agents still require manual approval).

## 6) Run the website locally
1. Open terminal in the project folder
2. Install:
   npm install
3. Run:
   npm run dev
4. Open browser:
   http://localhost:3000

## 7) Deploy on Vercel
1. Create a GitHub repo and push this project
2. Go to Vercel → **New Project**
3. Import from GitHub
4. Add Environment Variables (same as `.env.local`):
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - ADMIN_EMAIL
5. Deploy

## 8) Connect your GoDaddy domain
In Vercel:
1. Project → Settings → Domains
2. Add `jockeyfinder.com`
3. Add `www.jockeyfinder.com`
4. Vercel will show DNS records

In GoDaddy:
1. Go to DNS settings for the domain
2. Add/replace the records Vercel tells you (A record + CNAME)
3. Save

DNS can take minutes to hours. When done, your site loads on the domain.

## 9) Stripe Payments (jockey subscription)
You will do this after the site is deployed:
1. Create Stripe account
2. Create Product: JockeyFinder Jockey Membership
3. Create recurring price: NZD 40 / month
4. Add 100-day free trial
5. Get keys:
   - STRIPE_SECRET_KEY
   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   - STRIPE_WEBHOOK_SECRET
6. Add them to Vercel Env Vars + `.env.local`

We will add the Stripe Checkout code + webhook next.
