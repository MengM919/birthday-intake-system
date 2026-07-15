(function () {
  "use strict";

  const plans = window.BD_PLANS || [];
  const templates = window.BD_TEMPLATES || [];
  const moduleCatalog = window.BD_MODULES || {};
  const imageryCatalog = window.BD_IMAGERY || [];
  const draftKey = "bd_intake_draft_v1";
  const ordersKey = "bd_intake_orders_v1";
  const adminPassword = "demo-admin";
  const cloudState = {
    orderId: null,
    userId: null,
    isAdmin: false,
    isHydrating: false,
    adminOrders: []
  };
  const planCodeById = {
    P01: "basic_99",
    P02: "heart_169",
    P03: "surprise_249",
    P04: "all_love_399"
  };
  const planIdByCode = Object.fromEntries(Object.entries(planCodeById).map(([id, code]) => [code, id]));

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
    surpriseBox: [createSurpriseBoxConfig()],
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
      configureAdminGate();
      void initCloudOrder();
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
      if (cloudState.orderId) {
        showToast("该订单的套餐已由商家创建时确定。");
        return;
      }
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
      if (cloudState.orderId) {
        showToast("该订单的模板已由商家创建时确定。");
        return;
      }
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

    $("#galleryList").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-remove-photo]");
      if (!button) return;
      const photo = state.media.gallery.find((item) => item.id === button.dataset.removePhoto);
      state.media.gallery = state.media.gallery.filter((item) => item.id !== button.dataset.removePhoto);
      renderUploads();
      renderProgress();
      persistDraft();
      if (photo && photo.storageRecord && cloudState.orderId) {
        try {
          await window.BirthdayCloudOrders.deleteFile(photo.storageRecord);
        } catch (error) {
          showToast("照片已从页面移除，但云端删除失败：" + error.message);
        }
      }
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
    $("#adminCreateOrderForm").addEventListener("submit", createCloudOrder);
    $("#adminSearch").addEventListener("input", renderAdminOrders);
    $("#adminStatusFilter").addEventListener("change", renderAdminOrders);
    $("#adminPlanFilter").addEventListener("change", renderAdminOrders);
    $("#adminTemplateFilter").addEventListener("change", renderAdminOrders);
    $("#exportAllOrders").addEventListener("click", exportAllOrders);
    $("#adminOrderList").addEventListener("click", (event) => {
      const cloudButton = event.target.closest("[data-cloud-order]");
      if (cloudButton) {
        renderCloudOrderDetail(cloudButton.dataset.cloudOrder);
        return;
      }
      const button = event.target.closest("[data-open-order]");
      if (button) renderOrderDetail(button.dataset.openOrder);
    });
    $("#adminOrderDetail").addEventListener("click", (event) => {
      const publishButton = event.target.closest("[data-publish-order]");
      if (publishButton) {
        publishCloudOrder(publishButton.dataset.publishOrder);
        return;
      }
      const copyButton = event.target.closest("[data-copy-published]");
      if (copyButton) {
        copyPublishedUrl(copyButton.dataset.copyPublished);
        return;
      }
      const button = event.target.closest("[data-status]");
      if (button) updateOrderStatus(button.dataset.orderId, button.dataset.status);
    });

    $("#closeTemplatePreview").addEventListener("click", () => $("#templatePreviewDialog").close());
  }

  async function initCloudOrder() {
    const supabase = window.BirthdaySupabase;
    if (!supabase || !supabase.isEnabled || !supabase.isEnabled()) return;
    try {
      const session = await window.BirthdayAuth.ensureAnonymousSession();
      cloudState.userId = session.user ? session.user.id : null;
      const params = new URLSearchParams(window.location.search);
      const orderNumber = params.get("order");
      const token = params.get("token");
      if (!orderNumber || !token) return;

      const claimed = await window.BirthdayCloudOrders.claimOrder(orderNumber, token);
      cloudState.orderId = claimed.order.id;
      const record = await window.BirthdayCloudOrders.loadOrder(cloudState.orderId);
      hydrateCloudOrder(record);
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast("订单已安全领取，正在保存到你的专属草稿。");
    } catch (error) {
      console.error("Cloud order initialization failed:", error);
      showToast("无法领取该订单：" + error.message);
    }
  }

  function hydrateCloudOrder(record) {
    cloudState.isHydrating = true;
    const order = record.order || {};
    const content = record.content || {};
    const moduleRows = record.modules || [];
    const customData = content.custom_data || {};
    state.planId = planIdByCode[record.plan && record.plan.code] || state.planId;
    state.templateId = record.template && record.template.code ? record.template.code : state.templateId;
    state.order = {
      ...state.order,
      orderChannel: order.purchase_channel || state.order.orderChannel,
      orderNo: order.external_order_number || "",
      contactMethod: order.contact_method || state.order.contactMethod,
      contactValue: order.contact_value || ""
    };
    state.recipient = {
      ...state.recipient,
      recipientName: order.recipient_name || "",
      birthday: order.recipient_birthday || "",
      showAge: Boolean(order.show_age),
      relationshipType: order.relationship_type || state.recipient.relationshipType,
      relationshipOther: customData.relationshipOther || ""
    };
    state.sender = {
      ...state.sender,
      senderName: order.sender_name || "",
      senderAnonymous: Boolean(order.sender_anonymous)
    };
    state.content = {
      ...state.content,
      headline: content.headline || "",
      longMessage: content.long_message || "",
      signature: content.signature || "",
      aiFacts: customData.aiFacts || "",
      aiTone: customData.aiTone || state.content.aiTone
    };
    state.music = { ...state.music, ...(content.music || {}) };
    state.privacy = {
      ...state.privacy,
      allowShare: content.allow_share !== false,
      allowIndexing: Boolean(content.allow_indexing),
      pageVisibility: content.access_mode || "unlisted",
      privacyConfirmed: Boolean(order.privacy_consent_at)
    };

    const remoteModules = {};
    const selected = [];
    moduleRows.forEach((row) => {
      if (!row.enabled) return;
      selected.push(row.module_code);
      remoteModules[row.module_code] = row.configuration || {};
    });
    if (selected.length) state.selectedOptionalModules = selected.filter((code) => !(currentPlan().includedModules || []).includes(code));
    Object.entries(remoteModules).forEach(([code, configuration]) => {
      if (code === "surpriseBox") state.modules.surpriseBox = [normalizeSurpriseBoxItem(configuration)];
      else state.modules[code] = configuration;
    });

    const cover = (record.files || []).find((file) => file.file_type === "cover");
    const gallery = (record.files || []).filter((file) => file.file_type === "gallery");
    state.media.cover = cover ? cloudMediaFile(cover) : null;
    state.media.gallery = gallery.map(cloudMediaFile);
    normalizeState();
    syncFormFromState();
    renderPlans();
    renderTemplates();
    renderModules();
    renderUploads();
    renderProgress();
    cloudState.isHydrating = false;
  }

  function cloudMediaFile(file) {
    return {
      id: file.id,
      name: file.original_filename || "photo",
      type: file.mime_type || "",
      size: file.size_bytes || 0,
      width: file.width || 0,
      height: file.height || 0,
      dataUrl: file.previewUrl || "",
      storageRecord: file,
      storagePath: file.storage_path,
      uploaded: true
    };
  }

  function cloudSnapshot() {
    const modules = normalizedModuleData();
    modules.bgm = { music: clone(state.music) };
    modules.countdown = { birthday: state.recipient.birthday || null };
    return {
      order: clone(state.order),
      recipient: clone(state.recipient),
      sender: clone(state.sender),
      content: clone(state.content),
      music: clone(state.music),
      privacy: clone(state.privacy),
      selectedModules: activeModuleIds(),
      modules
    };
  }

  function scheduleCloudDraft() {
    if (cloudState.isHydrating || !cloudState.orderId || !window.BirthdayCloudOrders) return;
    window.BirthdayAutosave.schedule(async () => {
      await window.BirthdayCloudOrders.saveDraft(cloudState.orderId, cloudSnapshot());
      document.body.dataset.cloudSave = "saved";
    }, 1000);
  }
  function normalizeState() {
    if (!plans.some((plan) => plan.id === state.planId)) state.planId = plans[0] ? plans[0].id : "P01";
    if (!templates.some((template) => template.id === state.templateId)) state.templateId = templates[0] ? templates[0].id : "T01";
    if (!state.selectedOptionalModules.length) state.selectedOptionalModules = defaultOptionalModules();
    Object.keys(defaults).forEach((key) => {
      if (state.modules[key] === undefined) state.modules[key] = clone(defaults[key]);
    });
    normalizeSurpriseBoxState();
  }

  function allImagery() {
    if (Array.isArray(imageryCatalog) && imageryCatalog.length) return imageryCatalog;
    return [
      { id: "kitten", name: "小猫", short: "几只小猫偷偷来陪 TA 过生日。", preview: "assets/imagery/kitten/preview.webp", defaultDuration: 6, renderer: "kittenRenderer" },
      { id: "fireworks", name: "烟花", short: "让整个页面为 TA 盛大绽放。", preview: "assets/imagery/fireworks/preview.webp", defaultDuration: 6, renderer: "fireworksRenderer" },
      { id: "flowers", name: "鲜花", short: "让鲜花从页面四周慢慢把 TA 包围。", preview: "assets/imagery/flowers/preview.webp", defaultDuration: 7, renderer: "flowersRenderer" },
      { id: "stars", name: "星星", short: "今晚所有星光都落向 TA。", preview: "assets/imagery/stars/preview.webp", defaultDuration: 6, renderer: "starsRenderer" },
      { id: "butterflies", name: "蝴蝶", short: "几只蝴蝶轻轻飞过，像祝福抵达。", preview: "assets/imagery/butterflies/preview.webp", defaultDuration: 7, renderer: "butterfliesRenderer" },
      { id: "balloons", name: "生日气球", short: "高质感气球和丝带慢慢升起。", preview: "assets/imagery/balloons/preview.webp", defaultDuration: 6, renderer: "balloonsRenderer" },
      { id: "ocean", name: "海浪", short: "夏日海浪、光影和治愈气泡涌来。", preview: "assets/imagery/ocean/preview.webp", defaultDuration: 7, renderer: "oceanRenderer" },
      { id: "petals", name: "花瓣雨", short: "少量花瓣慢慢落下，温柔又纪念。", preview: "assets/imagery/petals/preview.webp", defaultDuration: 6, renderer: "petalsRenderer" }
    ];
  }

  function normalizeImageryCode(value) {
    const legacy = { cat: "kitten", gift: "balloons", star: "stars", motif: "kitten" };
    const code = legacy[value] || value || "kitten";
    return allImagery().some((item) => item.id === code) ? code : "kitten";
  }

  function imageryMeta(value) {
    const code = normalizeImageryCode(value);
    return allImagery().find((item) => item.id === code) || allImagery()[0];
  }

  function clampDuration(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 6;
    return Math.min(10, Math.max(4, Math.round(number)));
  }

  function createSurpriseBoxConfig(overrides = {}) {
    return normalizeSurpriseBoxItem(overrides);
  }

  function normalizeSurpriseBoxItem(item = {}) {
    const imagery = imageryMeta(item.imageryCode || item.motif);
    const revealModes = ["click", "birthday_day", "specific_time", "secret_code"];
    const secondary = item.secondaryImageryCode ? normalizeImageryCode(item.secondaryImageryCode) : null;
    return {
      moduleCode: "surpriseBox",
      displayName: "惊喜盲盒",
      imageryCode: imagery.id,
      secondaryImageryCode: secondary && secondary !== imagery.id ? secondary : null,
      surpriseTitle: item.surpriseTitle || item.title || "给你藏了一份小惊喜",
      surpriseMessage: item.surpriseMessage || item.content || "",
      signature: item.signature || "",
      revealMode: revealModes.includes(item.revealMode) ? item.revealMode : "click",
      durationSeconds: clampDuration(item.durationSeconds || imagery.defaultDuration || 6),
      soundEnabled: item.soundEnabled === true || item.soundEnabled === "true",
      customAttachmentFileId: item.customAttachmentFileId || null
    };
  }

  function normalizeSurpriseBoxState() {
    const current = state.modules.surpriseBox;
    if (!Array.isArray(current) || !current.length) {
      state.modules.surpriseBox = [createSurpriseBoxConfig()];
      return;
    }
    state.modules.surpriseBox = [normalizeSurpriseBoxItem(current[0])];
  }

  function primarySurpriseBox() {
    normalizeSurpriseBoxState();
    return state.modules.surpriseBox[0];
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
      { label: "惊喜盲盒", done: !modules.includes("surpriseBox") || Boolean(primarySurpriseBox().imageryCode && primarySurpriseBox().surpriseMessage.trim()) },
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
      const photo = await imageToData(file, 1200);
      state.media.cover = photo;
      renderUploads();
      renderProgress();
      if (cloudState.orderId) await uploadCloudMedia(photo, file, "cover", 0);
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
      showToast("当前套餐最多上传 " + plan.galleryLimit + " 张相册照片");
      return;
    }
    for (const file of selected) {
      try {
        const photo = await imageToData(file, 900);
        state.media.gallery.push(photo);
        renderUploads();
        renderProgress();
        if (cloudState.orderId) await uploadCloudMedia(photo, file, "gallery", state.media.gallery.length);
      } catch (error) {
        showToast(error.message);
      }
    }
    renderUploads();
    renderProgress();
    persistDraft();
  }

  async function uploadCloudMedia(photo, file, fileType, sortOrder) {
    photo.uploading = true;
    renderUploads();
    try {
      const record = await window.BirthdayCloudOrders.uploadFile(cloudState.orderId, fileType, file, {
        width: photo.width,
        height: photo.height,
        sortOrder
      });
      photo.id = record.id;
      photo.storageRecord = record;
      photo.storagePath = record.storage_path;
      photo.uploaded = true;
    } catch (error) {
      photo.uploadError = error.message;
      throw new Error(file.name + " 上传失败：" + error.message);
    } finally {
      photo.uploading = false;
      renderUploads();
    }
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
      return renderSurpriseBoxList(id, data);
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

  function renderImageryCards(moduleId, index, selectedCode) {
    return `<div class="imagery-grid" role="radiogroup" aria-label="选择打开盲盒时出现的惊喜">${allImagery().map((image) => {
      const selected = image.id === selectedCode;
      return `
        <button class="imagery-card ${selected ? "selected" : ""}" type="button" data-surprise-imagery="${escapeAttr(image.id)}" data-index="${index}" aria-pressed="${selected}">
          <img src="${escapeAttr(image.preview)}" alt="${escapeAttr(image.name)}预览" loading="lazy">
          <strong>${escapeHTML(image.name)}</strong>
          <p>${escapeHTML(image.short)}</p>
        </button>
      `;
    }).join("")}</div>`;
  }

  function renderSurpriseBoxList(moduleId, list) {
    const normalized = Array.isArray(list) && list.length ? [normalizeSurpriseBoxItem(list[0])] : [createSurpriseBoxConfig()];
    state.modules[moduleId] = normalized;
    return `<div class="repeat-list surprise-config-list">${normalized.map((item, index) => {
      const imagery = imageryMeta(item.imageryCode);
      const fallbackMessage = item.surpriseMessage || imagery.defaultMessage || "今天所有美好的意象，都想向 TA 靠近一点。";
      return `
        <div class="repeat-item surprise-item" data-surprise-config="${index}">
          <div class="surprise-intro">
            <h4>选择打开盲盒时出现的惊喜</h4>
            <p>TA 打开盲盒后，整个页面会短暂进入专属沉浸场景。</p>
          </div>
          ${renderImageryCards(moduleId, index, item.imageryCode)}
          ${inputFor(moduleId, "surpriseTitle", "惊喜标题", item.surpriseTitle, "text", index)}
          ${textareaFor(moduleId, "surpriseMessage", "专属惊喜祝福", item.surpriseMessage, index, fallbackMessage)}
          ${inputFor(moduleId, "signature", "署名（可选）", item.signature, "text", index)}
          <label class="switch-row"><input type="checkbox" data-module-field="${moduleId}" data-key="soundEnabled" data-index="${index}" ${item.soundEnabled ? "checked" : ""}> 打开时播放轻音效</label>
          <div class="surprise-meta-row">
            <span>打开方式：点击打开</span>
            <span>预计沉浸 ${item.durationSeconds} 秒</span>
          </div>
          <div class="imagery-selected-preview">
            <img src="${escapeAttr(imagery.preview)}" alt="${escapeAttr(imagery.name)}意象预览" loading="lazy">
            <div><strong>${escapeHTML(imagery.name)}沉浸式打开</strong><p>${escapeHTML(imagery.long || imagery.short)}</p></div>
          </div>
          <button type="button" class="secondary-button" data-surprise-preview="${index}">预览沉浸惊喜</button>
        </div>
      `;
    }).join("")}</div>`;
  }

  function openSurprisePreview(index) {
    const item = normalizeSurpriseBoxItem(state.modules.surpriseBox[index] || {});
    const imagery = imageryMeta(item.imageryCode);
    const config = {
      ...item,
      surpriseMessage: item.surpriseMessage || imagery.defaultMessage || "今天所有美好的意象，都想向 TA 靠近一点。"
    };
    if (typeof window.openSurpriseExperience !== "function") {
      showToast("沉浸式预览脚本未加载");
      return;
    }
    window.openSurpriseExperience(config, getThemeContext());
  }

  function getThemeContext() {
    const template = currentTemplate();
    const paletteMap = {
      T01: { primaryColor: "#2f80ed", accentColor: "#ff6f91", backgroundColor: "#fffaf2" },
      T02: { primaryColor: "#e3503e", accentColor: "#1f72b8", backgroundColor: "#fff2d8" },
      T03: { primaryColor: "#ee6954", accentColor: "#2177c7", backgroundColor: "#fff0dc" },
      T04: { primaryColor: "#1557c4", accentColor: "#ff6ba9", backgroundColor: "#082b78" },
      T05: { primaryColor: "#f55f93", accentColor: "#8a6cf2", backgroundColor: "#fff6f7" },
      T06: { primaryColor: "#e46b91", accentColor: "#f6b4c9", backgroundColor: "#120d11" },
      T07: { primaryColor: "#e77955", accentColor: "#2c8b8b", backgroundColor: "#fff1d8" },
      T08: { primaryColor: "#d87991", accentColor: "#b79adf", backgroundColor: "#ffe3ec" },
      T09: { primaryColor: "#2f72c4", accentColor: "#7bbbd7", backgroundColor: "#eef8ff" },
      T10: { primaryColor: "#ff4f94", accentColor: "#7d4df4", backgroundColor: "#fff1f7" },
      T11: { primaryColor: "#ff2f92", accentColor: "#246cff", backgroundColor: "#fbf1de" }
    };
    return { templateId: template.id, ...(paletteMap[template.id] || paletteMap.T01) };
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
    if (moduleId === "surpriseBox") {
      const itemIndex = Number(index || 0);
      state.modules[moduleId][itemIndex] = normalizeSurpriseBoxItem(state.modules[moduleId][itemIndex]);
    }
    renderProgress();
    persistDraft();
  }

  function handleModuleAction(event) {
    const imageryButton = event.target.closest("[data-surprise-imagery]");
    const previewButton = event.target.closest("[data-surprise-preview]");
    const addButton = event.target.closest("[data-module-add]");
    const removeButton = event.target.closest("[data-module-remove]");
    if (imageryButton) {
      const index = Number(imageryButton.dataset.index || 0);
      const current = normalizeSurpriseBoxItem(state.modules.surpriseBox[index] || {});
      const imagery = imageryMeta(imageryButton.dataset.surpriseImagery);
      state.modules.surpriseBox[index] = normalizeSurpriseBoxItem({ ...current, imageryCode: imagery.id, durationSeconds: imagery.defaultDuration });
      renderModules();
      renderProgress();
      persistDraft();
      return;
    }
    if (previewButton) {
      openSurprisePreview(Number(previewButton.dataset.surprisePreview || 0));
      return;
    }
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
    if (id === "surpriseBox") state.modules[id] = [createSurpriseBoxConfig()];
    if (id === "playlist") state.modules[id].push({ song: "", artist: "", reason: "" });
    if (id === "birthdayMap") state.modules[id].push({ place: "", story: "", link: "" });
    if (id === "giftVote" && state.modules[id].length < 6) state.modules[id].push({ name: "", reason: "" });
    if (id === "partyChecklist" && state.modules[id].length < 10) state.modules[id].push("");
  }

  function generateBlessings() {
    const name = state.recipient.recipientName || "TA";
    const facts = (state.content.aiFacts || "").trim();
    const factsField = $('[name="aiFacts"]');
    if (!facts) {
      showToast("先写一点 TA 的情况，再生成候选文案");
      if (factsField) factsField.focus();
      return;
    }
    const relationMap = {
      lover: "恋人",
      best_friend: "闺蜜",
      friend: "朋友",
      classmate: "同学",
      family: "家人",
      other: state.recipient.relationshipOther || "特别的人"
    };
    const toneMap = {
      warm: "温柔",
      bright: "活泼",
      cool: "甜酷",
      restrained: "克制高级",
      romantic: "浪漫",
      sincere: "真诚"
    };
    const relation = relationMap[state.recipient.relationshipType] || "朋友";
    const tone = toneMap[state.content.aiTone] || "温柔";
    const shortFacts = facts.length > 46 ? facts.slice(0, 46) + "…" : facts;
    const chosen = [
      `生日快乐，${name}。因为${shortFacts}，所以今天这份${tone}的偏爱只想送给你。`,
      `把今天所有祝福都送给${name}，愿你作为我很重要的${relation}，新一岁继续被爱、被好运接住。`,
      `这一天属于${name}，也属于那些关于“${shortFacts}”的美好回忆。愿你一直闪闪发光。`
    ];
    $("#blessingCandidates").innerHTML = chosen.map((text, index) => `
      <article>
        <span>候选 ${index + 1}</span>
        <p>${escapeHTML(text)}</p>
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
    if (modules.includes("surpriseBox")) {
      const surprise = primarySurpriseBox();
      if (!surprise.imageryCode) notices.push("请选择惊喜盲盒意象。");
      if (!surprise.surpriseMessage.trim()) notices.push("惊喜盲盒需要填写打开后看到的专属祝福。");
    }
    if (modules.includes("playlist") && !hasAnyText(state.modules.playlist, "song")) notices.push("生日歌单至少需要 1 首歌曲。");
    if (modules.includes("hiddenEgg") && !state.modules.hiddenEgg.content.trim()) notices.push("隐藏彩蛋需要填写彩蛋内容。");
    if (strict && notices.length) showToast(notices[0]);
    return notices;
  }

  async function submitOrder() {
    renderReview();
    const notices = validateOrder(true);
    if (notices.length) return;

    try {
      let order;
      if (cloudState.orderId) {
        await window.BirthdayCloudOrders.saveDraft(cloudState.orderId, cloudSnapshot());
        const result = await window.BirthdayCloudOrders.submitOrder(cloudState.orderId);
        order = buildOrderJson(cloudState.orderId, result.order.status, "supabase");
        showToast("订单已正式提交，商家后台现在可以审核。");
      } else {
        order = buildOrderJson();
        saveOrder(order);
        showToast("订单 JSON 已生成；当前仍是本地演示模式。");
      }
      $("#jsonOutput").hidden = false;
      $("#jsonPreview").textContent = JSON.stringify(order, null, 2);
      renderAdminOrders();
    } catch (error) {
      console.error("Order submission failed:", error);
      showToast("提交失败：" + error.message);
    }
  }

  function buildOrderJson(orderIdOverride, statusOverride, sourceOverride) {
    const now = new Date().toISOString();
    const orderId = orderIdOverride || ("BD-" + Date.now());
    const selectedModules = activeModuleIds();
    const moduleData = normalizedModuleData();
    return {
      orderId,
      status: statusOverride || "submitted",
      source: sourceOverride || "local-mock",
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
      selectedModules,
      moduleLabels: buildModuleLabels(selectedModules),
      moduleData,
      privacy: clone(state.privacy),
      birthdayPageConfig: buildBirthdayPageConfig(orderId, moduleData, selectedModules)
    };
  }

  function normalizedModuleData() {
    const data = clone(state.modules);
    data.surpriseBox = [primarySurpriseBox()];
    return data;
  }

  function buildModuleLabels(moduleIds) {
    return moduleIds.reduce((labels, id) => {
      labels[id] = moduleCatalog[id] ? moduleCatalog[id].name : id;
      return labels;
    }, {});
  }

  function buildBirthdayPageConfig(orderId, moduleData, selectedModules) {
    const surprise = moduleData.surpriseBox && moduleData.surpriseBox[0] ? moduleData.surpriseBox[0] : null;
    const modules = selectedModules.reduce((result, id) => {
      result[id] = { enabled: true };
      return result;
    }, {});
    if (surprise && selectedModules.includes("surpriseBox")) {
      modules.surpriseBox = {
        enabled: true,
        displayName: "惊喜盲盒",
        imageryCode: surprise.imageryCode,
        secondaryImageryCode: surprise.secondaryImageryCode,
        surpriseTitle: surprise.surpriseTitle,
        surpriseMessage: surprise.surpriseMessage,
        signature: surprise.signature,
        revealMode: surprise.revealMode,
        durationSeconds: surprise.durationSeconds,
        soundEnabled: surprise.soundEnabled,
        renderMode: "immersive"
      };
    }
    return {
      orderId,
      templateId: currentTemplate().id,
      recipient: {
        name: state.recipient.recipientName,
        birthday: state.recipient.birthday
      },
      sender: {
        name: state.sender.senderName,
        anonymous: state.sender.senderAnonymous
      },
      relationship: state.recipient.relationshipType,
      content: {
        headline: state.content.headline,
        message: state.content.longMessage || state.content.headline
      },
      photos: {
        cover: state.media.cover ? state.media.cover.name : null,
        gallery: state.media.gallery.map((photo) => photo.name)
      },
      modules,
      privacy: {
        allowShare: state.privacy.allowShare,
        allowIndexing: state.privacy.allowIndexing,
        pageVisibility: state.privacy.pageVisibility
      }
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

  function fileMetadata(file) {
    if (!file) return null;
    const { dataUrl, previewUrl, ...metadata } = file;
    return metadata;
  }

  function compactOrderForLocalStorage(order) {
    return {
      ...order,
      media: {
        cover: fileMetadata(order.media && order.media.cover),
        gallery: ((order.media && order.media.gallery) || []).map(fileMetadata)
      }
    };
  }

  function saveOrder(order) {
    const orders = readOrders().map(compactOrderForLocalStorage);
    orders.unshift(compactOrderForLocalStorage(order));
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

  function cloudEnabled() {
    return Boolean(window.BirthdaySupabase && window.BirthdaySupabase.isEnabled && window.BirthdaySupabase.isEnabled());
  }

  function configureAdminGate() {
    const usingCloud = cloudEnabled();
    $("#adminGateEyebrow").textContent = usingCloud ? "商家安全登录" : "Local Mock Admin";
    $("#adminGateCopy").textContent = usingCloud
      ? "使用 Supabase Auth 登录。只有已加入 admin_users 的商家账号可以查看全部订单。"
      : "当前是本地演示模式，可输入 demo-admin 查看本机订单。";
    $("#adminEmailField").classList.toggle("hidden", !usingCloud);
    $("#adminPassword").placeholder = usingCloud ? "输入商家密码" : "输入 demo-admin";
    $("#unlockAdmin").textContent = usingCloud ? "登录并进入后台" : "进入本地演示后台";
    $("#adminCreateOrderForm").classList.toggle("hidden", !usingCloud);
  }

  async function unlockAdmin() {
    if (!cloudEnabled()) {
      if ($("#adminPassword").value !== adminPassword) {
        showToast("演示密码是 demo-admin");
        return;
      }
      $("#adminGate").classList.add("hidden");
      $("#adminPanel").classList.remove("hidden");
      renderAdminOrders();
      return;
    }

    const email = $("#adminEmail").value.trim();
    const password = $("#adminPassword").value;
    if (!email || !password) {
      showToast("请填写商家邮箱和密码。");
      return;
    }
    try {
      await window.BirthdayAdmin.signIn(email, password);
      cloudState.isAdmin = true;
      cloudState.userId = (await window.BirthdaySupabase.getClient().auth.getUser()).data.user.id;
      $("#adminGate").classList.add("hidden");
      $("#adminPanel").classList.remove("hidden");
      $("#adminPanelTitle").textContent = "真实订单列表";
      await renderCloudAdminOrders();
      showToast("商家后台登录成功。");
    } catch (error) {
      console.error("Admin sign-in failed:", error);
      showToast("无法登录商家后台：" + error.message);
    }
  }

  function renderAdminFilters() {
    $("#adminPlanFilter").innerHTML = '<option value="">全部套餐</option>' + plans.map((plan) => '<option value="' + plan.id + '">' + escapeHTML(plan.name) + '</option>').join("");
    $("#adminTemplateFilter").innerHTML = '<option value="">全部模板</option>' + templates.map((template) => '<option value="' + template.id + '">' + template.id + " " + escapeHTML(template.name) + '</option>').join("");
    $("#adminCreatePlan").innerHTML = plans.map((plan) => '<option value="' + planCodeById[plan.id] + '">' + escapeHTML(plan.name) + " / " + plan.priceCny + "</option>").join("");
    $("#adminCreateTemplate").innerHTML = templates.map((template) => '<option value="' + template.id + '">' + template.id + " " + escapeHTML(template.name) + "</option>").join("");
  }

  function renderAdminOrders() {
    if (cloudState.isAdmin && cloudEnabled()) {
      void renderCloudAdminOrders();
      return;
    }
    const adminSearch = $("#adminSearch");
    const adminStatusFilter = $("#adminStatusFilter");
    const adminPlanFilter = $("#adminPlanFilter");
    const adminTemplateFilter = $("#adminTemplateFilter");
    const query = (adminSearch ? adminSearch.value : "").trim().toLowerCase();
    const status = adminStatusFilter ? adminStatusFilter.value : "";
    const plan = adminPlanFilter ? adminPlanFilter.value : "";
    const template = adminTemplateFilter ? adminTemplateFilter.value : "";
    const orders = readOrders().filter((order) => {
      const text = (order.orderId + " " + order.recipient.recipientName + " " + order.order.contactValue).toLowerCase();
      return (!query || text.includes(query))
        && (!status || order.status === status)
        && (!plan || order.plan.id === plan)
        && (!template || order.template.id === template);
    });
    $("#adminOrderList").innerHTML = orders.length ? orders.map((order) =>
      '<button type="button" class="order-row" data-open-order="' + order.orderId + '">' +
        "<span>" + escapeHTML(order.orderId) + "</span>" +
        "<strong>" + escapeHTML(order.recipient.recipientName || "未命名") + "</strong>" +
        "<em>" + escapeHTML(order.plan.name) + " · " + escapeHTML(order.template.id) + "</em>" +
        "<small>" + escapeHTML(order.status) + "</small>" +
      "</button>"
    ).join("") : '<p class="empty">暂无本地订单。</p>';
    if (orders[0]) renderOrderDetail(orders[0].orderId);
  }

  function relatedValue(row, relation, key) {
    const value = row[relation];
    if (Array.isArray(value)) return value[0] ? value[0][key] : "";
    return value ? value[key] : "";
  }

  async function renderCloudAdminOrders() {
    try {
      const rows = await window.BirthdayCloudOrders.listAdminOrders();
      cloudState.adminOrders = rows;
      const query = $("#adminSearch").value.trim().toLowerCase();
      const status = $("#adminStatusFilter").value;
      const plan = $("#adminPlanFilter").value;
      const template = $("#adminTemplateFilter").value;
      const filtered = rows.filter((row) => {
        const rowPlan = relatedValue(row, "plans", "code");
        const rowTemplate = relatedValue(row, "templates", "code");
        const text = [row.order_number, row.recipient_name, row.contact_value].join(" ").toLowerCase();
        return (!query || text.includes(query))
          && (!status || row.status === status)
          && (!plan || planCodeById[plan] === rowPlan)
          && (!template || template === rowTemplate);
      });
      $("#adminOrderList").innerHTML = filtered.length ? filtered.map((row) =>
        '<button type="button" class="order-row" data-cloud-order="' + row.id + '">' +
          "<span>" + escapeHTML(row.order_number) + "</span>" +
          "<strong>" + escapeHTML(row.recipient_name || "待顾客填写") + "</strong>" +
          "<em>" + escapeHTML(relatedValue(row, "plans", "name")) + " · " + escapeHTML(relatedValue(row, "templates", "code")) + "</em>" +
          "<small>" + escapeHTML(row.status) + "</small>" +
        "</button>"
      ).join("") : '<p class="empty">暂无真实订单。</p>';
      if (filtered[0]) renderCloudOrderDetail(filtered[0].id);
    } catch (error) {
      console.error("Could not load cloud orders:", error);
      $("#adminOrderList").innerHTML = '<p class="empty">无法读取订单：' + escapeHTML(error.message) + "</p>";
    }
  }

  function renderCloudOrderDetail(orderId) {
    const order = cloudState.adminOrders.find((item) => item.id === orderId);
    if (!order) return;
    const planName = relatedValue(order, "plans", "name");
    const templateCode = relatedValue(order, "templates", "code");
    const statusActions =
      '<button type="button" class="secondary-button" data-order-id="' + order.id + '" data-status="needs_revision">标记需补充</button>' +
      '<button type="button" class="secondary-button" data-order-id="' + order.id + '" data-status="approved">标记通过</button>' +
      '<button type="button" class="secondary-button" data-order-id="' + order.id + '" data-status="submitted">恢复待处理</button>';
    const publishAction = order.status === "approved"
      ? '<button type="button" class="primary-button" data-publish-order="' + order.id + '">发布生日页</button>'
      : "";
    const publishedPanel = order.published_url
      ? '<div class="published-link"><p class="eyebrow">专属生日页已发布</p><input readonly value="' + escapeAttr(order.published_url) + '"><div class="status-actions"><button type="button" class="secondary-button" data-copy-published="' + escapeAttr(order.published_url) + '">复制链接</button><a class="secondary-button" href="' + escapeAttr(order.published_url) + '" target="_blank" rel="noopener noreferrer">打开页面</a></div></div>'
      : "";
    $("#adminOrderDetail").innerHTML =
      '<div class="detail-head"><div><p class="eyebrow">真实订单</p><h3>' + escapeHTML(order.order_number) + '</h3></div><span>' + escapeHTML(order.status) + '</span></div>' +
      '<div class="detail-grid">' +
        '<p><b>寿星</b>' + escapeHTML(order.recipient_name || "待客户填写") + '</p>' +
        '<p><b>联系方式</b>' + escapeHTML(order.contact_value || "待客户填写") + '</p>' +
        '<p><b>套餐</b>' + escapeHTML(planName) + '</p>' +
        '<p><b>模板</b>' + escapeHTML(templateCode) + '</p>' +
        '<p><b>渠道</b>' + escapeHTML(order.purchase_channel || "manual") + '</p>' +
        '<p><b>创建时间</b>' + escapeHTML(new Date(order.created_at).toLocaleString()) + '</p>' +
      '</div>' +
      '<div class="status-actions">' + statusActions + publishAction + '</div>' +
      publishedPanel;
  }

  async function publishCloudOrder(orderId) {
    if (!cloudState.isAdmin || !cloudEnabled()) {
      showToast("请先登录真实商家后台。");
      return;
    }
    try {
      showToast("正在生成专属生日页链接……");
      const result = await window.BirthdayCloudOrders.publishOrder(orderId);
      await renderCloudAdminOrders();
      renderCloudOrderDetail(orderId);
      showToast("生日页已发布，链接已生成。");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(result.publishedUrl).catch(() => {});
      }
    } catch (error) {
      console.error("Could not publish birthday page:", error);
      showToast("发布失败：" + error.message);
    }
  }

  async function copyPublishedUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      showToast("专属生日页链接已复制。");
    } catch (error) {
      showToast("复制失败，请长按链接手动复制。");
    }
  }

  async function createCloudOrder(event) {
    event.preventDefault();
    if (!cloudState.isAdmin || !cloudEnabled()) {
      showToast("请先登录真实商家后台。");
      return;
    }
    try {
      const result = await window.BirthdayCloudOrders.createOrder({
        planCode: $("#adminCreatePlan").value,
        templateCode: $("#adminCreateTemplate").value,
        purchaseChannel: $("#adminCreateChannel").value,
        externalOrderNumber: $("#adminCreateExternalOrder").value.trim() || null
      });
      const claimUrl = window.location.origin + window.location.pathname + result.claimUrlQuery;
      $("#adminOrderDetail").innerHTML =
        '<div class="detail-head"><div><p class="eyebrow">测试订单已创建</p><h3>' + escapeHTML(result.order.order_number) + "</h3></div><span>created</span></div>" +
        '<label class="field">顾客领取链接<input id="newClaimUrl" readonly value="' + escapeHTML(claimUrl) + '"></label>' +
        '<button class="primary-button" id="copyClaimUrl" type="button">复制领取链接</button>' +
        "<p>请用无痕窗口或另一台手机打开此链接，作为顾客完成 8 步填写。</p>";
      const copyButton = $("#copyClaimUrl");
      if (copyButton) copyButton.addEventListener("click", async () => {
        await navigator.clipboard.writeText(claimUrl);
        showToast("领取链接已复制。");
      });
      await renderCloudAdminOrders();
      $("#adminOrderDetail").innerHTML =
        '<div class="detail-head"><div><p class="eyebrow">测试订单已创建</p><h3>' + escapeHTML(result.order.order_number) + "</h3></div><span>created</span></div>" +
        '<label class="field">顾客领取链接<input id="newClaimUrl" readonly value="' + escapeHTML(claimUrl) + '"></label>' +
        '<button class="primary-button" id="copyClaimUrl" type="button">复制领取链接</button>' +
        "<p>请用无痕窗口或另一台手机打开此链接，作为顾客完成 8 步填写。</p>";
      const button = $("#copyClaimUrl");
      if (button) button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(claimUrl);
        showToast("领取链接已复制。");
      });
    } catch (error) {
      console.error("Could not create cloud order:", error);
      showToast("创建测试订单失败：" + error.message);
    }
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

  async function updateOrderStatus(orderId, status) {
    if (cloudState.isAdmin && cloudEnabled()) {
      try {
        await window.BirthdayCloudOrders.updateOrderStatus(orderId, status);
        await renderCloudAdminOrders();
        renderCloudOrderDetail(orderId);
        showToast("真实订单状态已更新。");
      } catch (error) {
        showToast("更新订单状态失败：" + error.message);
      }
      return;
    }
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
    const orders = cloudState.isAdmin && cloudEnabled() ? cloudState.adminOrders : readOrders();
    const json = JSON.stringify(orders, null, 2);
    downloadText("birthday-orders-" + Date.now() + ".json", json);
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

  function localDraftSnapshot() {
    const snapshot = clone(state);
    // Never store Base64 photo data in localStorage. Photos stay in memory until
    // they are uploaded to private Storage after an order has been claimed.
    snapshot.media = { cover: null, gallery: [] };
    return snapshot;
  }

  function persistDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(localDraftSnapshot()));
    } catch (error) {
      console.warn("Could not save the local text draft.", error);
    }
    scheduleCloudDraft();
  }

  function restoreDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved) {
        Object.assign(state, saved);
        state.media = { cover: null, gallery: [] };
      }
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
