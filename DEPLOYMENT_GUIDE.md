# 部署说明

## GitHub Pages 部署

1. 打开 GitHub 仓库：`https://github.com/MengM919/birthday-intake-system`。
2. 确认仓库根目录里能看到：`index.html`、`app.js`、`styles.css`、`config`、`assets`、`js`、`supabase`。
3. 进入 `Settings`。
4. 左侧点 `Pages`。
5. `Build and deployment` 选择 `Deploy from a branch`。
6. Branch 选择 `main`，目录选择 `/root`。
7. 保存。
8. 等 1 到 5 分钟访问：`https://mengm919.github.io/birthday-intake-system/`。

如果 404，优先检查：

- 仓库里是不是只上传了 zip，而不是解压后的真实文件。
- `index.html` 是否在仓库根目录。
- Pages 的目录是不是 `/root`。
- GitHub Actions 或 Pages 是否还在部署中。

## Cloudflare Pages 部署

1. 进入 Cloudflare Dashboard。
2. 点 `Workers & Pages`。
3. 点 `Create application`。
4. 选择 `Pages`。
5. 连接 GitHub 仓库。
6. Build command 留空。
7. Output directory 留空或填 `/`。
8. 部署。

这是纯静态项目，不需要 Node build。

## 部署前检查

- `index.html` 里资源路径必须是相对路径，例如 `config/imagery.js`，不能写 `/config/imagery.js`。
- `assets/templates/T01` 到 `T11` 都要有 `preview.png`。
- `assets/imagery` 下 8 个目录都要有 `preview.webp`。
- 不要提交 `SUPABASE_SERVICE_ROLE_KEY`。
- `config/supabase.js` 只能填 Publishable Key。
- 搜索引擎默认不收录：`index.html` 里保留 `noindex,nofollow`。

## 更新线上版本

每次改完代码后：

1. 提交到 GitHub。
2. 推送到 `main`。
3. GitHub Pages 自动部署。
4. 用无痕窗口打开线上地址检查。

GitHub Pages 有时会缓存几分钟。如果你刚推送就看到旧页面，等一会儿或在地址后加 `?v=时间` 再刷新。
