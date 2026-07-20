# 定制生日祝福网页

这是一个面向商业接单的生日网页制作系统。它保留 11 套视觉模板，并用 Supabase 保存订单、照片与发布状态。

顾客只会看到一份温暖、移动端优先的六步填写页；商家通过独立后台创建订单、审核资料、发布生日页。客户资料不会进入公开案例库，已发布生日页默认 `noindex,nofollow`，只能通过专属链接访问与转发。

## 产品套餐

| 套餐 | 价格 | 相册上限 | 已含内容 |
| --- | ---: | ---: | --- |
| 基础心意款 | ¥16.6 | 不限张 | 主祝福语、封面图、生日倒计时、回忆相册（首页精选 8 张，其余可继续翻阅）、公开祝福墙 |
| 惊喜升级款 | ¥28.8 | 不限张 | 包含基础内容；可按需同时开启许愿瓶、未来信箱、今日好运、惊喜盲盒与固定背景音乐 |

套餐由商家创建订单时锁定。顾客不能改套餐，但可以在正式提交前从 11 套模板中选择或更换风格。

## 顾客填写流程

1. 确认订单与选择模板
2. TA 与你
3. 上传与整理照片
4. 写下想送给 TA 的话
5. 配置生日惊喜
6. 预览并确认提交制作资料

照片区支持封面焦点、重点照片、触摸排序、单张失败重试。生日页固定展示 8 张重点回忆，其余照片在同一区域分页查看。

## 商家使用流程

1. 打开 `admin.html`，使用 Supabase 管理员账号登录。
2. 创建订单并选择基础心意款或惊喜升级款。
3. 复制后台生成的专属领取链接给顾客。
4. 顾客完成六步资料并提交后，在后台查看、审核或要求补充。
5. 将订单状态改为“已批准”，点击发布。
6. 复制后台生成的生日页链接发送给送礼人或寿星。

顾客页面不会展示 JSON、Storage 路径、测试入口或后台入口。订单 JSON 和 `birthdayPageConfig` 只在 `admin.html` 中提供给商家。

## 公开祝福墙与今日好运

- 祝福墙：任何拿到生日页链接的人都可以匿名查看、留言，提交后即时展示。服务端会清洗 HTML/外链，并限制同一 IP 每页 10 分钟最多 3 条。管理员可隐藏或删除明显违规内容。
- 今日好运：生日页只通过自有 `daily-luck` Edge Function 获取 TianAPI 星座运势与聚合数据老黄历。第三方 Key 绝不会出现在浏览器或 GitHub 中。

## 项目结构

- `index.html`、`styles.css`、`js/customer-app.js`：顾客六步填写页
- `admin.html`、`admin.css`、`js/admin-app.js`：独立商家后台
- `birthday.html`、`birthday.css`、`js/birthday-page.js`：已发布生日页
- `config/`：套餐、模板、模块、意象和前端 Supabase 配置
- `assets/templates/T01-T11/`：11 套模板预览图
- `supabase/migrations/`：数据库、RLS、公开祝福墙和今日好运缓存
- `supabase/functions/`：订单、发布、运势、祝福墙等 Edge Functions

## 部署与操作文档

- [六步重构与商家日常操作](SIX_STEP_REFACTOR_GUIDE.md)
- [GitHub Pages 与 Supabase 部署指南](DEPLOYMENT_GUIDE.md)
- [完整验收清单](TEST_CHECKLIST.md)
- [当前架构审计](CURRENT_REFACTOR_AUDIT.md)
- `SUPABASE_SETUP_GUIDE.md`：保留原有逐步 Supabase 配置说明。它已有本地改动，本轮不会覆盖。

## 本地预览

在项目根目录运行一个静态服务器后访问：

- 顾客页：`http://127.0.0.1:4173/`
- 商家后台：`http://127.0.0.1:4173/admin.html`
- 已发布生日页：`http://127.0.0.1:4173/birthday.html?slug=你的发布slug`

GitHub Pages 线上路径是：

`https://mengm919.github.io/birthday-intake-system/`

不要只上传 zip 文件。请将项目内所有文件和文件夹提交到 GitHub 仓库根目录，再通过 GitHub Pages 部署。

## 安全边界

前端只允许使用 `SUPABASE_URL` 与 Publishable Key。以下内容只能配置在 Supabase Edge Function Secrets，严禁提交 GitHub：

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLAIM_TOKEN_SECRET`
- `WALL_RATE_LIMIT_SECRET`
- `TIANAPI_KEY`
- `JUHE_ALMANAC_KEY`

- [模板资产库与生日页面生成器部署说明](TEMPLATE_ASSET_LIBRARY_GUIDE.md)

## Birthday page renderer 2.0

The public birthday page now has one renderer entry: `birthday.html -> js/birthday-page.js`. The page always prefers the immutable `generated_pages.config_snapshot`, so later template edits do not silently redesign already published gifts.

The first versioned 2.0 templates are `T01` (white line and bloom), `T02` (red-blue collage), and `T06` (pink midnight cinema). Their composition is resolved in `config/birthday-template-registry.js`; shared content and behavior stay in the renderer and its modules.

To add a new template variant later:

1. Add the visual asset metadata to `config/template-assets.js`.
2. Add its composition, visual and copy manifest to `config/birthday-template-registry.js`.
3. Add a versioned manifest migration under `supabase/migrations/`.
4. Add only the variant CSS needed for its hero/gallery/module material in `birthday.css`.
5. Publish a new test order and verify it on mobile before enabling it for customers.

For this release's exact Supabase and GitHub Pages steps, read [BIRTHDAY_PAGE_EXPERIENCE_DEPLOYMENT.md](BIRTHDAY_PAGE_EXPERIENCE_DEPLOYMENT.md). For the browser regression checklist, read [BIRTHDAY_PAGE_RENDERER_TEST_CHECKLIST.md](BIRTHDAY_PAGE_RENDERER_TEST_CHECKLIST.md).