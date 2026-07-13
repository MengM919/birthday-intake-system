# 当前架构审计

本文件记录当前 `birthday-intake-system` 的实际结构、风险和分阶段升级路线。目标是在不推翻现有 8 步填写体验的前提下，把静态 MVP 逐步升级为可商业化接单、可保存客户资料、可私有保存照片、可审核发布生日网页的系统。

## A. 当前架构审计

### 当前项目结构

- `index.html`：单页入口，包含 8 步信息收集流程、本地商家后台入口、模板预览弹窗。
- `styles.css`：移动端优先的整体 UI 样式、套餐卡、模板卡、上传区、模块配置区、Mock 后台样式。
- `app.js`：所有页面交互逻辑，包括状态管理、套餐切换、模板选择、图片本地预览、祝福语生成、模块表单、订单 JSON、Local Mock 后台。
- `config/plans.js`：4 档套餐配置。
- `config/templates.js`：11 套模板配置和预览图路径。
- `config/modules.js`：功能模块配置。内部模块 ID `surpriseBox` 已存在。
- `assets/templates/T01` 到 `assets/templates/T11`：模板预览图。
- `examples/order-sample.json`：示例订单 JSON。
- `.env.example`：预留环境变量说明，目前前端没有真实 Supabase 接入。

### localStorage 使用位置

当前系统仍把浏览器本地存储当作主要数据来源：

- 草稿 key：`bd_intake_draft_v1`
  - `persistDraft()` 保存当前填写状态。
  - `restoreDraft()` 页面刷新后恢复。
- 订单 key：`bd_intake_orders_v1`
  - `saveOrder()` 把提交后的订单 JSON 保存到本机浏览器。
  - `readOrders()` 给 Mock 后台读取本地订单列表。
  - `updateOrderStatus()` 在本地修改订单状态。

风险：localStorage 只能存在当前浏览器，换设备、清缓存、手机微信环境异常退出都可能丢失。它不能作为正式订单数据库，只能保留为离线草稿和网络失败备份。

### Mock Admin 使用位置

当前后台是纯前端演示：

- `index.html` 中 `adminView` 写有 `Local Mock Admin`。
- `app.js` 中 `adminPassword = "demo-admin"`。
- `unlockAdmin()` 只校验前端固定密码。
- `renderAdminOrders()` 从 localStorage 读取订单。
- `renderOrderDetail()` 展示本地 JSON。

风险：任何人打开网页都能看到后台入口，固定密码写在公开 JS 内，不具备真实安全性。商业化必须改成 Supabase Auth + `admin_users` 权限 + RLS。

### 模块配置结构

当前模块来源于 `config/modules.js`，套餐通过 `includedModules`、`optionalModulePool`、`optionalPickCount` 控制功能显示。`app.js` 根据模块 ID 渲染不同表单。

已有核心模块：

- `gallery`
- `messageWall`
- `wishBottle`
- `surpriseBox`
- `playlist`
- `partyChecklist`
- `bgm`
- `countdown`
- `hiddenEgg`
- `birthdayMap`
- `futureMailbox`
- `giftVote`
- `dailyLuck`
- `multiContributor`

后续数据库中需要兼容更多标准模块名，例如 `friendCollaboration`。第一阶段不改已有 ID，避免破坏现有订单 JSON。

### surpriseBox 当前调用位置

内部 ID：`surpriseBox`

当前已经在大部分用户可见 UI 中显示为“惊喜盲盒”，但 README 仍残留“好友盲盒”。`app.js` 里旧数据结构仍是：

```json
{
  "title": "来自朋友的惊喜",
  "content": "",
  "openAt": "birthday",
  "motif": "cat"
}
```

风险：后续必须迁移为新的配置结构，同时兼容旧草稿：

```json
{
  "displayName": "惊喜盲盒",
  "imageryCode": "kitten",
  "secondaryImageryCode": null,
  "surpriseTitle": "给你藏了一份小惊喜",
  "surpriseMessage": "",
  "signature": "",
  "revealMode": "click",
  "durationSeconds": 6,
  "soundEnabled": false,
  "customAttachmentFileId": null
}
```

### GitHub Pages 子路径

项目部署在：

`/birthday-intake-system/`

当前资源路径基本使用相对路径，例如：

- `config/plans.js`
- `config/templates.js`
- `assets/templates/T01/preview.png`

这类路径适配 GitHub Pages 子路径。后续新增脚本和资产也必须继续使用相对路径，不能写成站点根路径 `/assets/...`。

## B. 实施计划

1. 保留现有 8 步 UI 和套餐驱动逻辑。
2. 先修正“惊喜盲盒”产品层：统一命名、增加 8 种意象、保存标准配置、增加沉浸式预览渲染器。
3. 新增 Supabase schema、RLS、Storage bucket 策略和 Edge Functions 骨架。
4. 前端先加入 Supabase 配置和模块化 JS，但默认不破坏当前静态可用性。
5. 再逐步把正式订单、照片、后台从 localStorage 迁移到 Supabase。
6. 保留 localStorage 作为临时草稿和网络异常备份。

## C. 需要新增和修改的文件

### 新增

- `config/imagery.js`
- `assets/imagery/*/preview.webp`
- `js/surprise-renderer.js`
- `js/supabase-client.js`
- `js/auth.js`
- `js/orders.js`
- `js/storage.js`
- `js/autosave.js`
- `js/admin.js`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/functions/claim-order/index.ts`
- `supabase/functions/create-order/index.ts`
- `supabase/functions/submit-order/index.ts`
- `supabase/functions/delete-order/index.ts`
- `supabase/functions/publish-order/index.ts`
- `SUPABASE_SETUP_GUIDE.md`
- `DEPLOYMENT_GUIDE.md`
- `TEST_CHECKLIST.md`

### 修改

- `index.html`：加载新配置和 JS，保留 noindex。
- `app.js`：兼容旧 surpriseBox 数据，渲染 8 种意象卡，生成标准订单 JSON，加入 birthdayPageConfig 预备数据。
- `styles.css`：增加意象选择卡和沉浸式渲染样式。
- `README.md`：把“好友盲盒”全部改为“惊喜盲盒”，说明 Supabase 后续接入。
- `.env.example`：补充公开前端配置和禁止提交 secret 的说明。

## D. 潜在风险

- 真实 Supabase 接入需要你创建自己的 Supabase 项目，并把 Project URL、Publishable Key 填到前端配置；我不能替你生成真实云端密钥。
- GitHub Pages 是纯静态托管，不能安全保存 service role key；所有高权限操作必须放在 Supabase Edge Functions。
- Private Storage 的 RLS 策略必须严格验证 `orders.customer_user_id = auth.uid()`，不能用“所有登录用户都能上传”的宽泛规则。
- Anonymous Auth + 领取 token 是核心安全边界，数据库中只能存 token hash，不能存明文 token。
- 当前照片预览使用 base64 存到 localStorage，正式版必须改为 Supabase Storage，否则手机端容易超出本地存储限制。
- 商家后台从 Mock 迁移到真实 Auth 时，要避免普通顾客读取订单列表。
- GitHub Pages 缓存可能让线上版本延迟几分钟，测试时需要用浏览器无痕或加版本参数。

## E. 分阶段开发顺序

### 阶段 0：现有仓库审计

已完成本文件，记录当前结构、localStorage、Mock Admin、模块配置、`surpriseBox` 引用和迁移风险。

### 阶段 1：惊喜盲盒静态体验升级

- 保留内部 ID `surpriseBox`。
- 用户可见名称统一为“惊喜盲盒”。
- 新增 8 种意象配置。
- 选择惊喜盲盒后动态展开意象卡。
- 订单 JSON 保存 `imageryCode`、`surpriseTitle`、`surpriseMessage` 等标准字段。
- 新增沉浸式预览渲染器，先在静态页面可用。

### 阶段 2：Supabase schema 和 seed data

创建数据库 migration，包含套餐、模板、订单、内容、模块、文件、好友留言、管理员、事件、授权记录等表，并写入初始套餐和模块数据。

### 阶段 3：Auth + RLS

启用 Supabase Anonymous Auth 和 RLS，验证普通用户只能读写自己的订单，管理员通过 `admin_users` 获得订单管理权限。

### 阶段 4：订单领取

实现 `claim-order` Edge Function，支持订单号 + 一次性 token 领取订单，成功后绑定 `auth.uid()`。

### 阶段 5：草稿数据库保存

保留 localStorage 备份，新增 Supabase upsert 自动保存，显示“正在保存 / 已保存 / 保存失败 / 当前离线”状态。

### 阶段 6：Storage 图片上传

上传客户照片到 private bucket，只保存 bucket 和 storage_path，支持失败重试、删除、排序和数量限制。

### 阶段 7：惊喜盲盒配置持久化

把 `surpriseBox` 配置写入 `order_modules.configuration`，生日网页生成器读取 `imageryCode` 和沉浸式配置。

### 阶段 8：submit-order 服务端校验

实现服务端校验套餐、照片数量、必填字段、隐私勾选、惊喜盲盒意象枚举，提交后状态进入 `submitted`。

### 阶段 9：真实商家后台

替换 Local Mock Admin，使用 Supabase Auth 登录和 `admin_users` 权限读取真实订单、文件预览、状态流转和内部备注。

### 阶段 10：完整测试

覆盖新访客、匿名登录、正确 token、错误 token、过期 token、跨用户隔离、照片权限、套餐上限、惊喜盲盒配置、移动端动画、刷新恢复、提交状态等。

### 阶段 11：部署 GitHub Pages

提交并推送到 GitHub，等待 Pages 自动重新部署，验证 `/birthday-intake-system/` 子路径下所有资源无 404。

### 阶段 12：中文操作手册

输出无编程基础也能照着做的 Supabase 设置、部署和检查文档。
