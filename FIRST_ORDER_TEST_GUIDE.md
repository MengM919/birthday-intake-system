# 第一张真实测试订单

本流程会测试真实 Supabase Auth、PostgreSQL、Private Storage、RLS 和 Edge Functions。请不要把 service_role、数据库密码或 CLAIM_TOKEN_SECRET 发给任何人。

## 测试前准备

1. 在 config/supabase.js 填入 Project URL 和 Publishable key，并把 enabled 改成 true。Project URL 只保留 https://项目ID.supabase.co，不要加 /rest/v1 或 /functions。
2. 确认 Authentication 的 Sign In / Providers 中已经开启 Anonymous。
3. 确认 Edge Functions 列表有 claim-order、create-order、submit-order、delete-order、publish-order 五项。
4. 在 SQL Editor 新建查询，复制运行 supabase/migrations/0002_client_role_grants.sql 的全部内容。看到 Success. No rows returned 即表示权限补丁完成。

## 创建第一个商家账号

1. 打开 Authentication -> Users。
2. 点 Add user -> Create new user。
3. 填一个你自己能登录的邮箱和强密码，选择自动确认邮箱（如果界面有此选项）。
4. 创建后复制该用户的 UID。
5. 打开 SQL Editor -> New query，运行下面 SQL。把 YOUR_ADMIN_UID 换成刚才复制的 UID。

    insert into public.admin_users (user_id, role, display_name)
    values ('YOUR_ADMIN_UID', 'owner', '店主')
    on conflict (user_id) do update
    set role = 'owner', display_name = '店主';

6. 打开 Table Editor -> admin_users，确认有一条 role 为 owner 的记录。

## 商家创建测试订单

1. 等 GitHub Pages 部署完成后，在电脑浏览器打开 https://mengm919.github.io/birthday-intake-system/。
2. 点击页面右上角的 商家后台。
3. 输入刚创建的商家邮箱与密码，点击 登录并进入后台。
4. 在 测试套餐 选择 轻心意版，在 测试模板 选择 T01，渠道选择 手动创建。
5. 点击 创建测试订单并生成领取链接。
6. 复制页面显示的 顾客领取链接。这个链接同时包含订单号和一次性领取 token；不要公开发到群里。

## 以顾客身份完成订单

1. 用无痕窗口、另一浏览器或手机打开刚才的领取链接。不要与商家后台使用同一个浏览器身份。
2. 页面会自动建立匿名身份、领取订单，并立即从地址栏移除 token。
3. 按 8 步完成填写。第一张测试建议使用轻心意版：
   - 填联系方式、寿星姓名、生日、送礼人昵称。
   - 不要修改套餐和模板，它们由商家创建链接时锁定。
   - 上传 1 张封面图与至少 1 张相册图。
   - 填首页主祝福；背景音乐保持默认曲库即可。
   - 勾选隐私授权。
4. 最后点击 提交并生成标准 JSON。
5. 正确结果是出现 JSON，订单状态变为 submitted，而不是只保存在浏览器本机。

## 在 Supabase 验收

1. Table Editor -> orders：找到新订单，status 应为 submitted，customer_user_id 不为空，submitted_at 不为空。
2. order_content：应有 1 条同一个 order_id 的内容记录。
3. order_modules：应有本套餐启用的模块记录。若选了惊喜盲盒，configuration 中必须有 imageryCode。
4. order_files：应至少有 2 条 uploaded 记录，分别为 cover 与 gallery。
5. Storage -> birthday-order-private：应出现 orders/订单UUID/顾客UUID/cover 和 gallery 路径下的文件。bucket 必须保持 Private。
6. 回到商家后台：应能看到该订单及 submitted 状态。

## 常见失败

- 商家登录后提示没有权限：检查 admin_users 中 UID 是否与 Authentication 用户 UID 完全一致。
- 顾客打开链接提示无法领取：确认 CLAIM_TOKEN_SECRET 创建后没有被改过，且链接未过期、未被其他浏览器领取。
- 自动保存或上传提示权限不足：确认已经运行 0002_client_role_grants.sql，并且顾客打开的是带 order 和 token 的领取链接。
- 提交时提示缺照片：确认 order_files 中 cover 和 gallery 的 status 都是 uploaded。
- 不要为了排错关闭 RLS，也不要把 private bucket 改成 Public。