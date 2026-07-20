-- Template asset library and immutable generated birthday-page snapshots.
-- Safe to run after migrations 0001 through 0006.

alter table public.templates
  add column if not exists template_key text,
  add column if not exists template_category text,
  add column if not exists template_status text not null default 'active',
  add column if not exists template_version text not null default '1.0.0',
  add column if not exists cover_style text,
  add column if not exists typography jsonb not null default '{}'::jsonb,
  add column if not exists icon_style text,
  add column if not exists module_card_style text,
  add column if not exists button_style text,
  add column if not exists decor_elements jsonb not null default '[]'::jsonb,
  add column if not exists copy_tone text,
  add column if not exists layout_rule text,
  add column if not exists supported_modules jsonb not null default '[]'::jsonb,
  add column if not exists default_scene_assets jsonb not null default '{}'::jsonb,
  add column if not exists preview_cover_image text,
  add column if not exists preview_thumb_image text,
  add column if not exists is_premium_template boolean not null default false,
  add column if not exists template_manifest jsonb not null default '{}'::jsonb;

-- The current two-plan commercial model supports an unlimited original gallery.
-- A NULL limit represents unlimited rather than a numeric sentinel such as -1.
alter table public.plans alter column photo_limit drop not null;
update public.plans
set photo_limit = null,
    updated_at = now()
where code in ('basic_166', 'upgrade_288');

create unique index if not exists templates_template_key_unique_idx
  on public.templates(template_key)
  where template_key is not null;

with template_seed(code, template_key, category, cover_style, display_style, icon_style, module_card_style, button_style, copy_tone, layout_rule, decor_elements, palette, is_premium) as (
  values
    ('T01', 'line_bloom_white', 'line_art', 'freeform_frame', 'handwritten', 'line_sticker', 'outlined_paper', 'sketch_pill', 'bright_warm', 'airy_split', '["sparkle","bloom","ribbon"]'::jsonb, '{"primary":"#ef6f95","accent":"#2f8be8","background":"#fffdf7","ink":"#27221f","soft":"#fff5eb","highlight":"#f7c948"}'::jsonb, false),
    ('T02', 'collage_pop_redblue', 'collage', 'taped_polaroid', 'poster', 'paper_cut', 'torn_paper', 'ticket', 'playful_loud', 'collage_left', '["tape","cherry","paper_edge"]'::jsonb, '{"primary":"#d94f3e","accent":"#1f6fb2","background":"#fff0d8","ink":"#302019","soft":"#fff8ea","highlight":"#f5bb3c"}'::jsonb, false),
    ('T03', 'collage_love_pastel', 'collage', 'letter_frame', 'marker', 'postcard', 'postcard', 'tape_label', 'letter_like', 'collage_right', '["envelope","heart","tape"]'::jsonb, '{"primary":"#e4685a","accent":"#287cc1","background":"#fff4df","ink":"#372620","soft":"#fffaf0","highlight":"#f7c96d"}'::jsonb, false),
    ('T04', 'cute_party_blue', 'cute_party', 'cloud_frame', 'chunky', 'party_doodle', 'dark_ticket', 'bubble', 'cheery_party', 'party_center', '["confetti","cake","streamer"]'::jsonb, '{"primary":"#ff7bad","accent":"#f6c84d","background":"#103d8e","ink":"#fffdf2","soft":"#173f86","highlight":"#77d6ff"}'::jsonb, true),
    ('T05', 'soft_portrait_pink', 'portrait_party', 'portrait_arc', 'soft_serif', 'soft_3d', 'soft_card', 'glossy_pill', 'adoring_soft', 'portrait_center', '["balloon","ribbon","sparkle"]'::jsonb, '{"primary":"#f26394","accent":"#9a77e9","background":"#fff6f8","ink":"#3e2931","soft":"#fff0f4","highlight":"#f5c46b"}'::jsonb, true),
    ('T06', 'pink_dark_gothic', 'dark_romantic', 'brush_oval', 'editorial', 'moonlight', 'ink_card', 'brush_stroke', 'midnight_romance', 'dramatic_split', '["moon","rose","starlight"]'::jsonb, '{"primary":"#ee7ca2","accent":"#e8bac9","background":"#171115","ink":"#fff6f8","soft":"#24161e","highlight":"#bb446d"}'::jsonb, true),
    ('T07', 'california_summer', 'summer_travel', 'postcard', 'travel', 'travel_stamp', 'postcard', 'sunset_pill', 'sunny_free', 'travel_story', '["sun","orange","palm"]'::jsonb, '{"primary":"#e67e59","accent":"#4f928d","background":"#fff1d9","ink":"#3b3129","soft":"#fff7e9","highlight":"#f3bf58"}'::jsonb, false),
    ('T08', 'scrapbook_pink_lace', 'scrapbook', 'lace_frame', 'handwritten_serif', 'lace_sticker', 'stitched_paper', 'ribbon', 'tender_romance', 'scrapbook_stack', '["bow","rose","lace"]'::jsonb, '{"primary":"#da7f9e","accent":"#a88dca","background":"#fff0f3","ink":"#4c353c","soft":"#fff7f8","highlight":"#edb9c7"}'::jsonb, true),
    ('T09', 'aegean_summer_blue', 'seaside', 'wave_oval', 'watercolor', 'watercolor', 'sea_glass', 'sea_pill', 'fresh_healing', 'breezy_split', '["wave","shell","flower"]'::jsonb, '{"primary":"#2f78bd","accent":"#79bada","background":"#eff9ff","ink":"#244263","soft":"#f8fdff","highlight":"#e5c56c"}'::jsonb, false),
    ('T10', 'gift_cloud_cute3d', 'cute_3d', 'soft_window', 'bubble', 'soft_3d', 'soft_card', 'glossy_pill', 'sweet_surprise', 'gift_center', '["gift","cloud","confetti"]'::jsonb, '{"primary":"#f64f90","accent":"#7950f3","background":"#fff4fa","ink":"#39283d","soft":"#fff9fc","highlight":"#ffc845"}'::jsonb, true),
    ('T11', 'graffiti_birthday', 'graffiti', 'scribble_frame', 'graffiti', 'graffiti', 'outline_poster', 'paint_stroke', 'young_confident', 'poster_punch', '["paint","star","tape"]'::jsonb, '{"primary":"#ef3886","accent":"#236ce0","background":"#fff9eb","ink":"#251f20","soft":"#fffdf4","highlight":"#ffd23f"}'::jsonb, false)
)
update public.templates as t
set
  template_key = s.template_key,
  template_category = s.category,
  template_status = 'active',
  template_version = '1.0.0',
  cover_style = s.cover_style,
  typography = jsonb_build_object('display', s.display_style, 'body', 'clean', 'accent', 'script'),
  icon_style = s.icon_style,
  module_card_style = s.module_card_style,
  button_style = s.button_style,
  decor_elements = s.decor_elements,
  copy_tone = s.copy_tone,
  layout_rule = s.layout_rule,
  supported_modules = '["gallery","messageWall","countdown","wishBottle","futureMailbox","dailyLuck","surpriseBox","bgm"]'::jsonb,
  default_scene_assets = jsonb_build_object('preview', 'assets/templates/' || t.code || '/preview.png'),
  preview_cover_image = 'assets/templates/' || t.code || '/preview.png',
  preview_thumb_image = 'assets/templates/' || t.code || '/preview.webp',
  is_premium_template = s.is_premium,
  palette = s.palette,
  template_manifest = jsonb_build_object(
    'templateId', s.template_key,
    'legacyId', t.code,
    'version', '1.0.0',
    'category', s.category,
    'palette', s.palette,
    'coverStyle', s.cover_style,
    'typography', jsonb_build_object('display', s.display_style, 'body', 'clean', 'accent', 'script'),
    'iconStyle', s.icon_style,
    'moduleCardStyle', s.module_card_style,
    'buttonStyle', s.button_style,
    'decorElements', s.decor_elements,
    'copyTone', s.copy_tone,
    'layoutRule', s.layout_rule,
    'supportedModules', '["gallery","messageWall","countdown","wishBottle","futureMailbox","dailyLuck","surpriseBox","bgm"]'::jsonb,
    'previewCoverImage', 'assets/templates/' || t.code || '/preview.png',
    'previewThumbImage', 'assets/templates/' || t.code || '/preview.webp',
    'isPremiumTemplate', s.is_premium
  ),
  updated_at = now()
from template_seed as s
where t.code = s.code;

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  version text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  manifest jsonb not null default '{}'::jsonb,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, version)
);

create unique index if not exists template_versions_one_current_idx
  on public.template_versions(template_id)
  where is_current = true;

insert into public.template_versions (template_id, version, status, manifest, is_current)
select id, template_version, 'active', template_manifest, true
from public.templates
where template_key is not null
on conflict (template_id, version) do update set
  status = excluded.status,
  manifest = excluded.manifest,
  is_current = excluded.is_current,
  updated_at = now();

create table if not exists public.template_assets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  asset_type text not null,
  asset_key text not null,
  storage_kind text not null default 'static' check (storage_kind in ('static', 'bucket')),
  asset_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, asset_type, asset_key)
);

insert into public.template_assets (template_id, asset_type, asset_key, storage_kind, asset_path, metadata, status)
select t.id, 'preview_cover', t.code || '_preview_cover', 'static', 'assets/templates/' || t.code || '/preview.png', jsonb_build_object('role', 'cover_preview'), 'active'
from public.templates t
where t.template_key is not null
on conflict (template_id, asset_type, asset_key) do update set
  asset_path = excluded.asset_path,
  metadata = excluded.metadata,
  status = excluded.status,
  updated_at = now();

insert into public.template_assets (template_id, asset_type, asset_key, storage_kind, asset_path, metadata, status)
select t.id, 'preview_thumb', t.code || '_preview_thumb', 'static', 'assets/templates/' || t.code || '/preview.webp', jsonb_build_object('role', 'thumbnail_preview'), 'active'
from public.templates t
where t.template_key is not null
on conflict (template_id, asset_type, asset_key) do update set
  asset_path = excluded.asset_path,
  metadata = excluded.metadata,
  status = excluded.status,
  updated_at = now();

create table if not exists public.template_module_rules (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  module_code text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, module_code)
);

with modules(module_code, sort_order) as (
  values
    ('gallery', 10), ('messageWall', 20), ('countdown', 30), ('wishBottle', 40),
    ('futureMailbox', 50), ('dailyLuck', 60), ('surpriseBox', 70), ('bgm', 80)
)
insert into public.template_module_rules (template_id, module_code, enabled, sort_order, configuration)
select t.id, m.module_code, true, m.sort_order, jsonb_build_object('presentation', 'template_adaptive')
from public.templates t
cross join modules m
where t.template_key is not null
on conflict (template_id, module_code) do update set
  enabled = excluded.enabled,
  sort_order = excluded.sort_order,
  configuration = excluded.configuration,
  updated_at = now();

create table if not exists public.blindbox_scenes (
  id uuid primary key default gen_random_uuid(),
  scene_code text unique not null,
  name text not null,
  description text,
  duration_seconds integer not null default 6 check (duration_seconds between 4 and 10),
  configuration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.blindbox_scenes (scene_code, name, description, duration_seconds, configuration, is_active) values
  ('kitten_companion', U&'\5C0F\732B', 'gentle kitten companions', 6, '{"renderer":"kittenRenderer","pieces":["cat","paw","heart"]}'::jsonb, true),
  ('firework_night', U&'\70DF\82B1', 'celebration fireworks', 7, '{"renderer":"fireworkRenderer","pieces":["spark","burst","glow"]}'::jsonb, true),
  ('flower_bouquet', U&'\9C9C\82B1', 'flowers and gentle light', 6, '{"renderer":"flowerRenderer","pieces":["petal","leaf","bloom"]}'::jsonb, true),
  ('starlight_wish', U&'\661F\661F', 'starlight wishes', 6, '{"renderer":"starRenderer","pieces":["sparkle","star","orbit"]}'::jsonb, true),
  ('butterfly_garden', U&'\8774\8776', 'slow butterflies', 6, '{"renderer":"butterflyRenderer","pieces":["butterfly","petal","spark"]}'::jsonb, true),
  ('party_balloons', U&'\751F\65E5\6C14\7403', 'birthday balloons', 6, '{"renderer":"balloonRenderer","pieces":["balloon","ribbon","confetti"]}'::jsonb, true),
  ('seaside_summer', U&'\6D77\6D6A', 'summer sea light', 6, '{"renderer":"oceanRenderer","pieces":["wave","bubble","sun"]}'::jsonb, true),
  ('fairytale_gift_house', U&'\7AE5\8BDD\793C\7269\5C4B', 'a small fairytale gift house', 6, '{"renderer":"giftHouseRenderer","pieces":["gift","star","trail"]}'::jsonb, true)
on conflict (scene_code) do update set
  name = excluded.name,
  description = excluded.description,
  duration_seconds = excluded.duration_seconds,
  configuration = excluded.configuration,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.generated_pages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  template_id uuid references public.templates(id) on delete set null,
  template_version_id uuid references public.template_versions(id) on delete set null,
  public_slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  config_snapshot jsonb not null default '{}'::jsonb,
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists generated_pages_slug_idx on public.generated_pages(public_slug);
create index if not exists generated_pages_status_idx on public.generated_pages(status);

create table if not exists public.generated_page_assets (
  id uuid primary key default gen_random_uuid(),
  generated_page_id uuid not null references public.generated_pages(id) on delete cascade,
  source_file_id uuid references public.order_files(id) on delete set null,
  asset_type text not null,
  storage_bucket text,
  storage_path text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generated_page_assets_page_idx on public.generated_page_assets(generated_page_id, sort_order);

alter table public.template_versions enable row level security;
alter table public.template_assets enable row level security;
alter table public.template_module_rules enable row level security;
alter table public.blindbox_scenes enable row level security;
alter table public.generated_pages enable row level security;
alter table public.generated_page_assets enable row level security;

drop policy if exists "active template versions are readable" on public.template_versions;
create policy "active template versions are readable" on public.template_versions
  for select using (status = 'active' or public.is_admin());
drop policy if exists "admins manage template versions" on public.template_versions;
create policy "admins manage template versions" on public.template_versions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "active template assets are readable" on public.template_assets;
create policy "active template assets are readable" on public.template_assets
  for select using (status = 'active' or public.is_admin());
drop policy if exists "admins manage template assets" on public.template_assets;
create policy "admins manage template assets" on public.template_assets
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "template module rules are readable" on public.template_module_rules;
create policy "template module rules are readable" on public.template_module_rules
  for select using (public.is_admin() or exists (select 1 from public.templates t where t.id = template_id and t.is_active = true));
drop policy if exists "admins manage template module rules" on public.template_module_rules;
create policy "admins manage template module rules" on public.template_module_rules
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "active blindbox scenes are readable" on public.blindbox_scenes;
create policy "active blindbox scenes are readable" on public.blindbox_scenes
  for select using (is_active = true or public.is_admin());
drop policy if exists "admins manage blindbox scenes" on public.blindbox_scenes;
create policy "admins manage blindbox scenes" on public.blindbox_scenes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage generated pages" on public.generated_pages;
create policy "admins manage generated pages" on public.generated_pages
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage generated page assets" on public.generated_page_assets;
create policy "admins manage generated page assets" on public.generated_page_assets
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.template_versions, public.template_assets, public.template_module_rules, public.blindbox_scenes to anon, authenticated;

drop trigger if exists template_versions_set_updated_at on public.template_versions;
create trigger template_versions_set_updated_at before update on public.template_versions for each row execute function public.set_updated_at();
drop trigger if exists template_assets_set_updated_at on public.template_assets;
create trigger template_assets_set_updated_at before update on public.template_assets for each row execute function public.set_updated_at();
drop trigger if exists template_module_rules_set_updated_at on public.template_module_rules;
create trigger template_module_rules_set_updated_at before update on public.template_module_rules for each row execute function public.set_updated_at();
drop trigger if exists blindbox_scenes_set_updated_at on public.blindbox_scenes;
create trigger blindbox_scenes_set_updated_at before update on public.blindbox_scenes for each row execute function public.set_updated_at();
drop trigger if exists generated_pages_set_updated_at on public.generated_pages;
create trigger generated_pages_set_updated_at before update on public.generated_pages for each row execute function public.set_updated_at();