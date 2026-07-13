-- Birthday Intake System initial commercial schema
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  price numeric(10,2),
  photo_limit integer not null default 5,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  preview_path text,
  palette jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.plan_modules (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade,
  module_code text not null,
  display_name text,
  is_included boolean default false,
  is_optional boolean default false,
  optional_group text,
  pick_limit integer,
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique(plan_id, module_code)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  plan_id uuid references public.plans(id),
  template_id uuid references public.templates(id),
  customer_user_id uuid references auth.users(id),
  claim_token_hash text,
  claim_expires_at timestamptz,
  claimed_at timestamptz,
  recipient_name text,
  recipient_birthday date,
  show_age boolean default false,
  relationship_type text,
  sender_name text,
  sender_anonymous boolean default false,
  contact_method text,
  contact_value text,
  purchase_channel text,
  external_order_number text,
  status text not null default 'created' check (status in (
    'created','claimed','draft','submitted','reviewing','needs_revision','approved','generating','published','cancelled','archived'
  )),
  public_slug text unique,
  published_url text,
  privacy_consent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz
);

create table if not exists public.order_content (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.orders(id) on delete cascade,
  headline text,
  main_message text,
  long_message text,
  signature text,
  music jsonb default '{}'::jsonb,
  access_mode text default 'unlisted',
  allow_share boolean default true,
  allow_indexing boolean default false,
  custom_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_modules (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  module_code text not null,
  enabled boolean default true,
  configuration jsonb default '{}'::jsonb,
  sort_order integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(order_id, module_code)
);

create table if not exists public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  file_type text not null check (file_type in (
    'cover','gallery','message_attachment','surprise_attachment','map_photo','gift_photo','audio','video','other'
  )),
  storage_bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  sort_order integer default 0,
  caption text,
  taken_at timestamptz,
  status text default 'uploaded',
  created_at timestamptz default now(),
  unique(storage_bucket, storage_path)
);

create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  author_name text,
  message text not null,
  attachment_file_id uuid references public.order_files(id) on delete set null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin','operator')),
  display_name text,
  created_at timestamptz default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  event_type text not null check (event_type in (
    'order_created','order_claimed','draft_saved','photo_uploaded','order_submitted','review_started','revision_requested','approved','published','deleted'
  )),
  actor_user_id uuid references auth.users(id),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id),
  consent_type text not null default 'privacy_content_usage',
  consent_text text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists orders_customer_idx on public.orders(customer_user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists order_modules_order_idx on public.order_modules(order_id);
create index if not exists order_files_order_idx on public.order_files(order_id);
create index if not exists order_events_order_idx on public.order_events(order_id);

create trigger plans_set_updated_at before update on public.plans for each row execute function public.set_updated_at();
create trigger templates_set_updated_at before update on public.templates for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger order_content_set_updated_at before update on public.order_content for each row execute function public.set_updated_at();
create trigger order_modules_set_updated_at before update on public.order_modules for each row execute function public.set_updated_at();
create trigger friend_messages_set_updated_at before update on public.friend_messages for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

alter table public.plans enable row level security;
alter table public.templates enable row level security;
alter table public.plan_modules enable row level security;
alter table public.orders enable row level security;
alter table public.order_content enable row level security;
alter table public.order_modules enable row level security;
alter table public.order_files enable row level security;
alter table public.friend_messages enable row level security;
alter table public.admin_users enable row level security;
alter table public.order_events enable row level security;
alter table public.consent_records enable row level security;

create policy "public can read active plans" on public.plans for select using (is_active = true);
create policy "admins manage plans" on public.plans for all using (public.is_admin()) with check (public.is_admin());

create policy "public can read active templates" on public.templates for select using (is_active = true);
create policy "admins manage templates" on public.templates for all using (public.is_admin()) with check (public.is_admin());

create policy "public can read plan modules" on public.plan_modules for select using (true);
create policy "admins manage plan modules" on public.plan_modules for all using (public.is_admin()) with check (public.is_admin());

create policy "customers read own orders" on public.orders for select using (customer_user_id = auth.uid() or public.is_admin());
create policy "customers update own draft orders" on public.orders for update using (customer_user_id = auth.uid() or public.is_admin()) with check (customer_user_id = auth.uid() or public.is_admin());
create policy "admins insert orders" on public.orders for insert with check (public.is_admin());
create policy "admins delete orders" on public.orders for delete using (public.is_admin());

create policy "customers read own content" on public.order_content for select using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));
create policy "customers upsert own content" on public.order_content for all using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));

create policy "customers read own modules" on public.order_modules for select using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));
create policy "customers upsert own modules" on public.order_modules for all using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));

create policy "customers read own files" on public.order_files for select using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));
create policy "customers manage own file records" on public.order_files for all using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));

create policy "customers read own friend messages" on public.friend_messages for select using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));
create policy "customers add own friend messages" on public.friend_messages for insert with check (exists (select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid()));
create policy "admins moderate friend messages" on public.friend_messages for update using (public.is_admin()) with check (public.is_admin());

create policy "admin users can read self" on public.admin_users for select using (user_id = auth.uid() or public.is_admin());
create policy "owners manage admins" on public.admin_users for all using (public.is_admin()) with check (public.is_admin());

create policy "customers read own events" on public.order_events for select using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));
create policy "admins insert events" on public.order_events for insert with check (public.is_admin());

create policy "customers read own consent" on public.consent_records for select using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_user_id = auth.uid() or public.is_admin())));
create policy "customers insert own consent" on public.consent_records for insert with check (exists (select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid()));

insert into public.plans (code, name, price, photo_limit, description) values
  ('basic_99', '轻心意版', 9.90, 5, '基础内容，适合轻量祝福'),
  ('heart_169', '心动版', 16.90, 12, '加购模块 3 选 2，适合情侣、闺蜜和同学'),
  ('surprise_249', '惊喜版', 24.90, 20, '更多照片和互动模块，适合完整生日惊喜'),
  ('all_love_399', '全部偏爱版', 39.90, 30, '全模块高配，预留主意象 + 辅助意象扩展')
on conflict (code) do update set
  name = excluded.name,
  price = excluded.price,
  photo_limit = excluded.photo_limit,
  description = excluded.description,
  updated_at = now();

insert into public.templates (code, name, description, preview_path, palette) values
  ('T01', '晴日手绘', '白底明亮线条、粉蓝黄绿、高级手绘感', 'assets/templates/T01/preview.png', '{"primary":"#2f80ed","accent":"#ff6f91","background":"#fffaf2"}'),
  ('T02', 'Cherry Pop', '明亮美式复古、樱桃、撕纸拼贴', 'assets/templates/T02/preview.png', '{"primary":"#e3503e","accent":"#1f72b8","background":"#fff2d8"}'),
  ('T03', 'Love Letter', '温暖美式海报、红蓝奶油、手工拼贴', 'assets/templates/T03/preview.png', '{"primary":"#ee6954","accent":"#2177c7","background":"#fff0dc"}'),
  ('T04', 'Blue Birthday Club', '宝蓝底、可爱手绘、高对比', 'assets/templates/T04/preview.png', '{"primary":"#1557c4","accent":"#ff6ba9","background":"#082b78"}'),
  ('T05', 'Today’s Star', '照片主角、粉彩派对、高生日感', 'assets/templates/T05/preview.png', '{"primary":"#f55f93","accent":"#8a6cf2","background":"#fff6f7"}'),
  ('T06', 'Pink Midnight', '黑粉水粉、怪诞甜酷、星夜', 'assets/templates/T06/preview.png', '{"primary":"#e46b91","accent":"#f6b4c9","background":"#120d11"}'),
  ('T07', 'California Daydream', '加州假日、公路、海滩、松弛感', 'assets/templates/T07/preview.png', '{"primary":"#e77955","accent":"#2c8b8b","background":"#fff1d8"}'),
  ('T08', 'Dear You', '粉色手账、蕾丝、纸张、蝴蝶结', 'assets/templates/T08/preview.png', '{"primary":"#d87991","accent":"#b79adf","background":"#ffe3ec"}'),
  ('T09', 'Summer Blue', '蓝白海滨、夏日、治愈水彩', 'assets/templates/T09/preview.png', '{"primary":"#2f72c4","accent":"#7bbbd7","background":"#eef8ff"}'),
  ('T10', 'Birthday Rush', '高饱和生日派对、礼物包围感', 'assets/templates/T10/preview.png', '{"primary":"#ff4f94","accent":"#7d4df4","background":"#fff1f7"}'),
  ('T11', 'Love Graffiti', '荧光涂鸦、街头、黑线、强个性', 'assets/templates/T11/preview.png', '{"primary":"#ff2f92","accent":"#246cff","background":"#fbf1de"}')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  preview_path = excluded.preview_path,
  palette = excluded.palette,
  updated_at = now();

with plan_rows as (
  select id, code from public.plans
), module_seed(module_code, display_name, sort_order) as (
  values
    ('gallery','回忆相册',1),
    ('messageWall','留言墙',2),
    ('wishBottle','许愿瓶',3),
    ('surpriseBox','惊喜盲盒',4),
    ('playlist','生日歌单',5),
    ('partyChecklist','派对清单',6),
    ('hiddenEgg','隐藏彩蛋',7),
    ('birthdayMap','生日地图',8),
    ('futureMailbox','生日信箱',9),
    ('giftVote','礼物投票',10),
    ('dailyLuck','每日星座运势',11),
    ('friendCollaboration','好友共创',12)
)
insert into public.plan_modules (plan_id, module_code, display_name, is_included, is_optional, optional_group, pick_limit, sort_order)
select p.id, m.module_code, m.display_name,
  case
    when p.code in ('surprise_249','all_love_399') then true
    when p.code = 'basic_99' and m.module_code in ('gallery','messageWall','wishBottle','surpriseBox') then true
    when p.code = 'heart_169' and m.module_code in ('gallery','messageWall','wishBottle','surpriseBox','playlist','partyChecklist') then true
    else false
  end,
  case
    when p.code = 'heart_169' and m.module_code in ('messageWall','wishBottle','surpriseBox') then true
    else false
  end,
  case when p.code = 'heart_169' then 'heart_addons' else null end,
  case when p.code = 'heart_169' then 2 else null end,
  m.sort_order
from plan_rows p cross join module_seed m
where p.code in ('basic_99','heart_169','surprise_249','all_love_399')
on conflict (plan_id, module_code) do update set
  display_name = excluded.display_name,
  is_included = excluded.is_included,
  is_optional = excluded.is_optional,
  optional_group = excluded.optional_group,
  pick_limit = excluded.pick_limit,
  sort_order = excluded.sort_order;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('birthday-order-private', 'birthday-order-private', false, 31457280, array['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/mpeg','audio/mp4','audio/wav','video/mp4']),
  ('birthday-published-assets', 'birthday-published-assets', false, 31457280, array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/wav','video/mp4'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "customers upload own order private files" on storage.objects for insert with check (
  bucket_id = 'birthday-order-private'
  and (storage.foldername(name))[1] = 'orders'
  and (storage.foldername(name))[3] = auth.uid()::text
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[2]
      and o.customer_user_id = auth.uid()
  )
);

create policy "customers read own order private files" on storage.objects for select using (
  bucket_id = 'birthday-order-private'
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[2]
      and (o.customer_user_id = auth.uid() or public.is_admin())
  )
);

create policy "customers delete own order private files" on storage.objects for delete using (
  bucket_id = 'birthday-order-private'
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[2]
      and (o.customer_user_id = auth.uid() or public.is_admin())
  )
);

create policy "admins manage published assets" on storage.objects for all using (
  bucket_id = 'birthday-published-assets' and public.is_admin()
) with check (
  bucket_id = 'birthday-published-assets' and public.is_admin()
);
