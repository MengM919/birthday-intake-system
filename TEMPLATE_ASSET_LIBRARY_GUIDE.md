# 模板资产库与生日页面生成器部署说明

这份说明对应本轮的“11 套模板资产库 + 生日页面生成器”升级。它不会公开客户照片、不会要求把任何高权限密钥放进 GitHub。

## 这次升级包含什么

- 11 套模板不再只是预览图，而是各自拥有颜色、封面形状、字体气质、卡片样式、按钮样式、装饰元素和模块规则。
- `template-library.html` 是商家可查看的模板资产库；客户填写订单时仍从同一套模板中选择。
- 每次发布生日页都会保存一份模板与订单数据快照。以后即使修改模板，已经交付的生日页也不会被改坏。
- 惊喜盲盒不再让客户选择意象。生日页每次打开时，会在 8 个温暖场景中轮换，并避免连续重复。
- 两档套餐都支持不限张原始相册照片；生日页首页会自动精选 8 张，其他照片继续在相册中翻阅。

## 第一次部署：运行数据库迁移

1. 打开 Supabase 项目。
2. 点击左侧 **SQL Editor**。
3. 点击上方 `+` 或 `New`，创建一个空白查询。
4. 打开项目中的 `supabase/migrations/0007_template_asset_library_and_generated_pages.sql`，复制全部内容到 SQL 编辑器。
5. 点击右上角 **Run**。
6. 看到 `Success. No rows returned` 就表示迁移完成。

这一步会：

- 把数据库中 `basic_166` 和 `upgrade_288` 的 `photo_limit` 改为 `NULL`，其中 `NULL` 的含义是“不限张”，不是 `-1`。
- 保存 11 套模板的结构化配置。
- 建立模板版本、模板资源、盲盒场景、发布页面快照与页面资源绑定表。

## 检查套餐是否正确

在 SQL Editor 新建查询，运行：

```sql
select code, name, price, photo_limit, is_active
from public.plans
order by price;
```

正确结果应当是：

- `basic_166` / 基础心意款 / `16.60` / `photo_limit` 为空 / `true`
- `upgrade_288` / 惊喜升级款 / `28.80` / `photo_limit` 为空 / `true`
- 旧套餐可以保留作历史订单读取，但 `is_active` 应为 `false`。

## 重新部署三个 Edge Functions

本轮请重新部署：

- `submit-order`
- `publish-order`
- `get-published-page`

如果你使用 Supabase CLI，在项目根目录运行：

```bash
supabase functions deploy submit-order
supabase functions deploy publish-order
supabase functions deploy get-published-page
```

如果使用 Supabase 网页控制台：进入 **Edge Functions**，打开对应 Function，点击右上角部署新版本的入口；把仓库中同名 `index.ts` 的最新内容粘贴进去，再点击 **Deploy**。三个函数都要各做一次。

## Secret 要不要新增

通常不需要新增新的 Secret。

你已经有的：

- `CLAIM_TOKEN_SECRET`
- `PUBLIC_BIRTHDAY_BASE_URL`

可以继续使用。只要确认 `PUBLIC_BIRTHDAY_BASE_URL` 的值是：

```text
https://mengm919.github.io/birthday-intake-system/birthday.html
```

不要把 `SUPABASE_SERVICE_ROLE_KEY`、数据库密码或任何私钥放进 `config/supabase.js`、GitHub 或网页代码。它们只能留在 Supabase 的服务器环境中。

## 发布一张测试生日页

1. 打开商家后台：`https://mengm919.github.io/birthday-intake-system/admin.html`。
2. 登录商家账号，新建 `基础心意款 ¥16.6` 或 `惊喜升级款 ¥28.8` 的订单。
3. 复制领取链接，用手机无痕窗口打开，填写资料并提交。
4. 回到商家后台，把订单标记为通过，再点击发布。
5. 打开系统生成的生日页链接。
6. 检查：模板配色、封面图、主祝福、倒计时、相册、祝福墙以及已开启模块是否都正常。

新发布的订单会在 `generated_pages` 中保存快照；历史页面不会因为以后修改模板而变样。

## GitHub Pages

提交并推送仓库后，GitHub Pages 会自动发布静态页面。线上入口：

- 客户填写页：`https://mengm919.github.io/birthday-intake-system/`
- 商家后台：`https://mengm919.github.io/birthday-intake-system/admin.html`
- 模板资产库：`https://mengm919.github.io/birthday-intake-system/template-library.html`

如果刚推送后仍看到旧页面，请刷新一次，或使用浏览器无痕窗口打开。页面脚本已带版本号，会优先绕过旧缓存。