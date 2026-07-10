(function () {
  "use strict";

  const plans = window.BD_PLANS || [];
  const templates = window.BD_TEMPLATES || [];
  const moduleCatalog = window.BD_MODULES || {};
  const draftKey = "bd_intake_draft_v1";
  const ordersKey = "bd_intake_orders_v1";
  const adminPassword = "demo-admin";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    currentStep: 1,
    planId: "P01",
    templateId: "T01",
    selectedOptionalModules: [],
    order: {
      orderChannel: "taobao",
      orderNo: "",
      contactMethod: "wechat",
      contactValue: ""
    },
    recipient: {
      recipientName: "",
      birthday: "",
      showAge: false,
      relationshipType: "lover",
      relationshipOther: ""
    },
    sender: {
      senderName: "",
      senderAnonymous: false
    },
    content: {
      headline: "",
      longMessage: "",
      signature: "",
      aiFacts: "",
      aiTone: "warm"
    },
    media: {
      cover: null,
      gallery: []
    },
    music: {
      bgmMode: "library",
      musicId: "music_soft_001",
      songName: "",
      artist: "",
      uploadedAudioName: ""
    },
    privacy: {
      allowShare: true,
      showSenderName: true,
      allowIndexing: false,
      pageVisibility: "unlisted",
      privacyConfirmed: false
    },
    modules: {}
  };

  const defaults = {
    messageWall: [{ author: "", text: "" }],
    wishBottle: {
      title: "生日愿望瓶",
      prompt: "把今年最想实现的小愿望放进瓶子里",
      wishCount: 3,
      isPublic: false
    },
    surpriseBox: [{ title: "来自朋友的惊喜", content: "", openAt: "birthday" }],
    playlist: [{ song: "", artist: "", reason: "" }],
    partyChecklist: ["拍一张合照", "唱生日歌", "许下生日愿望"],
    hiddenEgg: { trigger: "longPress", title: "隐藏祝福", content: "" },
    birthdayMap: [{ place: "", story: "", link: "" }],
    futureMailbox: { openDate: "", content: "" },
    giftVote: [{ name: "", reason: "" }, { name: "", reason: "" }],
    dailyLuck: { enabled: true, zodiac: "", note: "今日好运占位模块，不接真实 API。" },
    multiContributor: { enabled: true, moderation: "manual", link: "提交后生成好友填写链接" }
  };

  function init() {
    try {
      restoreDraft();
      normalizeState();
      bindEvents();
      renderPlans();
      renderTemplates();
      syncFormFromState();
      setStep(state.currentStep);
      renderUploads();
      renderModules();
      renderProgress();
      renderAdminFilters();
    } catch (error) {
      console.error("Birthday intake system initialization failed:", error);
      alert(
        "页面初始化失败，请检查配置文件是否完整。错误信息：" +
        error.message
      );
    }
  }

  function bindEvents() {
    $("#orderForm").addEventListener("input", handleFormChange);
    $("#orderForm").addEventListener("change", handleFormChange);

    $("#planGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-plan-id]");
      if (!button) return;
      state.planId = button.dataset.planId;
      state.selectedOptionalModules = defaultOptionalModules();
      trimGalleryToPlan();
      normalizeState();
      renderPlans();
      renderUploads();
      renderModules();
      renderProgress();
      persistDraft();
    });

    $("#templateGrid").addEventListener("click", (event) => {
      const selectButton = event.target.closest("[data-template-id]");
      const previewButton = event.target.closest("[data-preview-template]");
      if (previewButton) {
        openTemplatePreview(previewButton.dataset.previewTemplate);
        return;
      }
      if (!selectButton) return;
      state.templateId = selectButton.dataset.templateId;
      renderTemplates();
      renderProgress();
      persistDraft();
    });

    $("#prevStep").addEventListener("click", () => setStep(state.currentStep - 1));
    $("#nextStep").addEventListener("click", () => {
      if (state.currentStep === 8) {
        submitOrder();
        return;
      }
      setStep(state.currentStep + 1);
    });

    $$(".upload-trigger").forEach((button) => {
      button.addEventListener("click", () => $("#" + button.dataset.fileTarget).click());
    });
    $("#coverInput").addEventListener("change", (event) => loadCover(event.target.files[0]));
    $("#galleryInput").addEventListener("change", (event) => loadGallery(event.target.files));
    setupDropZone($("#coverDrop"), (files) => loadCover(files[0]));
    setupDropZone($("#galleryDrop"), (files) => loadGallery(files));

    $("#galleryList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-photo]");
      if (!button) return;
      state.media.gallery = state.media.gallery.filter((photo) => photo.id !== button.dataset.removePhoto);
      renderUploads();
      renderProgress();
      persistDraft();
    });

    $("#generateBlessing").addEventListener("click", generateBlessings);
    $("#blessingCandidates").addEventListener("click", (event) => {
      const button = event.target.closest("[data-use-blessing]");
      if (!button) return;
      state.content.headline = button.dataset.useBlessing;
      syncFormFromState();
      renderProgress();
      persistDraft();
      showToast("已填入首页主祝福");
    });

    $("#moduleGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-module-toggle]");
      if (!button) return;
      toggleModule(button.dataset.moduleToggle);
    });

    $("#moduleFields").addEventListener("input", handleModuleFieldChange);
    $("#moduleFields").addEventListener("change", handleModuleFieldChange);
    $("#moduleFields").addEventListener("click", handleModuleAction);

    $("#submitOrder").addEventListener("click", submitOrder);
    $("#copyJson").addEventListener("click", copyJson);

    $$(".view-button").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    $("#unlockAdmin").addEventListener("click", unlockAdmin);
    $("#adminSearch").addEventListener("input", renderAdminOrders);
    $("#adminStatusFilter").addEventListener("change", renderAdminOrders);
    $("#adminPlanFilter").addEventListener("change", renderAdminOrders);
    $("#adminTemplateFilter").addEventListener("change", renderAdminOrders);
    $("#exportAllOrders").addEventListener("click", exportAllOrders);
    $("#adminOrderList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-order]");
      if (button) renderOrderDetail(button.dataset.openOrder);
    });
    $("#adminOrderDetail").addEventListener("click", (event) => {
      const button = event.target.closest("[data-status]");
      if (!button) return;
      updateOrderStatus(button.dataset.orderId, button.dataset.status);
    });

    $("#closeTemplatePreview").addEventListener("click", () => $("#templatePreviewDialog").close());
  }

  function normalizeState() {
    if (!plans.some((plan) => plan.id === state.planId)) state.planId = plans[0] ? plans[0].id : "P01";
    if (!templates.some((template) => template.id === state.templateId)) state.templateId = templates[0] ? templates[0].id : "T01";
    if (!state.selectedOptionalModules.length) state.selectedOptionalModules = defaultOptionalModules();
    Object.keys(defaults).forEach((key) => {
      if (state.modules[key] === undefined) state.modules[key] = clone(defaults[key]);
    });
  }

  function currentPlan() {
    if (!plans.length) {
      throw new Error(
        "套餐配置未加载，请检查 config/plans.js 是否存在并正确设置 window.BD_PLANS"
      );
    }
    return plans.find((plan) => plan.id === state.planId) || plans[0];
  }

  function currentTemplate() {
    if (!templates.length) {
      throw new Error(
        "模板配置未加载，请检查 config/templates.js 是否存在并正确设置 window.BD_TEMPLATES"
      );
    }
    return templates.find((template) => template.id === state.templateId) || templates[0];
  }

  function defaultOptionalModules() {
    const plan = currentPlan();
    return (plan.optionalModulePool || []).slice(0, plan.optionalPickCount || 0);
  }

  function activeModuleIds() {
    const plan = currentPlan();
    return unique([...(plan.includedModules || []), ...state.selectedOptionalModules]);
  }

  function renderPlans() {
    $("#planGrid").innerHTML = plans.map((plan) => {
      const active = plan.id === state.planId ? "selected" : "";
      const optionalText = plan.optionalPickCount
        ? `可选 ${plan.optionalModulePool.length} 选 ${plan.optionalPickCount}`
        : "套餐模块固定";
      return `
        <button class="plan-card ${active}" type="button" data-plan-id="${plan.id}">
          <span>${escapeHTML(plan.id)}</span>
          <strong>${escapeHTML(plan.name)}</strong>
          <b>￥${plan.priceCny}</b>
          <small>${escapeHTML(optionalText)} · 相册 ${plan.galleryLimit} 张</small>
          <em>${escapeHTML(plan.summary)}</em>
        </button>
      `;
    }).join("");
  }

  function renderTemplates() {
    $("#templateGrid").innerHTML = templates.map((template) => {
      const active = template.id === state.templateId ? "selected" : "";
      const tags = template.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("");
      return `
        <article class="template-card ${active}">
          <button class="template-select" type="button" data-template-id="${template.id}" aria-label="选择 ${escapeHTML(template.name)}">
            <img src="${template.previewImage}" alt="${escapeHTML(template.name)} 模板预览">
            <span class="template-badge">${escapeHTML(template.id)}</span>
          </button>
          <div class="template-info">
            <div>
              <h3>${escapeHTML(template.name)}</h3>
              <p>${escapeHTML(template.description)}</p>
            </div>
            <button class="text-button" type="button" data-preview-template="${template.id}">查看大图</button>
          </div>
          <div class="tag-row">${tags}</div>
        </article>
      `;
    }).join("");
  }

  function syncFormFromState() {
    const values = {
      ...state.order,
      ...state.recipient,
      ...state.sender,
      ...state.content,
      ...state.music,
      ...state.privacy
    };
    Object.entries(values).forEach(([name, value]) => {
      const field = $(`[name="${name}"]`);
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value || "";
    });
    renderConditionals();
    renderToneAdvice();
  }

  function handleFormChange(event) {
    const input = event.target;
    if (!input.name) return;
    const value = input.type === "checkbox" ? input.checked : input.value;
    const group = getGroupForField(input.name);
    if (!group) return;
    state[group][input.name] = value;
    if (input.name === "birthday") renderProgress();
    if (input.name === "relationshipType") renderToneAdvice();
    if (input.name === "senderName" && !state.content.signature) {
      state.content.signature = value;
      syncFormFromState();
    }
    renderConditionals();
    renderProgress();
    persistDraft();
  }

  function getGroupForField(name) {
    if (name in state.order) return "order";
    if (name in state.recipient) return "recipient";
    if (name in state.sender) return "sender";
    if (name in state.content) return "content";
    if (name in state.music) return "music";
    if (name in state.privacy) return "privacy";
    return "";
  }

  function renderConditionals() {
    $$(".conditional").forEach((node) => {
      const [fieldName, expected] = node.dataset.showWhen.split(":");
      const field = $(`[name="${fieldName}"]`);
      node.classList.toggle("hidden", !field || field.value !== expected);
    });
  }

  function renderToneAdvice() {
    const relation = state.recipient.relationshipType;
    const map = {
      lover: "建议语气：甜一点、具体一点，可以多写共同经历和偏爱感。",
      best_friend: "建议语气：像日常聊天，适合写陪伴、互怼、共同回忆。",
      friend: "建议语气：轻松真诚，突出祝福和对 TA 的欣赏。",
      classmate: "建议语气：青春、校园、共同成长，适合大学生生日场景。",
      family: "建议语气：温暖稳定，少一点夸张，多一点真心。",
      other: "建议语气：先写清关系，再补充让 TA 一看就懂的细节。"
    };
    $("#toneAdvice").textContent = map[relation] || map.friend;
  }

  function setStep(nextStep) {
    state.currentStep = Math.min(8, Math.max(1, nextStep));
    $$(".step-card").forEach((card) => {
      card.classList.toggle("active", Number(card.dataset.step) === state.currentStep);
    });
    $("#prevStep").disabled = state.currentStep === 1;
    $("#nextStep").textContent = state.currentStep === 8 ? "生成订单 JSON" : "继续";
    if (state.currentStep === 6) renderModules();
    if (state.currentStep === 8) renderReview();
    renderProgress();
    persistDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderProgress() {
    const checks = getRequiredChecks();
    const done = checks.filter((item) => item.done).length;
    const percent = checks.length ? Math.round((done / checks.length) * 100) : 0;
    $("#completionPercent").textContent = `${percent}%`;
    $("#completionBar").style.width = `${percent}%`;
    $("#stepPills").innerHTML = Array.from({ length: 8 }, (_, index) => {
      const step = index + 1;
      return `<button type="button" class="${step === state.currentStep ? "active" : ""}" data-step-jump="${step}">${step}</button>`;
    }).join("");
    $$("#stepPills [data-step-jump]").forEach((button) => {
      button.addEventListener("click", () => setStep(Number(button.dataset.stepJump)));
    });
  }

  function getRequiredChecks() {
    const modules = activeModuleIds();
    const hasBirthday = Boolean(state.recipient.birthday);
    return [
      { label: "联系方式", done: Boolean(state.order.contactValue.trim()) },
      { label: "套餐", done: Boolean(state.planId) },
      { label: "模板", done: Boolean(state.templateId) },
      { label: "寿星姓名", done: Boolean(state.recipient.recipientName.trim()) },
      { label: "生日日期", done: hasBirthday },
      { label: "送礼人", done: state.sender.senderAnonymous || Boolean(state.sender.senderName.trim()) },
      { label: "封面图", done: Boolean(state.media.cover) },
      { label: "相册", done: state.media.gallery.length > 0 },
      { label: "主祝福", done: Boolean(state.content.headline.trim()) },
      { label: "音乐", done: hasMusicInfo() },
      { label: "隐私确认", done: Boolean(state.privacy.privacyConfirmed) },
      { label: "留言墙", done: !modules.includes("messageWall") || hasAnyText(state.modules.messageWall, "text") },
      { label: "盲盒", done: !modules.includes("surpriseBox") || hasAnyText(state.modules.surpriseBox, "content") },
      { label: "歌单", done: !modules.includes("playlist") || hasAnyText(state.modules.playlist, "song") },
      { label: "清单", done: !modules.includes("partyChecklist") || state.modules.partyChecklist.some(Boolean) },
      { label: "彩蛋", done: !modules.includes("hiddenEgg") || Boolean(state.modules.hiddenEgg.content.trim()) }
    ];
  }

  function hasMusicInfo() {
    if (state.music.bgmMode === "library") return Boolean(state.music.musicId);
    if (state.music.bgmMode === "manual") return Boolean(state.music.songName.trim());
    return Boolean(state.music.uploadedAudioName.trim());
  }

  function hasAnyText(list, key) {
    return Array.isArray(list) && list.some((item) => String(item[key] || "").trim());
  }

  async function loadCover(file) {
    if (!file) return;
    try {
      state.media.cover = await imageToData(file, 1200);
      renderUploads();
      renderProgress();
      persistDraft();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function loadGallery(files) {
    const plan = currentPlan();
    const slots = Math.max(0, plan.galleryLimit - state.media.gallery.length);
    const selected = Array.from(files || []).slice(0, slots);
    if (!selected.length) {
      showToast(`当前套餐最多上传 ${plan.galleryLimit} 张相册照片`);
      return;
    }
    for (const file of selected) {
      try {
        state.media.gallery.push(await imageToData(file, 900));
      } catch (error) {
        showToast(error.message);
      }
    }
    renderUploads();
    renderProgress();
    persistDraft();
  }

  function setupDropZone(zone, callback) {
    ["dragenter", "dragover"].forEach((name) => {
      zone.addEventListener(name, (event) => {
        event.preventDefault();
        zone.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach((name) => {
      zone.addEventListener(name, (event) => {
        event.preventDefault();
        zone.classList.remove("dragging");
      });
    });
    zone.addEventListener("drop", (event) => callback(event.dataTransfer.files));
  }

  function imageToData(file, maxSize) {
    return new Promise((resolve, reject) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        reject(new Error("仅支持 JPG、PNG、WEBP 图片"));
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        reject(new Error(`${file.name} 超过 15MB`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({
            id: `photo_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type: file.type,
            size: file.size,
            width: canvas.width,
            height: canvas.height,
            dataUrl: canvas.toDataURL("image/jpeg", 0.82)
          });
        };
        img.onerror = () => reject(new Error(`${file.name} 读取失败`));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error(`${file.name} 读取失败`));
      reader.readAsDataURL(file);
    });
  }

  function renderUploads() {
    const plan = currentPlan();
    $("#galleryLimitText").textContent = `已上传 ${state.media.gallery.length} / ${plan.galleryLimit}`;
    $("#coverPreview").innerHTML = state.media.cover
      ? `<img src="${state.media.cover.dataUrl}" alt="封面图预览"><p>${escapeHTML(state.media.cover.name)}</p>`
      : `<span>还没有封面图</span>`;
    $("#galleryList").innerHTML = state.media.gallery.map((photo) => `
      <figure>
        <img src="${photo.dataUrl}" alt="${escapeHTML(photo.name)}">
        <figcaption>${escapeHTML(photo.name)}</figcaption>
        <button type="button" data-remove-photo="${photo.id}" aria-label="删除图片">×</button>
      </figure>
    `).join("");
  }

  function trimGalleryToPlan() {
    const limit = currentPlan().galleryLimit;
    if (state.media.gallery.length > limit) {
      state.media.gallery = state.media.gallery.slice(0, limit);
      showToast(`已按新套餐保留前 ${limit} 张相册照片`);
    }
  }

  function renderModules() {
    normalizeState();
    const plan = currentPlan();
    const activeIds = activeModuleIds();
    const optionalPool = plan.optionalModulePool || [];
    $("#moduleRuleText").textContent = optionalPool.length
      ? `${plan.name}：从 ${optionalPool.length} 个加购模块中选择 ${plan.optionalPickCount} 个。`
      : `${plan.name}：模块已由套餐固定。`;

    const allIds = unique([...(plan.includedModules || []), ...optionalPool]);
    $("#moduleGrid").innerHTML = allIds.map((id) => {
      const module = moduleCatalog[id];
      if (!module) return "";
      const included = (plan.includedModules || []).includes(id);
      const selected = activeIds.includes(id);
      return `
        <button class="module-card ${selected ? "selected" : ""}" type="button" data-module-toggle="${id}" ${included ? "aria-disabled=\"true\"" : ""}>
          <strong>${escapeHTML(module.name)}</strong>
          <span>${escapeHTML(module.short)}</span>
          <em>${included ? "套餐包含" : selected ? "已选择" : "可选"}</em>
        </button>
      `;
    }).join("");

    const editableIds = activeIds.filter((id) => !["gallery", "bgm", "countdown"].includes(id));
    $("#moduleFields").innerHTML = editableIds.map(renderModuleFields).join("");
  }

  function toggleModule(id) {
    const plan = currentPlan();
    if ((plan.includedModules || []).includes(id)) {
      showToast("这个模块已包含在当前套餐中");
      return;
    }
    if (!(plan.optionalModulePool || []).includes(id)) return;
    const has = state.selectedOptionalModules.includes(id);
    if (has) {
      state.selectedOptionalModules = state.selectedOptionalModules.filter((item) => item !== id);
    } else if (state.selectedOptionalModules.length < plan.optionalPickCount) {
      state.selectedOptionalModules.push(id);
    } else {
      showToast(`当前套餐只能选择 ${plan.optionalPickCount} 个加购模块`);
    }
    renderModules();
    renderProgress();
    persistDraft();
  }

  function renderModuleFields(id) {
    const module = moduleCatalog[id];
    if (!module) return "";
    return `<section class="module-field-card" data-module="${id}">
      <div class="module-field-head">
        <div><p class="eyebrow">Add-on</p><h3>${escapeHTML(module.name)}</h3></div>
        <small>${escapeHTML(module.short)}</small>
      </div>
      ${renderModuleBody(id)}
    </section>`;
  }

  function renderModuleBody(id) {
    const data = state.modules[id];
    if (id === "messageWall") {
      return renderObjectList(id, data, [
        ["author", "留言人", "例如 阿晴"],
        ["text", "留言内容", "写一句祝福或回忆"]
      ]);
    }
    if (id === "surpriseBox") {
      return renderObjectList(id, data, [
        ["title", "盲盒标题", "例如 来自室友的悄悄话"],
        ["content", "盲盒内容", "打开后看到的惊喜"],
        ["openAt", "开启时间", "birthday"]
      ]);
    }
    if (id === "playlist") {
      return renderObjectList(id, data, [
        ["song", "歌曲名", "例如 小幸运"],
        ["artist", "歌手", "可选"],
        ["reason", "推荐理由", "为什么送这首歌"]
      ]);
    }
    if (id === "birthdayMap") {
      return renderObjectList(id, data, [
        ["place", "地点", "例如 学校操场"],
        ["story", "回忆", "这里发生过什么"],
        ["link", "地图链接", "可选"]
      ]);
    }
    if (id === "giftVote") {
      return renderObjectList(id, data, [
        ["name", "礼物选项", "例如 拍立得"],
        ["reason", "选择理由", "为什么适合 TA"]
      ]);
    }
    if (id === "partyChecklist") {
      return renderStringList(id, data, "派对任务");
    }
    if (id === "wishBottle") {
      return `
        ${inputFor(id, "title", "标题", data.title)}
        ${textareaFor(id, "prompt", "引导语", data.prompt)}
        ${inputFor(id, "wishCount", "愿望数量", data.wishCount, "number")}
        ${checkboxFor(id, "isPublic", "允许公开展示愿望", data.isPublic)}
      `;
    }
    if (id === "hiddenEgg") {
      return `
        ${selectFor(id, "trigger", "触发方式", data.trigger, [["longPress", "长按页面"], ["clickAvatar", "点击头像"], ["secretCode", "输入暗号"]])}
        ${inputFor(id, "title", "彩蛋标题", data.title)}
        ${textareaFor(id, "content", "彩蛋内容", data.content)}
      `;
    }
    if (id === "futureMailbox") {
      return `
        ${inputFor(id, "openDate", "开启日期", data.openDate, "date")}
        ${textareaFor(id, "content", "未来信正文", data.content)}
      `;
    }
    if (id === "dailyLuck") {
      return `
        ${checkboxFor(id, "enabled", "开启今日好运占位", data.enabled)}
        ${inputFor(id, "zodiac", "星座 / 生肖备注", data.zodiac)}
        ${textareaFor(id, "note", "展示文案", data.note)}
      `;
    }
    if (id === "multiContributor") {
      return `
        ${checkboxFor(id, "enabled", "允许好友共创留言", data.enabled)}
        ${selectFor(id, "moderation", "审核方式", data.moderation, [["manual", "商家手动审核"], ["auto", "自动进入待审核"]])}
        ${inputFor(id, "link", "征集链接说明", data.link)}
      `;
    }
    return "";
  }

  function renderObjectList(moduleId, list, fields) {
    return `<div class="repeat-list">${list.map((item, index) => `
      <div class="repeat-item">
        ${fields.map(([key, label, placeholder]) => textareaFor(moduleId, key, label, item[key], index, placeholder)).join("")}
        <button type="button" class="text-button danger" data-module-remove="${moduleId}" data-index="${index}">删除这一条</button>
      </div>
    `).join("")}</div>
    <button type="button" class="secondary-button" data-module-add="${moduleId}">添加一条</button>`;
  }

  function renderStringList(moduleId, list, label) {
    return `<div class="repeat-list">${list.map((value, index) => `
      <div class="repeat-item">
        ${inputFor(moduleId, "value", `${label} ${index + 1}`, value, "text", index)}
        <button type="button" class="text-button danger" data-module-remove="${moduleId}" data-index="${index}">删除这一条</button>
      </div>
    `).join("")}</div>
    <button type="button" class="secondary-button" data-module-add="${moduleId}">添加任务</button>`;
  }

  function inputFor(moduleId, key, label, value, type = "text", index = "") {
    return `<label class="field">${escapeHTML(label)}
      <input type="${type}" data-module-field="${moduleId}" data-key="${key}" data-index="${index}" value="${escapeAttr(value)}">
    </label>`;
  }

  function textareaFor(moduleId, key, label, value, index = "", placeholder = "") {
    return `<label class="field">${escapeHTML(label)}
      <textarea data-module-field="${moduleId}" data-key="${key}" data-index="${index}" placeholder="${escapeAttr(placeholder)}">${escapeHTML(value || "")}</textarea>
    </label>`;
  }

  function checkboxFor(moduleId, key, label, value) {
    return `<label class="switch-row"><input type="checkbox" data-module-field="${moduleId}" data-key="${key}" ${value ? "checked" : ""}> ${escapeHTML(label)}</label>`;
  }

  function selectFor(moduleId, key, label, value, options) {
    return `<label class="field">${escapeHTML(label)}
      <select data-module-field="${moduleId}" data-key="${key}">
        ${options.map(([val, text]) => `<option value="${escapeAttr(val)}" ${value === val ? "selected" : ""}>${escapeHTML(text)}</option>`).join("")}
      </select>
    </label>`;
  }

  function handleModuleFieldChange(event) {
    const field = event.target.closest("[data-module-field]");
    if (!field) return;
    const moduleId = field.dataset.moduleField;
    const key = field.dataset.key;
    const index = field.dataset.index;
    const value = field.type === "checkbox" ? field.checked : field.value;
    if (index !== "") {
      if (moduleId === "partyChecklist") state.modules[moduleId][Number(index)] = value;
      else state.modules[moduleId][Number(index)][key] = value;
    } else {
      state.modules[moduleId][key] = key === "wishCount" ? Number(value) : value;
    }
    renderProgress();
    persistDraft();
  }

  function handleModuleAction(event) {
    const addButton = event.target.closest("[data-module-add]");
    const removeButton = event.target.closest("[data-module-remove]");
    if (addButton) {
      const id = addButton.dataset.moduleAdd;
      addModuleItem(id);
      renderModules();
      persistDraft();
    }
    if (removeButton) {
      const id = removeButton.dataset.moduleRemove;
      const index = Number(removeButton.dataset.index);
      if (Array.isArray(state.modules[id]) && state.modules[id].length > 1) {
        state.modules[id].splice(index, 1);
        renderModules();
        renderProgress();
        persistDraft();
      } else {
        showToast("至少保留一条内容");
      }
    }
  }

  function addModuleItem(id) {
    if (id === "messageWall") state.modules[id].push({ author: "", text: "" });
    if (id === "surpriseBox") state.modules[id].push({ title: "", content: "", openAt: "birthday" });
    if (id === "playlist") state.modules[id].push({ song: "", artist: "", reason: "" });
    if (id === "birthdayMap") state.modules[id].push({ place: "", story: "", link: "" });
    if (id === "giftVote" && state.modules[id].length < 6) state.modules[id].push({ name: "", reason: "" });
    if (id === "partyChecklist" && state.modules[id].length < 10) state.modules[id].push("");
  }

  function generateBlessings() {
    const name = state.recipient.recipientName || "TA";
    const facts = state.content.aiFacts || "你值得所有明亮又温柔的瞬间";
    const tones = {
      warm: ["把今天所有偏爱和祝福都送给你", "愿这一岁的你，被温柔和好运稳稳接住", `生日快乐，${name}，你一直值得被认真偏爱`],
      bright: [`今天的主角就是 ${name}`, "这一页的快乐、惊喜和爱都为你闪亮", "生日快乐，愿你每天都比今天更开心"],
      cool: ["把全世界的浪漫和闪耀都画给你", "今天不讲道理，所有偏爱都属于你", `生日快乐，${name}，继续漂亮地发光吧`],
      restrained: ["愿你拥有平静而明亮的新一岁", "把认真准备的祝福，送给特别的你", `生日快乐，${name}，愿你所行皆顺`],
      romantic: ["你是我心里最特别的星", "把漫天星河和偏爱都送给你", `生日快乐，${name}，爱意在今天有了名字`],
      sincere: [`生日快乐，${name}，谢谢你出现在我的生命里`, "愿你的新一岁，有热爱、有底气、有自由", "这份祝福不夸张，只是真的希望你快乐"]
    };
    const chosen = tones[state.content.aiTone] || tones.warm;
    $("#blessingCandidates").innerHTML = chosen.map((text, index) => `
      <article>
        <span>候选 ${index + 1}</span>
        <p>${escapeHTML(text)}。${escapeHTML(facts).slice(0, 36)}</p>
        <button type="button" class="secondary-button" data-use-blessing="${escapeAttr(text)}">使用这句</button>
      </article>
    `).join("");
  }

  function renderReview() {
    const plan = currentPlan();
    const template = currentTemplate();
    const countdown = getBirthdayCountdown(state.recipient.birthday);
    $("#reviewSummary").innerHTML = [
      ["套餐", `${plan.name} / ￥${plan.priceCny}`],
      ["模板", `${template.id} ${template.name}`],
      ["寿星", state.recipient.recipientName || "未填写"],
      ["生日", state.recipient.birthday || "未填写"],
      ["倒计时", countdown ? `${countdown.targetYear} 年生日还有 ${countdown.days} 天` : "未填写生日"],
      ["封面图", state.media.cover ? state.media.cover.name : "未上传"],
      ["相册", `${state.media.gallery.length} / ${plan.galleryLimit}`],
      ["已开模块", activeModuleIds().map((id) => moduleCatalog[id] ? moduleCatalog[id].name : id).join("、")]
    ].map(([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join("");

    const notices = validateOrder(false);
    $("#reviewNotices").innerHTML = notices.length
      ? notices.map((notice) => `<p class="notice">${escapeHTML(notice)}</p>`).join("")
      : `<p class="notice ok">资料看起来完整，可以生成订单 JSON。</p>`;
  }

  function validateOrder(strict = true) {
    const notices = [];
    const plan = currentPlan();
    if (!state.order.contactValue.trim()) notices.push("请填写联系方式。");
    if (!state.recipient.recipientName.trim()) notices.push("请填写寿星姓名 / 昵称。");
    if (!state.recipient.birthday) notices.push("请填写生日日期。");
    if (!state.sender.senderAnonymous && !state.sender.senderName.trim()) notices.push("请填写送礼人昵称，或勾选匿名。");
    if (!state.media.cover) notices.push("请上传封面图。");
    if (!state.media.gallery.length) notices.push("请至少上传 1 张回忆照片。");
    if (state.media.gallery.length > plan.galleryLimit) notices.push(`当前套餐最多 ${plan.galleryLimit} 张照片。`);
    if (!state.content.headline.trim()) notices.push("请填写首页主祝福。");
    if (!hasMusicInfo()) notices.push("请补充背景音乐信息。");
    if (!state.privacy.privacyConfirmed) notices.push("请确认隐私说明。");
    if ((plan.optionalModulePool || []).length && state.selectedOptionalModules.length !== plan.optionalPickCount) {
      notices.push(`${plan.name} 需要选择 ${plan.optionalPickCount} 个加购模块。`);
    }
    const modules = activeModuleIds();
    if (modules.includes("messageWall") && !hasAnyText(state.modules.messageWall, "text")) notices.push("留言墙至少需要 1 条留言内容。");
    if (modules.includes("surpriseBox") && !hasAnyText(state.modules.surpriseBox, "content")) notices.push("好友盲盒至少需要 1 条惊喜内容。");
    if (modules.includes("playlist") && !hasAnyText(state.modules.playlist, "song")) notices.push("生日歌单至少需要 1 首歌曲。");
    if (modules.includes("hiddenEgg") && !state.modules.hiddenEgg.content.trim()) notices.push("隐藏彩蛋需要填写彩蛋内容。");
    if (strict && notices.length) showToast(notices[0]);
    return notices;
  }

  function submitOrder() {
    renderReview();
    const notices = validateOrder(true);
    if (notices.length) return;
    const order = buildOrderJson();
    saveOrder(order);
    $("#jsonOutput").hidden = false;
    $("#jsonPreview").textContent = JSON.stringify(order, null, 2);
    renderAdminOrders();
    showToast("订单 JSON 已生成，本地后台也已保存");
  }

  function buildOrderJson() {
    const now = new Date().toISOString();
    return {
      orderId: `BD-${Date.now()}`,
      status: "submitted",
      source: "local-mock",
      createdAt: now,
      updatedAt: now,
      plan: currentPlan(),
      template: currentTemplate(),
      order: clone(state.order),
      recipient: {
        ...clone(state.recipient),
        birthdayCountdown: getBirthdayCountdown(state.recipient.birthday)
      },
      sender: clone(state.sender),
      content: clone(state.content),
      media: clone(state.media),
      music: clone(state.music),
      selectedModules: activeModuleIds(),
      moduleData: clone(state.modules),
      privacy: clone(state.privacy)
    };
  }

  function getBirthdayCountdown(dateText) {
    if (!dateText) return null;
    const now = new Date();
    const birthday = new Date(dateText + "T00:00:00");
    let target = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (target < today) target = new Date(now.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
    const days = Math.ceil((target - today) / 86400000);
    return {
      targetDate: target.toISOString().slice(0, 10),
      targetYear: target.getFullYear(),
      days
    };
  }

  function saveOrder(order) {
    const orders = readOrders();
    orders.unshift(order);
    localStorage.setItem(ordersKey, JSON.stringify(orders));
  }

  function readOrders() {
    try {
      return JSON.parse(localStorage.getItem(ordersKey) || "[]");
    } catch (error) {
      return [];
    }
  }

  function switchView(view) {
    $$(".view-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $("#intakeView").classList.toggle("hidden", view !== "intake");
    $("#intakeProgress").classList.toggle("hidden", view !== "intake");
    $("#adminView").classList.toggle("hidden", view !== "admin");
    if (view === "admin") renderAdminOrders();
  }

  function unlockAdmin() {
    if ($("#adminPassword").value !== adminPassword) {
      showToast("演示密码是 demo-admin");
      return;
    }
    $("#adminGate").classList.add("hidden");
    $("#adminPanel").classList.remove("hidden");
    renderAdminOrders();
  }

  function renderAdminFilters() {
    $("#adminPlanFilter").innerHTML = `<option value="">全部套餐</option>` + plans.map((plan) => `<option value="${plan.id}">${plan.name}</option>`).join("");
    $("#adminTemplateFilter").innerHTML = `<option value="">全部模板</option>` + templates.map((template) => `<option value="${template.id}">${template.id} ${template.name}</option>`).join("");
  }

  function renderAdminOrders() {
    const adminSearch = $("#adminSearch");
    const adminStatusFilter = $("#adminStatusFilter");
    const adminPlanFilter = $("#adminPlanFilter");
    const adminTemplateFilter = $("#adminTemplateFilter");
    const query = (adminSearch ? adminSearch.value : "").trim().toLowerCase();
    const status = adminStatusFilter ? adminStatusFilter.value : "";
    const plan = adminPlanFilter ? adminPlanFilter.value : "";
    const template = adminTemplateFilter ? adminTemplateFilter.value : "";
    const orders = readOrders().filter((order) => {
      const text = `${order.orderId} ${order.recipient.recipientName} ${order.order.contactValue}`.toLowerCase();
      return (!query || text.includes(query))
        && (!status || order.status === status)
        && (!plan || order.plan.id === plan)
        && (!template || order.template.id === template);
    });
    $("#adminOrderList").innerHTML = orders.length ? orders.map((order) => `
      <button type="button" class="order-row" data-open-order="${order.orderId}">
        <span>${escapeHTML(order.orderId)}</span>
        <strong>${escapeHTML(order.recipient.recipientName || "未命名")}</strong>
        <em>${escapeHTML(order.plan.name)} · ${escapeHTML(order.template.id)}</em>
        <small>${escapeHTML(order.status)}</small>
      </button>
    `).join("") : `<p class="empty">暂无本地订单。提交一次表单后会出现在这里。</p>`;
    if (orders[0]) renderOrderDetail(orders[0].orderId);
  }

  function renderOrderDetail(orderId) {
    const order = readOrders().find((item) => item.orderId === orderId);
    if (!order) {
      $("#adminOrderDetail").innerHTML = `<p class="empty">请选择一个订单。</p>`;
      return;
    }
    $("#adminOrderDetail").innerHTML = `
      <div class="detail-head">
        <div><p class="eyebrow">Order Detail</p><h3>${escapeHTML(order.orderId)}</h3></div>
        <span>${escapeHTML(order.status)}</span>
      </div>
      <div class="detail-grid">
        <p><b>寿星</b>${escapeHTML(order.recipient.recipientName)}</p>
        <p><b>联系方式</b>${escapeHTML(order.order.contactValue)}</p>
        <p><b>套餐</b>${escapeHTML(order.plan.name)}</p>
        <p><b>模板</b>${escapeHTML(order.template.name)}</p>
        <p><b>照片</b>封面 ${order.media.cover ? "1" : "0"} / 相册 ${order.media.gallery.length}</p>
        <p><b>模块</b>${escapeHTML(order.selectedModules.join(", "))}</p>
      </div>
      <div class="status-actions">
        <button type="button" class="secondary-button" data-order-id="${order.orderId}" data-status="needs_revision">标记需补充</button>
        <button type="button" class="secondary-button" data-order-id="${order.orderId}" data-status="approved">标记通过</button>
        <button type="button" class="secondary-button" data-order-id="${order.orderId}" data-status="submitted">恢复待处理</button>
      </div>
      <pre>${escapeHTML(JSON.stringify(order, null, 2))}</pre>
    `;
  }

  function updateOrderStatus(orderId, status) {
    const orders = readOrders();
    const order = orders.find((item) => item.orderId === orderId);
    if (!order) return;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    localStorage.setItem(ordersKey, JSON.stringify(orders));
    renderAdminOrders();
    renderOrderDetail(orderId);
    showToast("订单状态已更新");
  }

  function exportAllOrders() {
    const json = JSON.stringify(readOrders(), null, 2);
    downloadText(`birthday-orders-${Date.now()}.json`, json);
  }

  function copyJson() {
    const text = $("#jsonPreview").textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast("JSON 已复制"));
    } else {
      showToast("当前浏览器不支持一键复制，可长按选择 JSON");
    }
  }

  function openTemplatePreview(templateId) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    $("#templatePreviewImage").src = template.previewImage;
    $("#templatePreviewCaption").textContent = `${template.id} ${template.name} · ${template.description}`;
    const dialog = $("#templatePreviewDialog");
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "open");
  }

  function persistDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(state));
    } catch (error) {
      // Photos may exceed localStorage in real use; production should move them to object storage.
    }
  }

  function restoreDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved) Object.assign(state, saved);
    } catch (error) {
      localStorage.removeItem(draftKey);
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function unique(list) {
    return Array.from(new Set(list.filter(Boolean)));
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split("\"").join("&quot;")
      .split("'").join("&#039;");
  }

  function escapeAttr(value) {
    return escapeHTML(value).split("\n").join(" ");
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
