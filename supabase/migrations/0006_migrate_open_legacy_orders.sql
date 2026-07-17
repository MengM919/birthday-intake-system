-- Move only editable legacy test orders onto the two-plan commercial model.
-- Submitted, approved, published, cancelled, and archived orders retain their historical plan.
with plan_map(legacy_code, current_code) as (
  values
    ('basic_99', 'basic_166'),
    ('heart_169', 'basic_166'),
    ('surprise_249', 'upgrade_288'),
    ('all_love_399', 'upgrade_288')
), candidates as (
  select o.id, target.id as target_plan_id
  from public.orders o
  join public.plans legacy on legacy.id = o.plan_id
  join plan_map on plan_map.legacy_code = legacy.code
  join public.plans target on target.code = plan_map.current_code
  where o.status in ('created', 'claimed', 'draft', 'needs_revision')
)
update public.orders o
set plan_id = candidates.target_plan_id,
    updated_at = now()
from candidates
where o.id = candidates.id;