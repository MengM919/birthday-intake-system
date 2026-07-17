-- A separate, public-facing birthday wall. Browser clients never receive direct INSERT rights.

create table if not exists public.blessing_wall_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  nickname text not null,
  message text not null,
  emoji text,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint blessing_wall_messages_nickname_length check (char_length(nickname) between 1 and 20),
  constraint blessing_wall_messages_message_length check (char_length(message) between 1 and 200)
);

create index if not exists blessing_wall_messages_visible_idx
  on public.blessing_wall_messages (order_id, created_at desc)
  where status = 'visible';

create index if not exists blessing_wall_messages_rate_limit_idx
  on public.blessing_wall_messages (order_id, ip_hash, created_at desc);

alter table public.blessing_wall_messages enable row level security;

drop policy if exists "admins manage public blessing wall" on public.blessing_wall_messages;
create policy "admins manage public blessing wall"
  on public.blessing_wall_messages
  for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.blessing_wall_messages to authenticated;

comment on table public.blessing_wall_messages is 'Public birthday-page wall. Reads and writes are served only by safe Edge Functions.';
