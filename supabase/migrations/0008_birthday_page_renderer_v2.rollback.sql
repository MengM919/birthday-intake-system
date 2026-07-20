-- Renderer v2 rollback. This only changes which template version is current for future publishing.
-- It does not change existing generated_pages.config_snapshot rows, orders, files or public slugs.

begin;

with targets as (
  select id
  from public.templates
  where template_key in ('line_bloom_white', 'collage_pop_redblue', 'pink_dark_gothic')
)
update public.template_versions tv
set is_current = false,
    updated_at = now()
from targets t
where tv.template_id = t.id
  and tv.is_current = true;

with targets as (
  select id
  from public.templates
  where template_key in ('line_bloom_white', 'collage_pop_redblue', 'pink_dark_gothic')
)
update public.template_versions tv
set is_current = true,
    updated_at = now()
from targets t
where tv.template_id = t.id
  and tv.version = '1.0.0';

update public.templates
set template_version = '1.0.0',
    updated_at = now()
where template_key in ('line_bloom_white', 'collage_pop_redblue', 'pink_dark_gothic');

commit;