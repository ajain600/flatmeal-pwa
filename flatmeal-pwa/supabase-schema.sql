-- ================================================================
-- FLAT MEAL PLANNER — Supabase Schema
-- Run this entire file in: Supabase → SQL Editor → New Query → Run
-- ================================================================

-- 1. SETTINGS table (one row = one flat's config)
create table if not exists settings (
  id text primary key default 'flat',
  flatmates text[] default array['Aman (Admin)', 'Ravi', 'Priya', 'Arjun'],
  cook_name text default 'Ramesh Bhaiya',
  cook_phone text default '919876543210',
  flat_name text default 'Flat 4B',
  app_link text default 'https://your-app.vercel.app',
  bl_reminder_hour integer default 6,
  dinner_reminder_hour integer default 16,
  min_votes_to_send integer default 1,
  message_format text default '🍽️ *{flatName} Meal Plan — {day}*
_{subtitle}_

🌅 *Breakfast:* {breakfast}
☀️ *Lunch:* {lunch}
🌙 *Dinner:* {dinner}

{comment}Please prepare accordingly. Thank you! 🙏
— {flatName} Residents',
  reminder_format text default '🔔 *{flatName} — Vote Now!*

Please choose your preference for *{day}*:
📌 {meals}

👉 Vote here: {appLink}

_Takes 30 seconds. Cook needs your vote! 🍳_',
  meal_options jsonb default '{
    "Breakfast": ["🥣 Poha","🫓 Upma","🫔 Paratha","🍚 Idli-Sambar","🍳 Bread & Eggs","🌾 Oats","🥪 Sandwich","⏭️ Skip"],
    "Lunch": ["🍛 Dal-Rice","🫘 Rajma-Chawal","🧆 Chole-Bhature","🧀 Paneer Sabzi","🫓 Roti-Sabzi","🍚 Pulao","🍖 Biryani","⏭️ Skip"],
    "Dinner": ["🫓 Roti-Dal","🍲 Khichdi","🍳 Fried Rice","🍝 Pasta","🧀 Paneer Curry","🥗 Mixed Veg","🍜 Soup & Bread","⏭️ Skip"]
  }'::jsonb,
  updated_at timestamptz default now()
);

-- Insert default row
insert into settings (id) values ('flat') on conflict (id) do nothing;

-- 2. VOTES table (one row per flatmate per meal per day)
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  day text not null,          -- e.g. "Monday", "Tuesday"
  meal text not null,         -- "Breakfast", "Lunch", "Dinner"
  flatmate text not null,     -- e.g. "Ravi"
  choice text not null,       -- e.g. "🥣 Poha"
  voted_at timestamptz default now(),
  unique(day, meal, flatmate) -- one vote per person per meal per day
);

-- 3. PUSH SUBSCRIPTIONS table (for web push notifications)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  flatmate text not null,
  subscription jsonb not null,
  created_at timestamptz default now(),
  unique(flatmate)
);

-- 4. Enable Realtime on votes and settings
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table settings;

-- 5. Allow public read/write (no auth needed for flat internal app)
alter table settings enable row level security;
alter table votes enable row level security;
alter table push_subscriptions enable row level security;

create policy "Allow all on settings" on settings for all using (true) with check (true);
create policy "Allow all on votes" on votes for all using (true) with check (true);
create policy "Allow all on push_subscriptions" on push_subscriptions for all using (true) with check (true);

-- Done! ✅
