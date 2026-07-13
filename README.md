# 定制生日祝福网页信息收集系统

这是一个静态网页 MVP，用来给“商业化定制生日祝福网页”收集客户资料。当前静态版可以直接上传到 GitHub Pages 或 Cloudflare Pages 预览。正式商用版需要按 `SUPABASE_SETUP_GUIDE.md` 接入 Supabase，用来保存订单、照片和后台权限。

## 这个项目能做什么

- 客户先选择套餐，再选择 11 套模板中的 1 套。
- 表单会按套餐自动显示需要填写的模块。
- 支持上传封面图和相册图，浏览器内本地预览。
- 支持生日倒计时逻辑：今年生日没到就算今年，已经过了就算下一年。
- 支持本地生成标准订单 JSON。
- 带一个本地 Mock 商家后台，可以查看刚提交的订单。正式商用时要切到 Supabase 后台。

## 文件说明

- `index.html`：网页入口。
- `styles.css`：页面样式。
- `app.js`：页面交互逻辑。
- `config/plans.js`：套餐配置。
- `config/templates.js`：模板配置。
- `config/modules.js`：功能模块配置。
- `config/imagery.js`：惊喜盲盒的 8 种意象配置。
- `assets/templates/T01` 到 `assets/templates/T11`：11 张模板预览图。
- `examples/order-sample.json`：标准订单 JSON 示例。
- `.env.example`：以后接 Supabase / 后台时才会用到，现在不要填写 secret key。
- `SUPABASE_SETUP_GUIDE.md`：正式商用接入 Supabase 的中文步骤。

## 怎么预览

最简单的方法：双击打开 `index.html`。

如果浏览器安全限制导致图片或脚本异常，可以把整个文件夹上传到 GitHub Pages 或 Cloudflare Pages 后看线上地址。

## 怎么改套餐

打开 `config/plans.js`。

常改的地方：

- `name`：套餐名。
- `priceCny`：价格。
- `galleryLimit`：最多上传多少张相册图。
- `includedModules`：套餐固定包含哪些功能。
- `optionalModulePool`：可选加购功能池。
- `optionalPickCount`：客户需要从可选功能里选几个。

模块英文名不要随便改，页面逻辑会识别这些名字，例如：

- `messageWall`：留言墙
- `wishBottle`：许愿瓶
- `surpriseBox`：惊喜盲盒
- `playlist`：生日歌单
- `partyChecklist`：派对清单
- `hiddenEgg`：隐藏彩蛋

## 怎么换模板图

模板图在这里：

`assets/templates/T01/preview.png`

想换 T01，就把新的图片命名为 `preview.png`，替换这个文件。

注意：

- 每个模板文件夹都叫 `T01`、`T02` 这种编号。
- 每张预览图都叫 `preview.png`。
- 如果想改模板名字、标签、介绍，打开 `config/templates.js` 修改。

## 怎么改功能模块名字

打开 `config/modules.js`。

常改的地方：

- `name`：页面上显示的模块名称。
- `short`：一句简短说明。

不建议改 `id`，除非你也会同步改 `app.js`。

## 本地后台怎么用

页面右上角切换到“商家后台”。

演示密码：`demo-admin`

注意：这个密码只是本地 Mock，不能当真正的后台安全方案。真实商用时要改成 Supabase Auth + admin_users 权限 + RLS。

## 惊喜盲盒怎么配置

内部模块 ID 仍然是 `surpriseBox`，不要改。页面上给客户看到的名字统一是“惊喜盲盒”。

打开 `config/imagery.js` 可以看到 8 种意象：小猫、烟花、鲜花、星星、蝴蝶、生日气球、海浪、花瓣雨。客户在 Step 6 选择意象后，订单 JSON 会保存 `imageryCode`，以后生日网页生成器会根据它渲染沉浸式惊喜。

第一版每个惊喜盲盒只选择一个主意象。高套餐未来可以扩展为主意象 + 辅助意象。

## 怎么上传到 GitHub Pages

不要只上传 zip 文件。GitHub Pages 需要看到 `index.html` 这些真实文件。

步骤：

1. 在 GitHub 新建仓库，例如 `birthday-blessing`。
2. 进入仓库后，点击 `uploading an existing file`。
3. 打开本项目文件夹，把里面的文件和文件夹拖进去：`index.html`、`styles.css`、`app.js`、`config`、`assets`、`examples`、`README.md`。
4. 页面底部点击 `Commit changes`。
5. 进入仓库 `Settings`。
6. 左侧点 `Pages`。
7. `Build and deployment` 选择 `Deploy from a branch`。
8. `Branch` 选择 `main`，目录选择 `/root`，然后保存。
9. 等 1 到 5 分钟，访问 GitHub 给你的 Pages 地址。

如果 404：

- 检查仓库里有没有 `index.html`。
- 检查是不是只上传了 zip。
- 检查 Pages 分支是不是 `main / root`。
- GitHub Pages 第一次生效有时会慢几分钟。

## 怎么部署到 Cloudflare Pages

1. 先把这些文件上传到 GitHub 仓库。
2. 打开 Cloudflare Pages，选择连接 GitHub 仓库。
3. Framework preset 选择 `None` 或不选择框架。
4. Build command 留空。
5. Output directory 填 `/` 或留空。
6. 点击部署。

## 现在还没有做什么

这个 MVP 按要求没有接：

- 真实 API
- 登录
- 支付
- 淘宝接口
- 数据库

当前订单只保存在浏览器本地。换电脑、清浏览器数据后，本地订单会消失。

## 下一步建议

- 阶段 2：接 Supabase，保存真实订单和图片。
- 阶段 3：做商家真实后台登录和订单审核。
- 阶段 4：接自动生成生日网页的生产流程。
