# Birthday Renderer 2.0 Deployment

This release needs three separate actions. GitHub Pages deploys the static HTML/CSS/JS automatically after the Git push, but Supabase does not run SQL migrations or Edge Function updates automatically.

## 1. Run the safe template migration

1. Open Supabase Dashboard -> **SQL Editor**.
2. Click the `+` button next to the query tabs to open a blank query.
3. Open `supabase/migrations/0008_birthday_page_renderer_v2.sql` in this repository.
4. Copy the entire file into the SQL editor and click **Run**.
5. Wait for `Success. No rows returned`.

This migration only adds/updates the version `2.0.0` manifests for `T01`, `T02` and `T06`. It does **not** edit `generated_pages.config_snapshot`, customer orders, uploaded files or public slugs.

Verify it with:

```sql
select
  t.code,
  t.template_key,
  t.template_version,
  tv.version as current_version,
  tv.is_current
from public.templates t
join public.template_versions tv on tv.template_id = t.id
where t.code in ('T01', 'T02', 'T06')
  and tv.is_current = true
order by t.code;
```

The result should show `2.0.0` for all three rows.

## 2. Deploy the two changed Edge Functions

No new custom secret is needed for this renderer release. Keep the existing `CLAIM_TOKEN_SECRET` and `PUBLIC_BIRTHDAY_BASE_URL`. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically.

From a terminal in the repository directory, use the Supabase CLI:

```powershell
supabase functions deploy publish-order
supabase functions deploy get-published-page
```

If you use the Dashboard editor instead:

1. Go to **Edge Functions -> Functions**.
2. Open `publish-order`, choose **Deploy new version** or **Via Editor**, and replace its source with `supabase/functions/publish-order/index.ts`.
3. Repeat for `get-published-page` using `supabase/functions/get-published-page/index.ts`.
4. Confirm both functions show a fresh deployment time in the Functions list.

Do not deploy a service-role key to GitHub or `config/supabase.js`.

## 3. Publish a fresh test page

1. Open `admin.html` and log in as the merchant.
2. Pick an approved order that uses T01, T02 or T06.
3. Click **审核通过并发布**. This deliberately makes a new immutable page snapshot using the 2.0 template manifest.
4. Open the returned birthday URL in an incognito/private browser.
5. Test the opening CTA, gallery, wall, wish bottle, surprise box and share button.

Existing public links are preserved. They keep the old page snapshot until you explicitly publish their order again.

## GitHub Pages and social sharing

`birthday.html` updates document title, description, canonical URL and client-side Open Graph values after data loads. GitHub Pages is static, so WeChat and other crawlers may not wait for this JavaScript. Reliable dynamic social cards need a later server-rendered share page, pre-generated static HTML per slug, or an Edge/Serverless share endpoint. The page still has Web Share, copy-link and WeChat "click the top-right menu" fallbacks today.

## Rollback

If a new publication needs to return to the previous layout, run `supabase/migrations/0008_birthday_page_renderer_v2.rollback.sql`, redeploy the previous Git commit if needed, and publish the order again. Historical snapshots remain unchanged throughout.