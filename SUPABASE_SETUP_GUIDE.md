# Supabase 商用接入操作手册

这份说明写给没有编程基础的人。你只要照步骤操作，不需要改数据库代码。

## 1. 创建 Supabase 项目

1. 打开 `https://supabase.com/`。
2. 登录后点击 `New project`。
3. Organization 选择你的账号。
4. Project name 填：`birthday-intake-system`。
5. Database Password 设置一个强密码，自己保存好。
6. Region 选离你的客户更近的区域。
7. 点击 `Create new project`，等待项目创建完成。

## 2. 找到 Project URL 和 Publishable Key

1. 进入 Supabase 项目。
2. 左侧点 `Project Settings`。
3. 点 `API`。
4. 复制 `Project URL`。
5. 复制 `Project API keys` 里的 `publishable` key。
6. 不要复制 service_role 到前端，也不要发给客户。

## 3. 修改前端配置

打开项目里的 `config/supabase.js`，改成：

```js
window.BD_SUPABASE_CONFIG = {
  enabled: true,
  url: "你的 Project URL",
  publishableKey: "你的 publishable key",
  privateBucket: "birthday-order-private",
  publishedBucket: "birthday-published-assets",
  edgeFunctionRegion: "default"
};
```

注意：只能填写 Publishable Key。不要把 `service_role`、`secret`、数据库密码写进这里。

## 4. 开启 Anonymous Auth

1. Supabase 左侧点 `Authentication`。
2. 点 `Providers`。
3. 找到 `Anonymous Sign-Ins`。
4. 打开它。
5. 保存。

顾客不需要注册邮箱密码，页面会用匿名登录建立身份。

## 5. 运行数据库 migration

1. Supabase 左侧点 `SQL Editor`。
2. 点击 `New query`。
3. 打开本项目文件：`supabase/migrations/0001_initial_schema.sql`。
4. 全选复制内容，粘贴到 SQL Editor。
5. 点击 `Run`。

运行成功后会创建：套餐、模板、订单、订单内容、订单模块、订单文件、好友留言、管理员、订单事件、授权记录等表。

## 6. 确认 Storage bucket

运行 migration 后会自动创建两个 bucket：

- `birthday-order-private`：保存客户原图，必须是 Private。
- `birthday-published-assets`：保存发布后的优化资源，第一版也保持 Private。

检查方式：

1. 左侧点 `Storage`。
2. 看 bucket 列表是否有上面两个名字。
3. 确认 `birthday-order-private` 没有被设置为 Public。

## 7. 配置 Edge Functions secrets

Supabase 左侧点 `Edge Functions`，进入 Secrets 或用 Supabase CLI 设置以下变量：

```bash
SUPABASE_URL=你的 Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
CLAIM_TOKEN_SECRET=自己设置一串很长的随机字符
PUBLIC_BIRTHDAY_BASE_URL=https://mengm919.github.io/birthday-intake-system/pages/
```

这些是服务端密钥，只能存在 Supabase Edge Functions，不能放进 GitHub。

## 8. 部署 Edge Functions

如果你会用 Supabase CLI，可以在项目目录执行：

```bash
supabase functions deploy create-order
supabase functions deploy claim-order
supabase functions deploy submit-order
supabase functions deploy delete-order
supabase functions deploy publish-order
```

如果暂时不会 CLI，可以先保留这些文件，后续请会技术的人帮你部署。静态页面仍可继续本地演示。

## 9. 创建管理员

先在 Supabase Authentication 里创建一个商家账号。

1. 左侧点 `Authentication`。
2. 点 `Users`。
3. 创建或邀请你的商家账号。
4. 复制这个用户的 `User UID`。
5. 进入 `SQL Editor`，运行：

```sql
insert into public.admin_users (user_id, role, display_name)
values ('把这里换成你的 User UID', 'owner', '店主')
on conflict (user_id) do update set role = 'owner';
```

## 10. 测试第一张订单

正式流程是：

1. 商家后台调用 `create-order`。
2. 系统生成订单号和领取 token。
3. 把链接发给顾客。
4. 顾客打开链接，匿名登录。
5. 调用 `claim-order` 领取订单。
6. 顾客填写资料、上传照片、提交。
7. 商家后台审核。
8. 调用 `publish-order` 生成生日网页配置。

当前前端仍保留本地 Mock 流程，方便你没有配置 Supabase 前继续演示。

## 11. 检查 RLS 是否生效

最简单的检查：

1. 用 A 浏览器领取 A 订单。
2. 用 B 浏览器领取 B 订单。
3. A 浏览器尝试读取 B 订单 ID。
4. 正确结果：A 看不到 B 的订单。

不要为了方便测试关闭 RLS。

## 12. 检查别人看不到客户照片

1. 上传一张照片到 `birthday-order-private`。
2. 不要生成 signed URL，直接复制文件路径访问。
3. 正确结果：不能公开访问。
4. 只有当前订单顾客或管理员通过 signed URL 才能预览。

## 13. 隐私默认规则

- 页面默认不进入公开案例库。
- `index.html` 已设置：`<meta name="robots" content="noindex,nofollow">`。
- 默认允许送礼人转发网页链接。
- 默认不允许搜索引擎收录。
- 用户提交前必须勾选隐私授权，不能预选。

## 14. 部署到 GitHub Pages

修改完文件后，把整个项目推送到 GitHub。进入仓库：

1. 点 `Settings`。
2. 点 `Pages`。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main`。
5. Folder 选择 `/root`。
6. 保存。
7. 等 1 到 5 分钟打开你的 Pages 地址。

当前地址：

`https://mengm919.github.io/birthday-intake-system/`
