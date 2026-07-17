-- Server-side cache for third-party horoscope and almanac data.

create table if not exists public.daily_luck_cache (
  id uuid primary key default gen_random_uuid(),
  cache_date date not null,
  kind text not null check (kind in ('horoscope', 'almanac')),
  zodiac text not null default 'all',
  payload jsonb not null default '{}'::jsonb,
  source_name text not null,
  source_updated_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cache_date, kind, zodiac)
);

create trigger daily_luck_cache_set_updated_at
before update on public.daily_luck_cache
for each row execute function public.set_updated_at();

create index if not exists daily_luck_cache_lookup_idx
  on public.daily_luck_cache (cache_date, kind, zodiac, expires_at);

alter table public.daily_luck_cache enable row level security;

drop policy if exists "admins read daily luck cache" on public.daily_luck_cache;
create policy "admins read daily luck cache"
  on public.daily_luck_cache
  for select using (public.is_admin());

grant select on public.daily_luck_cache to authenticated;

comment on table public.daily_luck_cache is 'Private server cache. Third-party API keys and raw responses do not reach the browser.';
