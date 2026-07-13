# 测试清单

## 静态页面基础测试

- [ ] 新访客打开页面，无 JavaScript 报错。
- [ ] 点击“继续”可以从 Step 1 进入 Step 2。
- [ ] 点击“上一步”可以返回。
- [ ] 默认能看到 4 档套餐。
- [ ] 能看到 11 套模板卡片。
- [ ] 模板预览图无 404。
- [ ] 意象预览图 `assets/imagery/*/preview.webp` 无 404。
- [ ] 选择套餐后，照片上限会变化。
- [ ] 16.9 元套餐严格 3 选 2。
- [ ] 上传封面照片成功。
- [ ] 上传相册照片成功。
- [ ] 超过套餐照片数量会提示。
- [ ] Step 5 先显示自定义祝福，再显示 AI 候选生成。
- [ ] 不填写 TA 情况时，生成候选文案会提示。
- [ ] 填写 TA 情况后生成 3 条候选文案。
- [ ] Step 6 模块名显示“惊喜盲盒”，没有“好友盲盒”。
- [ ] 选择惊喜盲盒后出现 8 种意象卡。
- [ ] 不选 `imageryCode` 或不填惊喜祝福时不能提交。
- [ ] 选择小猫后，订单 JSON 保存 `kitten`。
- [ ] 选择鲜花后，订单 JSON 保存 `flowers`。
- [ ] 点击“预览沉浸惊喜”有 300ms 内视觉反馈。
- [ ] 惊喜动画可以关闭。
- [ ] 惊喜动画结束后页面可继续操作。
- [ ] 手机 390×844 尺寸下不遮挡底部按钮。
- [ ] `prefers-reduced-motion` 下动画减少。
- [ ] Step 1 到 Step 8 可以完整走完。
- [ ] 最终能生成订单 JSON。
- [ ] JSON 包含 `birthdayPageConfig.modules.surpriseBox.imageryCode`。
- [ ] 隐私默认：允许分享、不允许搜索收录、访问方式为公开链接但不公开索引。
- [ ] 用户提交前隐私勾选框没有预选。

## Supabase 数据测试

- [ ] Anonymous Auth 可用。
- [ ] 正确订单号 + token 可以领取订单。
- [ ] 错误 token 不能领取。
- [ ] 过期 token 不能领取。
- [ ] 已被 A 用户领取的订单，B 用户不能领取。
- [ ] A 用户不能读取 B 用户订单。
- [ ] A 用户不能读取 B 用户照片。
- [ ] Basic 不能上传第 6 张相册图。
- [ ] Heart 不能上传第 13 张相册图。
- [ ] 提交时服务端校验必填字段。
- [ ] 启用 surpriseBox 时，服务端校验 `imageryCode` 枚举。
- [ ] 提交成功后订单状态进入 `submitted`。
- [ ] `order_events` 记录 `order_submitted`。
- [ ] `privacy_consent_at` 正确保存。
- [ ] `birthday-order-private` 不能公开访问。
- [ ] signed URL 到期后需要刷新。
- [ ] 删除订单时同步删除 Storage 文件。

## 商家后台测试

- [ ] 普通顾客无法读取后台订单列表。
- [ ] `admin_users` 中的管理员可以读取订单列表。
- [ ] 后台能看到订单号、套餐、模板、寿星姓名、生日、关系、送礼人、联系方式、渠道、照片数量、功能、惊喜盲盒意象、状态、创建时间、提交时间。
- [ ] 后台可以筛选待填写、填写中、已提交、审核中、需修改、已批准、生成中、已发布、已取消。
- [ ] 后台可以复制 `birthdayPageConfig`。
- [ ] 后台可以修改订单状态。

## GitHub Pages 子路径测试

- [ ] 在线地址 `/birthday-intake-system/` 下打开正常。
- [ ] `config/plans.js` 无 404。
- [ ] `config/templates.js` 无 404。
- [ ] `config/modules.js` 无 404。
- [ ] `config/imagery.js` 无 404。
- [ ] `js/surprise-renderer.js` 无 404。
- [ ] 11 张模板图无 404。
- [ ] 8 张意象图无 404。
