# 商家发布生日页面

这份说明写给商家。它对应的完整流程是：

1. 商家创建订单并把领取链接发给客户。
2. 客户填写资料、上传照片、提交订单。
3. 商家登录后台，检查照片、文案和模块。
4. 点击“标记通过”。
5. 点击“发布生日页”。
6. 系统生成一个只通过链接访问的生日页；复制链接发给送礼人。

## 第一次发布前，只需做一次

### 1. 部署两个最新的 Edge Functions

在 Supabase 的 Edge Functions 中部署或重新部署：

- `publish-order`
- `get-published-page`

如果使用 Supabase CLI，在项目目录运行：

```bash
supabase functions deploy publish-order
supabase functions deploy get-published-page
```

其中 `get-published-page` 是公开生日页读取已发布订单的函数。它只接受不可预测的 slug，不开放数据库表的公开读取权限。

### 2. 设置公开生日页地址

进入 Supabase：

`Edge Functions` -> `Secrets` -> `Add secret`

新建：

| Name | Value |
| --- | --- |
| `PUBLIC_BIRTHDAY_BASE_URL` | `https://mengm919.github.io/birthday-intake-system/birthday.html` |

保存后，重新部署 `publish-order`。

不要在这里填写 service role key，也不要把任何私密密钥放到 GitHub。

## 每张订单怎么发布

1. 打开项目首页，点击右上角“商家后台”。
2. 用已加入 `admin_users` 的商家邮箱、密码登录。
3. 在订单列表选择状态为 `submitted` 的订单。
4. 检查寿星姓名、祝福语、照片数量、套餐、模板和惊喜盲盒配置。
5. 点击“标记通过”。
6. 点击“发布生日页”。
7. 系统显示“专属生日页链接”；点击“复制链接”。
8. 用手机无痕窗口打开一次，确认图片、文案和惊喜盲盒正常。
9. 将链接发给送礼人。

## 隐私规则

- 发布页有 `noindex,nofollow`，不会进入公开案例库。
- 图片原图一直保存在私有 bucket。
- 公开页读取时才生成 1 小时有效的图片链接。
- 页面链接本身要当作礼物链接保管，不要发到公开评论区。
- 需要下线时，在后台将订单状态改为 `archived`，或使用删除订单功能。
