-- Explicit Data API privileges for browser clients.
-- RLS policies from 0001_initial_schema.sql continue to decide which rows are visible.

grant usage on schema public to anon, authenticated;

grant select on public.plans, public.templates, public.plan_modules to anon, authenticated;

grant select, update on public.orders to authenticated;
grant select, insert, update, delete on public.order_content to authenticated;
grant select, insert, update, delete on public.order_modules to authenticated;
grant select, insert, update, delete on public.order_files to authenticated;
grant select, insert, update on public.friend_messages to authenticated;
grant select on public.admin_users to authenticated;
grant select on public.order_events to authenticated;
grant select, insert on public.consent_records to authenticated;