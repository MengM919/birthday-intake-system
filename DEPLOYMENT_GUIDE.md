# 部署指南

这份指南按“先数据库、再函数、最后 GitHub Pages”的顺序操作。所有示例均适用于 `birthday-intake-system`。

## 1. 配置前端 Supabase

打开本地文件 `config/supabase.js`，只填写：

- Project URL
- Publishable Key

这两个值可以出现在浏览器中。不要把 Service Role Key、第三方 API Key 或领取密钥写进这个文件。

## 2. 在 Supabase 运行迁移

进入 Supabase 项目，打开 **SQL Editor**，依次执行：

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_client_role_grants.sql`
3. `supabase/migrations/0003_two_plan_model.sql`
4. `supabase/migrations/0004_public_blessing_wall.sql`
5. `supabase/migrations/0005_daily_luck_cache.sql`
6. `supabase/migrations/0006_migrate_open_legacy_orders.sql`

完成后请在 Table Editor 检查：

- `plans` 中有且只有两个活动套餐：`basic_166`、`upgrade_288`
- `birthday-order-private` 为 private bucket
- RLS 没有被关闭
- `blessing_wall_messages` 与 `daily_luck_cache` 已出现

## 3. 配置 Storage

创建或确认两个 bucket：

| Bucket | 权限 | 用途 |
| --- | --- | --- |
| `birthday-order-private` | Private | 客户原图、语音、附件 |
| `birthday-published-assets` | Public 或后续 signed URL 架构 | 发布后需要公开的优化资源 |

不要把 `birthday-order-private` 改成 Public。

## 4. 配置 Edge Function Secrets

进入 **Edge Functions → Secrets**。添加以下键名：

| Name | Value |
| --- | --- |
| `CLAIM_TOKEN_SECRET` | 一串随机且足够长的私密文本 |
| `WALL_RATE_LIMIT_SECRET` | 另一串随机且足够长的私密文本 |
| `TIANAPI_KEY` | TianAPI 星座运势 Key |
| `JUHE_ALMANAC_KEY` | 聚合数据老黄历 Key |
| `PUBLIC_BIRTHDAY_BASE_URL` | `https://mengm919.github.io/birthday-intake-system/birthday.html` |

Supabase 内置的 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Edge Function 服务器使用，不要复制到前端。

## 5. 部署 Edge Functions

使用 Supabase CLI 时，在项目根目录运行：

```powershell
supabase functions deploy create-order
supabase functions deploy claim-order
supabase functions deploy submit-order
supabase functions deploy publish-order
supabase functions deploy get-published-page
supabase functions deploy daily-luck
supabase functions deploy post-public-blessing
```

如使用 Supabase 网页编辑器，请分别创建同名函数并粘贴对应目录的 `index.ts` 内容。每次更改 Secret 后，请在对应函数页面点击 **Deploy a new version**，让新版本读取 Secret。

## 6. 创建商家管理员

1. 在 Supabase **Authentication → Users** 创建你的邮箱/密码账号。
2. 复制该账号的 UID。
3. 在 SQL Editor 执行：

```sql
insert into public.admin_users (user_id)
values ('你的用户 UID')
on conflict (user_id) do nothing;
```

随后访问：

`https://mengm919.github.io/birthday-intake-system/admin.html`

用这个邮箱和密码登录。普通顾客账号不能进入后台。

## 7. GitHub Pages 部署

1. 将项目根目录的全部文件提交到 GitHub 仓库 `MengM919/birthday-intake-system` 的 `main` 分支。
2. GitHub → **Settings → Pages**。
3. 选择 **Deploy from a branch**。
4. 选择 `main` 和 `/root`，保存。
5. 等待部署完成后，访问：
   `https://mengm919.github.io/birthday-intake-system/`

本项目所有前端资源均使用相对路径，适配 `/birthday-intake-system/` 子路径。

## 8. 上线前必须做

- 在后台创建一张基础心意款测试订单。
- 用无痕窗口打开领取链接，完成六步填写和提交。
- 回到后台审核并发布，打开生成的生日页链接。
- 写一条公开祝福，检查其是否即时显示。
- 开启今日好运，确认没有任何第三方 API Key 出现在浏览器 Network 请求中。
- 按 [TEST_CHECKLIST.md](TEST_CHECKLIST.md) 完成全部关键项。
