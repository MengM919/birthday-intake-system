-- Commercial two-plan model and photo presentation metadata.
-- Safe to run after 0001_initial_schema.sql and 0002_client_role_grants.sql.

-- Keep historical orders intact. Legacy plans remain readable but cannot be sold again.
update public.plans
set is_active = false,
    updated_at = now()
where code in ('basic_99', 'heart_169', 'surprise_249', 'all_love_399');

insert into public.plans (code, name, price, photo_limit, description, is_active)
values
  ('basic_166', U&'\57FA\7840\5FC3\610F\6B3E', 16.60, 12, U&'\4E3B\795D\798F\3001\5C01\9762\3001\5012\8BA1\65F6\3001\56DE\5FC6\76F8\518C\548C\516C\5F00\795D\798F\5899\3002', true),
  ('upgrade_288', U&'\60CA\559C\5347\7EA7\6B3E', 28.80, 30, U&'\5305\542B\57FA\7840\5185\5BB9\FF0C\53EF\6309\9700\5F00\542F\8BB8\613F\74F6\3001\672A\6765\4FE1\7BB1\3001\4ECA\65E5\597D\8FD0\3001\60CA\559C\76F2\76D2\548C\80CC\666F\97F3\4E50\3002', true)
on conflict (code) do update set
  name = excluded.name,
  price = excluded.price,
  photo_limit = excluded.photo_limit,
  description = excluded.description,
  is_active = true,
  updated_at = now();

-- The plan catalog is the server-side authority for feature entitlement.
with desired(plan_code, module_code, display_name, is_included, is_optional, sort_order) as (
  values
    ('basic_166', 'gallery', U&'\56DE\5FC6\76F8\518C', true, false, 10),
    ('basic_166', 'messageWall', U&'\795D\798F\5899', true, false, 20),
    ('basic_166', 'countdown', U&'\751F\65E5\5012\8BA1\65F6', true, false, 30),
    ('upgrade_288', 'gallery', U&'\56DE\5FC6\76F8\518C', true, false, 10),
    ('upgrade_288', 'messageWall', U&'\795D\798F\5899', true, false, 20),
    ('upgrade_288', 'countdown', U&'\751F\65E5\5012\8BA1\65F6', true, false, 30),
    ('upgrade_288', 'wishBottle', U&'\8BB8\613F\74F6', true, true, 40),
    ('upgrade_288', 'futureMailbox', U&'\672A\6765\4FE1\7BB1', true, true, 50),
    ('upgrade_288', 'dailyLuck', U&'\4ECA\65E5\597D\8FD0', true, true, 60),
    ('upgrade_288', 'surpriseBox', U&'\60CA\559C\76F2\76D2', true, true, 70),
    ('upgrade_288', 'bgm', U&'\80CC\666F\97F3\4E50', true, true, 80)
)
insert into public.plan_modules (plan_id, module_code, display_name, is_included, is_optional, optional_group, pick_limit, sort_order)
select p.id, d.module_code, d.display_name, d.is_included, d.is_optional,
  case when d.is_optional then 'upgrade_included_options' else null end,
  null,
  d.sort_order
from desired d
join public.plans p on p.code = d.plan_code
on conflict (plan_id, module_code) do update set
  display_name = excluded.display_name,
  is_included = excluded.is_included,
  is_optional = excluded.is_optional,
  optional_group = excluded.optional_group,
  pick_limit = excluded.pick_limit,
  sort_order = excluded.sort_order;

alter table public.order_files
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_sort_order integer,
  add column if not exists focal_x numeric(5,4),
  add column if not exists focal_y numeric(5,4),
  add column if not exists crop_data jsonb not null default '{}'::jsonb;

alter table public.order_files
  drop constraint if exists order_files_focal_x_range,
  drop constraint if exists order_files_focal_y_range;

alter table public.order_files
  add constraint order_files_focal_x_range check (focal_x is null or (focal_x >= 0 and focal_x <= 1)),
  add constraint order_files_focal_y_range check (focal_y is null or (focal_y >= 0 and focal_y <= 1));

create index if not exists order_files_featured_idx
  on public.order_files (order_id, is_featured desc, featured_sort_order, sort_order);

comment on column public.order_files.is_featured is 'Whether a gallery photo is one of the up to eight highlighted birthday-page photos.';
comment on column public.order_files.crop_data is 'Client-selected crop / focal metadata. Original private file remains unchanged.';