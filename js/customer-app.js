(function () {
  "use strict";

  var plans = Array.isArray(window.BD_PLANS) ? window.BD_PLANS : [];
  var templates = Array.isArray(window.BD_TEMPLATES) ? window.BD_TEMPLATES : [];
  var modules = window.BD_MODULES || {};
  var imagery = Array.isArray(window.BD_IMAGERY) ? window.BD_IMAGERY : [];
  var fixedModules = ["gallery", "messageWall", "countdown"];
  var editableStatuses = ["claimed", "draft", "needs_revision"];
  var legacyPlans = { basic_99: "basic_166", heart_169: "basic_166", surprise_249: "upgrade_288", all_love_399: "upgrade_288" };
  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
  var toastTimer;
  var dragId = null;

  var state = {
    currentStep: 1,
    completedSteps: new Set(),
    mode: "awaiting",
    orderId: null,
    orderNumber: "",
    orderStatus: "created",
    lockedPlanName: "",
    lockedPlanPrice: null,
    planCode: plans[0] ? plans[0].code : "basic_166",
    templateId: "",
    order: { contactMethod: "wechat", contactValue: "", purchaseChannel: "manual" },
    recipient: { recipientName: "", birthday: "", showAge: false, relationshipType: "best_friend", relationshipOther: "" },
    sender: { senderName: "", senderAnonymous: false },
    content: { headline: "", longMessage: "", signature: "", blessingMode: "write", inspirationFacts: "", inspirationTone: "warm", polishSource: "" },
    media: { cover: null, gallery: [] },
    activeModules: [],
    modules: {
      wishBottle: { title: "\u8bb8\u4e00\u4e2a\u4f1a\u6162\u6162\u5b9e\u73b0\u7684\u613f\u671b", prompt: "\u628a\u60f3\u5bf9 TA \u8bf4\u7684\u5c0f\u613f\u671b\u653e\u8fdb\u74f6\u5b50\u91cc\u3002" },
      futureMailbox: { openDate: "", content: "" },
      surpriseBox: { imageryCode: "", surpriseTitle: "\u7ed9\u4f60\u85cf\u4e86\u4e00\u4efd\u5c0f\u60ca\u559c", surpriseMessage: "", signature: "" },
      dailyLuck: {},
      bgm: { enabled: true }
    },
    privacy: { privacyConfirmed: false }
  };

  function currentPlan() { if (!plans.length) throw new Error("套餐配置未加载，请检查 config/plans.js 是否存在并正确设置 window.BD_PLANS。"); return plans.find(function (item) { return item.code === state.planCode || item.id === state.planCode; }) || plans[0]; }
  function canEditOrder() { return state.mode === "cloud" && editableStatuses.includes(state.orderStatus); }
  function canEditTemplate() { return canEditOrder(); }
  function draftKey() { return state.orderId ? "birthday-intake-six-draft-" + state.orderId : ""; }
  function text(value) { return String(value || "").trim(); }
  function e(value) { var element = document.createElement("div"); element.textContent = String(value == null ? "" : value); return element.innerHTML; }

  function activeGalleryPhotos() { return state.media.gallery.filter(function (photo) { return photo.status !== "failed"; }); }
  function completeGalleryPhotos() { return state.media.gallery.filter(function (photo) { return photo.status === "complete"; }); }
  function init() {
    try {
      if (!templates.length) throw new Error("模板配置未加载，请检查 config/templates.js。");
      if (!modules || !Object.keys(modules).length) throw new Error("功能配置未加载，请检查 config/modules.js。");
      bindEvents();
      renderAwaitingOrder("商家会先确认套餐并创建订单。收到聊天里的填写链接后，直接打开链接，就可以安全上传照片、保存资料并提交制作。");
      void initializeOrder();
    } catch (error) {
      console.error("Birthday intake initialization failed:", error);
      renderAwaitingOrder(error.message || "请刷新后重试。", "页面暂时不能开始填写");
    }
  }
  function bindEvents() {
    $("#customerOrderForm").addEventListener("input", function () { syncFromForm(); afterChange(); });
    $("#customerOrderForm").addEventListener("change", function () { syncFromForm(); afterChange(); });
    $("#nextStep").addEventListener("click", nextStep);
    $("#prevStep").addEventListener("click", function () { if (state.currentStep > 1) setStep(state.currentStep - 1); });
    $("#submitOrder").addEventListener("click", submitOrder);
    $("#stepPills").addEventListener("click", function (event) {
      var button = event.target.closest("[data-step-target]");
      if (!button) return;
      var step = Number(button.dataset.stepTarget);
      if (step === state.currentStep || state.completedSteps.has(step)) setStep(step);
      else showToast("\u5148\u5b8c\u6210\u524d\u9762\u7684\u5185\u5bb9\uff0c\u518d\u7ee7\u7eed\u5f80\u4e0b\u8d70\u3002");
    });
    $("#templateGrid").addEventListener("click", function (event) {
      var preview = event.target.closest("[data-preview-template]");
      if (preview) return previewTemplate(preview.dataset.previewTemplate);
      var select = event.target.closest("[data-template-id]");
      if (!select) return;
      if (!canEditTemplate()) return showToast("\u6a21\u677f\u4f1a\u5728\u6b63\u5f0f\u63d0\u4ea4\u524d\u9501\u5b9a\uff0c\u73b0\u5728\u4e0d\u80fd\u518d\u66f4\u6362\u3002");
      state.templateId = select.dataset.templateId;
      renderTemplates(); afterChange();
    });
    $("#closeTemplatePreview").addEventListener("click", function () { $("#templatePreviewDialog").close(); });
    $$('[data-file-target]').forEach(function (button) { button.addEventListener("click", function () { $("#" + button.dataset.fileTarget).click(); }); });
    $("#coverInput").addEventListener("change", function (event) { if (event.target.files[0]) void addCover(event.target.files[0]); event.target.value = ""; });
    $("#galleryInput").addEventListener("change", function (event) { if (event.target.files.length) void addGallery(Array.from(event.target.files)); event.target.value = ""; });
    $("#coverPreview").addEventListener("click", function (event) {
      if (event.target.closest("[data-cover-retry]")) { $("#coverInput").click(); return; }
      var focal = event.target.closest("[data-focal]");
      if (!focal || !state.media.cover) return;
      var pair = focal.dataset.focal.split(",").map(Number);
      window.BirthdayPhotoManager.setFocal(state.media.cover, pair[0], pair[1]);
      renderUploads(); void savePhotoMeta(state.media.cover, 0); afterChange();
    });
    bindGalleryEvents();
    $("#blessingTabs").addEventListener("click", function (event) {
      var button = event.target.closest("[data-blessing-mode]");
      if (!button) return;
      state.content.blessingMode = button.dataset.blessingMode;
      renderBlessingMode(); afterChange();
    });
    $("#generateBlessing").addEventListener("click", generateInspiration);
    $("#polishBlessing").addEventListener("click", generatePolish);
    $("#blessingCandidates").addEventListener("click", applyCandidate);
    $("#polishCandidates").addEventListener("click", applyCandidate);
    $("#moduleGrid").addEventListener("click", function (event) { var button = event.target.closest("[data-module-toggle]"); if (button) toggleModule(button.dataset.moduleToggle); });
    $("#moduleFields").addEventListener("click", function (event) {
      var button = event.target.closest("[data-imagery-code]");
      if (!button) return;
      state.modules.surpriseBox.imageryCode = button.dataset.imageryCode;
      renderModules(); afterChange();
    });
    window.addEventListener("popstate", function (event) { var step = event.state && event.state.step; if (step && (step === state.currentStep || state.completedSteps.has(step))) setStep(step, true); });
  }

  function bindGalleryEvents() {
    var list = $("#galleryList");
    list.addEventListener("click", function (event) {
      var action = event.target.closest("[data-photo-action]");
      if (!action) return;
      var id = action.dataset.photoId;
      if (action.dataset.photoAction === "remove") void removePhoto(id);
      if (action.dataset.photoAction === "retry") void retryPhoto(id);
      if (action.dataset.photoAction === "feature") toggleFeatured(id);
      if (action.dataset.photoAction === "cover") void useAsCover(id);
      if (action.dataset.photoAction === "up") movePhoto(id, -1);
      if (action.dataset.photoAction === "down") movePhoto(id, 1);
    });
    list.addEventListener("pointerdown", function (event) {
      if (event.target.closest("button")) return;
      var card = event.target.closest("[data-photo-id]");
      if (!card) return;
      dragId = card.dataset.photoId; card.classList.add("dragging");
      try { card.setPointerCapture(event.pointerId); } catch (_) { /* Optional. */ }
    });
    list.addEventListener("pointerup", function (event) {
      if (!dragId) return;
      var card = event.target.closest("[data-photo-id]");
      $$('[data-photo-id]', list).forEach(function (item) { item.classList.remove("dragging"); });
      if (card && card.dataset.photoId !== dragId) {
        state.media.gallery = window.BirthdayPhotoManager.reorder(state.media.gallery, dragId, card.dataset.photoId);
        normalizeFeatured(); renderUploads(); syncPhotoMeta(); afterChange();
      }
      dragId = null;
    });
    list.addEventListener("pointercancel", function () { dragId = null; $$('[data-photo-id]', list).forEach(function (item) { item.classList.remove("dragging"); }); });
  }

  async function initializeOrder() {
    if (!window.BirthdaySupabase || !window.BirthdaySupabase.isEnabled || !window.BirthdaySupabase.isEnabled()) {
      return renderAwaitingOrder("资料填写服务暂时还没有连接完成。请联系商家确认专属填写链接后再打开，不需要在这里重复填写资料。", "暂时不能开始填写");
    }
    try {
      await window.BirthdayAuth.ensureAnonymousSession();
      var params = new URLSearchParams(window.location.search);
      var orderNumber = params.get("order");
      var token = params.get("token");
      if (!orderNumber || !token) {
        return renderAwaitingOrder("商家会先确认套餐并创建订单。请从聊天记录中的完整专属链接进入，才能上传照片、保存草稿并提交制作资料。");
      }
      var claimed = await window.BirthdayCloudOrders.claimOrder(orderNumber, token);
      state.mode = "cloud";
      state.orderId = claimed.order.id;
      state.orderNumber = claimed.order.order_number;
      state.orderStatus = claimed.order.status;
      hydrateCloud(await window.BirthdayCloudOrders.loadOrder(state.orderId));
      restoreLocalDraft();
      renderAll();
      showToast("订单已安全领取，可以继续填写。");
    } catch (error) {
      console.error("Claimed order initialization failed:", error);
      renderAwaitingOrder("无法领取这份订单：" + (error.message || "请联系商家重新发送链接。"), "这份链接暂时不能使用");
    }
  }
  function hydrateCloud(record) {
    var order = record.order || {}; var content = record.content || {}; var custom = content.custom_data || {};
    var planCode = record.plan && record.plan.code || "basic_166";
    state.mode = "cloud"; state.orderId = order.id; state.orderNumber = order.order_number || state.orderNumber; state.orderStatus = order.status || "claimed";
    state.planCode = legacyPlans[planCode] || planCode; state.lockedPlanName = record.plan && record.plan.name || currentPlan().name; state.lockedPlanPrice = record.plan && record.plan.price;
    state.templateId = record.template && record.template.code || "";
    state.order = { contactMethod: order.contact_method || "wechat", contactValue: order.contact_value || "", purchaseChannel: order.purchase_channel || "manual" };
    state.recipient = { recipientName: order.recipient_name || "", birthday: order.recipient_birthday || "", showAge: Boolean(order.show_age), relationshipType: order.relationship_type || "best_friend", relationshipOther: custom.relationshipOther || "" };
    state.sender = { senderName: order.sender_name || "", senderAnonymous: Boolean(order.sender_anonymous) };
    state.content = { headline: content.headline || content.main_message || "", longMessage: content.long_message || "", signature: content.signature || "", blessingMode: custom.blessingMode || "write", inspirationFacts: custom.inspirationFacts || "", inspirationTone: custom.inspirationTone || "warm", polishSource: custom.polishSource || "" };
    var stored = {}; (record.modules || []).forEach(function (row) { stored[row.module_code] = row.configuration || {}; });
    state.modules = Object.assign(state.modules, stored);
    state.activeModules = (record.modules || []).filter(function (row) { return row.enabled && (currentPlan().optionalModulePool || []).includes(row.module_code); }).map(function (row) { return row.module_code; });
    var cover = (record.files || []).find(function (file) { return file.file_type === "cover"; });
    state.media.cover = cover ? photoFromRecord(cover) : null;
    state.media.gallery = (record.files || []).filter(function (file) { return file.file_type === "gallery"; }).map(photoFromRecord);
    normalizeFeatured();
  }

  function photoFromRecord(file) { return { id: file.id, originalName: file.original_filename || "photo.jpg", previewUrl: file.previewUrl || "", width: file.width || 0, height: file.height || 0, status: "complete", storageRecord: file, isFeatured: Boolean(file.is_featured), featuredSortOrder: file.featured_sort_order || null, focalX: Number.isFinite(Number(file.focal_x)) ? Number(file.focal_x) : .5, focalY: Number.isFinite(Number(file.focal_y)) ? Number(file.focal_y) : .5, cropData: file.crop_data || {} }; }

  function restoreLocalDraft() {
    try {
      if (!draftKey()) return;
      var saved = JSON.parse(localStorage.getItem(draftKey()) || "null");
      if (!saved) return;
      ["templateId"].forEach(function (key) { if (saved[key]) state[key] = saved[key]; });
      ["order", "recipient", "sender", "content", "modules", "privacy"].forEach(function (key) {
        if (saved[key]) state[key] = Object.assign(state[key], saved[key]);
      });
      state.activeModules = Array.isArray(saved.activeModules) ? saved.activeModules.filter(function (code) { return (currentPlan().optionalModulePool || []).includes(code); }) : state.activeModules;
      state.completedSteps = new Set(Array.isArray(saved.completedSteps) ? saved.completedSteps : []);
      state.currentStep = Math.min(6, Math.max(1, Number(saved.currentStep) || 1));
    } catch (error) {
      console.warn("Draft restore failed.", error);
    }
  }

  function persistLocal() {
    if (!draftKey()) return;
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        currentStep: state.currentStep,
        completedSteps: Array.from(state.completedSteps),
        templateId: state.templateId,
        order: state.order,
        recipient: state.recipient,
        sender: state.sender,
        content: state.content,
        modules: state.modules,
        activeModules: state.activeModules,
        privacy: state.privacy
      }));
    } catch (error) {
      console.warn("Draft persist failed.", error);
    }
  }
  function afterChange() { syncConditional(); updateCounter(); renderProgress(); persistLocal(); scheduleSave(); }
  function scheduleSave() {
    if (!canEditOrder()) return renderSaveStatus();
    window.BirthdayAutosave.schedule(async function () {
      renderSaveStatus("\u6b63\u5728\u4fdd\u5b58\u2026");
      await window.BirthdayCloudOrders.saveDraft(state.orderId, snapshot());
      state.orderStatus = "draft"; renderSaveStatus("\u5df2\u4fdd\u5b58");
    }, 900);
  }
  function snapshot() { return { orderStatus: state.orderStatus, templateId: state.templateId, order: state.order, recipient: state.recipient, sender: state.sender, content: state.content, modules: state.modules, activeModules: fixedModules.concat(state.activeModules), privacy: state.privacy }; }

  function syncFromForm() {
    var value = function (name) { var input = $('[name="' + name + '"]'); return input ? input.value : ""; };
    var checked = function (name) { var input = $('[name="' + name + '"]'); return Boolean(input && input.checked); };
    state.order.contactMethod = value("contactMethod"); state.order.contactValue = value("contactValue");
    state.recipient.recipientName = value("recipientName"); state.recipient.birthday = value("birthday"); state.recipient.showAge = checked("showAge"); state.recipient.relationshipType = value("relationshipType"); state.recipient.relationshipOther = value("relationshipOther");
    state.sender.senderName = value("senderName"); state.sender.senderAnonymous = checked("senderAnonymous");
    state.content.headline = value("headline"); state.content.longMessage = value("longMessage"); state.content.signature = value("signature"); state.content.inspirationFacts = value("inspirationFacts"); state.content.inspirationTone = value("inspirationTone") || "warm"; state.content.polishSource = value("polishSource");
    state.privacy.privacyConfirmed = checked("privacyConfirmed");
    state.modules.wishBottle.title = value("wishBottleTitle") || state.modules.wishBottle.title; state.modules.wishBottle.prompt = value("wishBottlePrompt") || state.modules.wishBottle.prompt;
    state.modules.futureMailbox.openDate = value("futureOpenDate") || ""; state.modules.futureMailbox.content = value("futureMessage") || "";
    state.modules.surpriseBox.surpriseTitle = value("surpriseTitle") || "\u7ed9\u4f60\u85cf\u4e86\u4e00\u4efd\u5c0f\u60ca\u559c"; state.modules.surpriseBox.surpriseMessage = value("surpriseMessage") || ""; state.modules.surpriseBox.signature = value("surpriseSignature") || "";
  }

  function syncForm() {
    var set = function (name, value) { var input = $('[name="' + name + '"]'); if (input) input.value = value == null ? "" : value; };
    var setCheck = function (name, value) { var input = $('[name="' + name + '"]'); if (input) input.checked = Boolean(value); };
    set("contactMethod", state.order.contactMethod); set("contactValue", state.order.contactValue); set("recipientName", state.recipient.recipientName); set("birthday", state.recipient.birthday); setCheck("showAge", state.recipient.showAge); set("relationshipType", state.recipient.relationshipType); set("relationshipOther", state.recipient.relationshipOther); set("senderName", state.sender.senderName); setCheck("senderAnonymous", state.sender.senderAnonymous);
    set("headline", state.content.headline); set("longMessage", state.content.longMessage); set("signature", state.content.signature); set("inspirationFacts", state.content.inspirationFacts); set("inspirationTone", state.content.inspirationTone); set("polishSource", state.content.polishSource); setCheck("privacyConfirmed", state.privacy.privacyConfirmed);
    syncConditional(); updateCounter(); renderBlessingMode();
  }

  function setOrderWorkspaceVisible(visible) {
    $("#progressPanel").hidden = !visible;
    $("#customerOrderForm").hidden = !visible;
    $("#awaitingOrder").hidden = visible;
  }

  function renderAwaitingOrder(message, title) {
    state.mode = "awaiting";
    setOrderWorkspaceVisible(false);
    $("#orderBanner").innerHTML = "";
    $("#awaitingOrderCopy").textContent = message;
    var heading = $("#awaitingOrder h2");
    if (heading) heading.textContent = title || "请从商家发来的专属链接开始";
    renderSaveStatus();
  }

  function renderAll() {
    setOrderWorkspaceVisible(true);
    renderBanner();
    renderOrderSummary();
    renderTemplates();
    syncForm();
    renderUploads();
    renderModules();
    renderReview();
    setStep(state.currentStep, true);
    renderProgress();
  }

  function renderBanner() {
    $("#orderBanner").innerHTML = '<div class="banner"><strong>订单已锁定。</strong><span>你填写的内容会自动保存；正式提交后，商家会检查照片和文案。</span></div>';
  }
  function renderOrderSummary() {
    var plan = currentPlan(); var name = state.lockedPlanName || plan.name; var price = Number.isFinite(Number(state.lockedPlanPrice)) ? state.lockedPlanPrice : plan.priceCny;
    var featureNames = fixedModules.concat(plan.optionalModulePool || []).map(function (code) { return modules[code] && modules[code].name || code; }).join("\u3001");
    var rows = [["\u8ba2\u5355\u7f16\u53f7", state.orderNumber || "\u2014"], ["\u8d2d\u4e70\u6e20\u9053", channelName(state.order.purchaseChannel)], ["\u5df2\u8d2d\u5957\u9910", name + " \u00b7 \u00a5" + price], ["\u7167\u7247\u4e0a\u9650", plan.galleryLimit + " \u5f20\u56de\u5fc6\u7167\u7247"], ["\u672c\u5957\u9910\u5df2\u5305\u542b", featureNames]];
    $("#lockedOrderSummary").innerHTML = rows.map(function (row, index) { return '<div' + (index === 4 ? ' class="order-module-list"' : '') + '><span>' + row[0] + '</span><strong>' + e(row[1]) + '</strong></div>'; }).join("");
  }

  function renderTemplates() {
    var editable = canEditTemplate();
    $("#templateGrid").innerHTML = templates.map(function (template) {
      var selected = template.id === state.templateId;
      var preview = template.previewImage + "?v=20260717-six-step-r4";
      var fallback = (template.fullPreviewImage || template.previewImage) + "?v=20260717-six-step-r4";
      var priority = Number(template.id.slice(1)) <= 4 ? "eager" : "lazy";
      return '<article class="template-card ' + (selected ? "selected" : "") + '">' +
        '<div class="template-image-wrap"><img src="' + e(preview) + '" loading="' + priority + '" decoding="async" fetchpriority="' + (priority === "eager" ? "high" : "auto") + '" onerror="this.onerror=null;this.src=\'' + e(fallback) + '\'" alt="' + e(template.name) + '">' +
        '<span class="template-id">' + template.id + '</span></div>' +
        '<div class="template-info"><strong>' + e(template.name) + '</strong><span>' + e(template.description || "") + '</span>' +
        '<button class="template-preview" type="button" data-preview-template="' + template.id + '">查看大图</button>' +
        '<button class="template-preview" type="button" data-template-id="' + template.id + '" ' + (editable ? "" : "disabled") + '>' +
        (selected ? "已选中" : editable ? "选择这套" : "订单验证后可选择") + '</button></div></article>';
    }).join("");
  }
  function previewTemplate(id) { var template = templates.find(function (item) { return item.id === id; }); if (!template) return; $("#templatePreviewImage").src = template.fullPreviewImage || template.previewImage; $("#templatePreviewImage").alt = template.name; $("#templatePreviewCaption").textContent = template.id + " · " + template.name + " · " + (template.description || ""); $("#templatePreviewDialog").showModal(); }

  function renderUploads() {
    var plan = currentPlan(); var activeGallery = activeGalleryPhotos(); $("#photoLimitCopy").textContent = "\u5c01\u9762\u56fe 1 \u5f20\uff1b\u5f53\u524d\u8ba2\u5355\u6700\u591a\u4e0a\u4f20 " + plan.galleryLimit + " \u5f20\u56de\u5fc6\u7167\u7247\u3002\u4f60\u53ef\u4ee5\u4ece\u4e2d\u9009\u62e9\u6700\u591a 8 \u5f20\u91cd\u70b9\u5c55\u793a\u3002"; $("#galleryCount").textContent = activeGallery.length + " / " + plan.galleryLimit;
    var cover = state.media.cover;
    $("#coverPreview").classList.toggle("empty", !cover);
    if (!cover) $("#coverPreview").textContent = "\u8fd8\u6ca1\u6709\u653e\u5165\u5c01\u9762\u56fe";
    else if (cover.status !== "complete") {
      var failedCover = cover.status === "failed";
      $("#coverPreview").innerHTML = '<div class="cover-upload-state ' + (failedCover ? "failed" : "") + '"><strong>' + (failedCover ? "\u5c01\u9762\u56fe\u4e0a\u4f20\u5931\u8d25" : "\u5c01\u9762\u56fe\u6b63\u5728\u4e0a\u4f20") + '</strong><span>' + e(failedCover ? (cover.error || "\u8bf7\u91cd\u65b0\u9009\u62e9\u540e\u518d\u8bd5\u4e00\u6b21") : "\u6b63\u5728\u5b89\u5168\u4fdd\u5b58\u539f\u56fe\uff0c\u8bf7\u7a0d\u5019") + '</span>' + (failedCover ? '<button class="text-action" type="button" data-cover-retry>\u91cd\u65b0\u9009\u62e9\u5c01\u9762\u56fe</button>' : "") + '</div>';
    }
    else {
      var points = [[.2,.2,"\u5de6\u4e0a"],[.5,.2,"\u4e0a\u65b9"],[.8,.2,"\u53f3\u4e0a"],[.2,.5,"\u5de6\u4fa7"],[.5,.5,"\u5c45\u4e2d"],[.8,.5,"\u53f3\u4fa7"],[.2,.8,"\u5de6\u4e0b"],[.5,.8,"\u4e0b\u65b9"],[.8,.8,"\u53f3\u4e0b"]];
      $("#coverPreview").innerHTML = '<figure class="cover-photo" style="--focal-x:' + cover.focalX * 100 + '%;--focal-y:' + cover.focalY * 100 + '%"><img src="' + e(cover.previewUrl) + '" alt="\u5c01\u9762\u9884\u89c8"><figcaption>' + e(cover.originalName) + '</figcaption></figure><div class="focal-picker">' + points.map(function (point) { var active = Math.abs(cover.focalX - point[0]) < .01 && Math.abs(cover.focalY - point[1]) < .01; return '<button type="button" class="focal-dot ' + (active ? "active" : "") + '" data-focal="' + point[0] + ',' + point[1] + '">' + point[2] + '</button>'; }).join("") + '</div>';
    }    $("#galleryList").innerHTML = state.media.gallery.map(function (photo) {
      var failed = photo.status === "failed"; var status = ({ processing: "\u5904\u7406\u4e2d", uploading: "\u4e0a\u4f20\u4e2d", complete: "\u5df2\u5b8c\u6210", failed: "\u4e0a\u4f20\u5931\u8d25" })[photo.status] || "\u7b49\u5f85\u5904\u7406";
      var actions = photo.status === "complete" ? '<button class="text-action featured-toggle ' + (photo.isFeatured ? "selected" : "") + '" type="button" data-photo-action="feature" data-photo-id="' + photo.id + '">' + (photo.isFeatured ? "\u91cd\u70b9\u56de\u5fc6" : "\u8bbe\u4e3a\u91cd\u70b9") + '</button><button class="text-action" type="button" data-photo-action="cover" data-photo-id="' + photo.id + '">\u8bbe\u4e3a\u5c01\u9762</button><button class="text-action" type="button" data-photo-action="up" data-photo-id="' + photo.id + '">\u4e0a\u79fb</button><button class="text-action" type="button" data-photo-action="down" data-photo-id="' + photo.id + '">\u4e0b\u79fb</button><button class="text-action" type="button" data-photo-action="remove" data-photo-id="' + photo.id + '">\u5220\u9664</button>' : failed ? '<button class="text-action" type="button" data-photo-action="retry" data-photo-id="' + photo.id + '">\u91cd\u8bd5</button><button class="text-action" type="button" data-photo-action="remove" data-photo-id="' + photo.id + '">\u5220\u9664</button>' : '<span class="upload-action-note">\u6b63\u5728\u5904\u7406\uff0c\u8bf7\u7a0d\u5019</span>';
      return '<article class="photo-upload-card" data-photo-id="' + photo.id + '"><div class="photo-thumb">' + (photo.previewUrl ? '<img src="' + e(photo.previewUrl) + '" alt="\u56de\u5fc6\u7167\u7247\u9884\u89c8">' : '') + '</div><div class="photo-upload-body"><div class="photo-upload-title"><strong>' + e(photo.originalName || "\u7167\u7247") + '</strong><span class="photo-status ' + (failed ? "failed" : "") + '">' + status + '</span></div><div class="photo-upload-actions">' + actions + '</div></div></article>';
    }).join("") || '<p class="upload-note">\u8fd8\u6ca1\u6709\u52a0\u5165\u56de\u5fc6\u7167\u7247\u3002</p>';
  }

  async function addCover(file) {
    if (!canEditOrder()) return showToast("\u8bf7\u901a\u8fc7\u5546\u5bb6\u63d0\u4f9b\u7684\u4e13\u5c5e\u94fe\u63a5\u4e0a\u4f20\u6b63\u5f0f\u7167\u7247\u3002");
    var previous = state.media.cover; var photo = null;
    try {
      photo = await window.BirthdayPhotoManager.prepare(file, "cover"); photo.status = "uploading";
      state.media.cover = photo; renderUploads();
      photo.storageRecord = await window.BirthdayCloudOrders.uploadFile(state.orderId, "cover", photo.file, photoMeta(photo, 0)); photo.status = "complete";
      if (previous && previous.storageRecord) await window.BirthdayCloudOrders.deleteFile(previous.storageRecord);
      renderUploads(); afterChange();
    } catch (error) {
      if (previous && previous.status === "complete") { if (photo) window.BirthdayPhotoManager.revoke(photo); state.media.cover = previous; }
      else if (photo) { photo.status = "failed"; photo.error = error.message || "\u5c01\u9762\u56fe\u4e0a\u4f20\u5931\u8d25"; state.media.cover = photo; }
      renderUploads(); showToast(error.message || "\u5c01\u9762\u56fe\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002");
    }
  }
  async function addGallery(files) {
    if (!canEditOrder()) return showToast("\u8bf7\u901a\u8fc7\u5546\u5bb6\u63d0\u4f9b\u7684\u4e13\u5c5e\u94fe\u63a5\u4e0a\u4f20\u6b63\u5f0f\u7167\u7247\u3002");
    var remaining = currentPlan().galleryLimit - activeGalleryPhotos().length;
    if (remaining <= 0) return showToast("\u5f53\u524d\u8ba2\u5355\u6700\u591a " + currentPlan().galleryLimit + " \u5f20\u56de\u5fc6\u7167\u7247\u3002");
    if (files.length > remaining) showToast("\u8d85\u51fa\u7684\u7167\u7247\u6ca1\u6709\u52a0\u5165\uff0c\u8fd8\u53ef\u4e0a\u4f20 " + remaining + " \u5f20\u3002");
    for (var i = 0; i < Math.min(files.length, remaining); i += 1) await addOneGallery(files[i]);
  }
  async function addOneGallery(file) {
    var photo = { id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()), originalName: file.name || "\u7167\u7247", sourceFile: file, previewUrl: "", status: "processing", isFeatured: false, focalX: .5, focalY: .5, cropData: {} };
    state.media.gallery.push(photo); renderUploads();
    try {
      Object.assign(photo, await window.BirthdayPhotoManager.prepare(file, "gallery")); photo.status = "uploading"; renderUploads();
      photo.storageRecord = await window.BirthdayCloudOrders.uploadFile(state.orderId, "gallery", photo.file, photoMeta(photo, state.media.gallery.length - 1)); photo.status = "complete";
      normalizeFeatured(); renderUploads(); afterChange();
    } catch (error) { photo.status = "failed"; photo.error = error.message || "\u4e0a\u4f20\u5931\u8d25"; renderUploads(); showToast(photo.originalName + " \u4e0a\u4f20\u5931\u8d25\uff1a" + photo.error); }
  }
  async function retryPhoto(id) { var photo = state.media.gallery.find(function (item) { return item.id === id; }); if (!photo || !photo.sourceFile) return showToast("\u8bf7\u91cd\u65b0\u9009\u62e9\u8fd9\u5f20\u7167\u7247\u540e\u518d\u4e0a\u4f20\u3002"); state.media.gallery = state.media.gallery.filter(function (item) { return item.id !== id; }); await addOneGallery(photo.sourceFile); }
  async function removePhoto(id) { var photo = state.media.gallery.find(function (item) { return item.id === id; }); state.media.gallery = state.media.gallery.filter(function (item) { return item.id !== id; }); if (photo) window.BirthdayPhotoManager.revoke(photo); normalizeFeatured(); renderUploads(); afterChange(); if (photo && photo.storageRecord) try { await window.BirthdayCloudOrders.deleteFile(photo.storageRecord); } catch (_) { showToast("\u7167\u7247\u5df2\u4ece\u9875\u9762\u79fb\u9664\uff0c\u4f46\u4e91\u7aef\u5220\u9664\u9700\u8981\u91cd\u8bd5\u3002"); } }
  async function useAsCover(id) { var photo = state.media.gallery.find(function (item) { return item.id === id; }); if (!photo || photo.status !== "complete") return; try { var file = photo.file || photo.sourceFile; if (!file && photo.previewUrl) { var response = await fetch(photo.previewUrl); var blob = await response.blob(); file = new File([blob], photo.originalName || "cover.jpg", { type: blob.type || "image/jpeg" }); } if (!file) throw new Error("\u8bf7\u91cd\u65b0\u9009\u62e9\u8fd9\u5f20\u7167\u7247\u3002"); await addCover(file); } catch (error) { showToast(error.message || "\u6682\u65f6\u65e0\u6cd5\u8bbe\u4e3a\u5c01\u9762\u3002"); } }
  function movePhoto(id, direction) { var from = state.media.gallery.findIndex(function (item) { return item.id === id; }); if (from < 0 || state.media.gallery[from].status !== "complete") return; var to = from + direction; if (from < 0 || to < 0 || to >= state.media.gallery.length) return; var next = state.media.gallery.slice(); next.splice(to, 0, next.splice(from, 1)[0]); state.media.gallery = next; normalizeFeatured(); renderUploads(); syncPhotoMeta(); afterChange(); }
  function toggleFeatured(id) { var photo = state.media.gallery.find(function (item) { return item.id === id; }); if (!photo || photo.status !== "complete") return; if (!photo.isFeatured && completeGalleryPhotos().filter(function (item) { return item.isFeatured; }).length >= 8) return showToast("\u91cd\u70b9\u56de\u5fc6\u6700\u591a\u9009\u62e9 8 \u5f20\u3002"); photo.isFeatured = !photo.isFeatured; normalizeFeatured(); renderUploads(); void savePhotoMeta(photo, state.media.gallery.indexOf(photo)); afterChange(); }
  function normalizeFeatured() { var completed = completeGalleryPhotos(); var selected = completed.filter(function (item) { return item.isFeatured; }); if (!selected.length) completed.slice(0, 8).forEach(function (item) { item.isFeatured = true; }); state.media.gallery.forEach(function (item) { if (item.status !== "complete") { item.isFeatured = false; item.featuredSortOrder = null; return; } item.featuredSortOrder = item.isFeatured ? completed.filter(function (candidate) { return candidate.isFeatured; }).indexOf(item) + 1 : null; if (item.featuredSortOrder > 8) { item.isFeatured = false; item.featuredSortOrder = null; } }); }
  function photoMeta(photo, index) { return { originalName: photo.originalName, width: photo.width, height: photo.height, sortOrder: index + 1, isFeatured: photo.isFeatured, featuredSortOrder: photo.featuredSortOrder, focalX: photo.focalX, focalY: photo.focalY, cropData: photo.cropData || {} }; }
  async function savePhotoMeta(photo, index) { if (canEditOrder() && photo && photo.storageRecord) try { photo.storageRecord = await window.BirthdayCloudOrders.updateFileMetadata(photo.storageRecord.id, photoMeta(photo, index)); } catch (error) { console.warn("Photo metadata save failed.", error); } }
  function syncPhotoMeta() { state.media.gallery.forEach(function (photo, index) { void savePhotoMeta(photo, index); }); }

  function renderBlessingMode() { $$("[data-blessing-mode]").forEach(function (button) { button.classList.toggle("active", button.dataset.blessingMode === state.content.blessingMode); }); $$("[data-blessing-panel]").forEach(function (panel) { panel.classList.toggle("active", panel.dataset.blessingPanel === state.content.blessingMode); }); }
  function generateInspiration() { syncFromForm(); renderCandidates("#blessingCandidates", window.BirthdayBlessingHelper.generate({ name: state.recipient.recipientName, relationship: state.recipient.relationshipType, facts: state.content.inspirationFacts, tone: state.content.inspirationTone })); }
  function generatePolish() { syncFromForm(); var candidates = window.BirthdayBlessingHelper.polish({ name: state.recipient.recipientName, text: state.content.polishSource }); if (!candidates.length) return showToast("\u5148\u653e\u8fdb\u4e00\u53e5\u4f60\u539f\u672c\u60f3\u8bf4\u7684\u8bdd\u5427\u3002"); renderCandidates("#polishCandidates", candidates); }
  function renderCandidates(selector, candidates) { $(selector).innerHTML = candidates.map(function (item) { return '<article class="blessing-candidate"><div><strong>' + e(item.headline) + '</strong><span>' + e(item.message) + '</span></div><button type="button" data-candidate-headline="' + e(item.headline) + '" data-candidate-message="' + e(item.message) + '">\u7528\u8fd9\u53e5</button></article>'; }).join(""); }
  function applyCandidate(event) { var button = event.target.closest("[data-candidate-headline]"); if (!button) return; state.content.headline = button.dataset.candidateHeadline; state.content.longMessage = button.dataset.candidateMessage; $("[name=\"headline\"]").value = state.content.headline; $("[name=\"longMessage\"]").value = state.content.longMessage; updateCounter(); afterChange(); showToast("\u8fd9\u4efd\u7075\u611f\u5df2\u7ecf\u653e\u8fdb\u795d\u798f\u91cc\u4e86\u3002"); }

  function renderModules() {
    var plan = currentPlan();
    var upgrade = plan.code === "upgrade_288";
    $("#moduleIntro").textContent = upgrade
      ? "以下功能已包含在惊喜升级款中，可按需要开启，不会额外收费。"
      : "基础心意款已经包含回忆相册、公开祝福墙与生日倒计时。";
    var optionalCodes = upgrade ? (plan.optionalModulePool || []) : [];
    var displayCodes = fixedModules.concat(optionalCodes);
    $("#moduleGrid").innerHTML = displayCodes.map(function (code) {
      var definition = modules[code] || { name: code, short: "" };
      var required = fixedModules.includes(code);
      var enabled = required || state.activeModules.includes(code);
      return '<article class="module-card ' + (required ? "required " : "") + (enabled ? "enabled" : "") + '">' +
        '<span class="included-tag">' + (required ? "本套餐已包含" : "可按需开启") + '</span>' +
        '<h3>' + e(definition.name) + '</h3><p>' + e(definition.short) + '</p>' +
        (required
          ? '<button type="button" disabled>本套餐已包含</button>'
          : '<button type="button" data-module-toggle="' + code + '">' + (enabled ? "关闭功能" : "开启功能") + '</button>') +
        '</article>';
    }).join("") + (upgrade ? "" : '<div class="module-static-note">想再为 TA 藏几份惊喜？惊喜升级款已包含许愿瓶、未来信箱、今日好运、惊喜盲盒与背景音乐；这份订单的套餐由商家锁定，如需调整请联系商家。</div>');

    var enabledCodes = fixedModules.concat(state.activeModules.filter(function (code) {
      return optionalCodes.includes(code);
    }));
    $("#moduleFields").innerHTML = moduleFields(enabledCodes);
  }

  var moduleRenderers = {
    gallery: renderGallerySummary,
    messageWall: renderPublicMessageWallIntro,
    countdown: renderCountdownSummary,
    wishBottle: renderWishBottleFields,
    futureMailbox: renderFutureMailboxFields,
    dailyLuck: renderDailyLuckConfig,
    surpriseBox: renderSurpriseBoxFields,
    bgm: renderBgmFields
  };

  function moduleFields(codes) {
    return codes.map(function (code) {
      var renderer = moduleRenderers[code];
      if (!renderer) throw new Error("未配置模块填写区：" + code);
      return renderer();
    }).join("");
  }

  function renderGallerySummary() {
    return '<section class="module-config"><div class="module-config-head"><h3>回忆相册</h3><p>照片已经在第 3 步整理完成。生日页会先展示最多 8 张重点回忆，其余照片可以在同一区域继续翻看。</p></div></section>';
  }

  function renderPublicMessageWallIntro() {
    return '<section class="module-config"><div class="module-config-head"><h3>祝福墙</h3><p>生日页发布后，所有拿到专属链接的访客都可以查看并匿名留下祝福；新留言会即时展示。</p></div><div class="module-static-note">这里不需要提前代写留言。我们会在生日页提供一个温柔、公开且受限流保护的留言入口。</div></section>';
  }

  function renderCountdownSummary() {
    return '<section class="module-config"><div class="module-config-head"><h3>生日倒计时</h3><p>系统会根据 TA 的生日自动显示“距离下一次生日还有多久”，不需要额外填写。</p></div></section>';
  }

  function renderWishBottleFields() {
    return '<section class="module-config"><div class="module-config-head"><h3>许愿瓶</h3><p>留下一句想陪 TA 实现的小心愿。</p></div><label class="field">瓶子标题<input name="wishBottleTitle" maxlength="40" value="' + e(state.modules.wishBottle.title || "") + '"></label><label class="field">想说的话<textarea name="wishBottlePrompt" maxlength="180">' + e(state.modules.wishBottle.prompt || "") + '</textarea></label></section>';
  }

  function renderFutureMailboxFields() {
    return '<section class="module-config"><div class="module-config-head"><h3>未来信箱</h3><p>在你设定的那天，TA 才能打开这封信。</p></div><label class="field">打开日期<input name="futureOpenDate" type="date" value="' + e(state.modules.futureMailbox.openDate || "") + '"></label><label class="field">写给未来的 TA<textarea name="futureMessage" maxlength="500">' + e(state.modules.futureMailbox.content || "") + '</textarea></label></section>';
  }

  function renderSurpriseBoxFields() {
    return '<section class="module-config"><div class="module-config-head"><h3>惊喜盲盒</h3><p>选择打开盲盒时出现的惊喜。TA 点击后，页面会短暂进入专属沉浸场景。</p></div><div class="imagery-grid">' +
      imagery.map(function (item) {
        return '<button type="button" class="imagery-card ' + (state.modules.surpriseBox.imageryCode === item.id ? "selected" : "") + '" data-imagery-code="' + item.id + '"><img src="' + e(item.preview) + '" loading="lazy" alt="' + e(item.name) + '"><span>' + e(item.name) + '</span><small>' + e(item.short) + '</small></button>';
      }).join("") +
      '</div><label class="field">盲盒标题<input name="surpriseTitle" maxlength="40" value="' + e(state.modules.surpriseBox.surpriseTitle || "") + '"></label><label class="field">盲盒里的话<textarea name="surpriseMessage" maxlength="240">' + e(state.modules.surpriseBox.surpriseMessage || "") + '</textarea></label><label class="field">署名 <span class="field-hint">可选</span><input name="surpriseSignature" maxlength="30" value="' + e(state.modules.surpriseBox.signature || "") + '"></label></section>';
  }

  function renderDailyLuckConfig() {
    return '<section class="module-config"><div class="module-config-head"><h3>今日好运</h3><p>生日页会按当天日期和 TA 的星座，读取真实星座运势与老黄历宜忌。</p></div><div class="module-static-note">不需要填写占位内容。若当天服务暂时不可用，生日页会清楚说明，不会编造运势。</div></section>';
  }

  function renderBgmFields() {
    return '<section class="module-config"><div class="module-config-head"><h3>背景音乐</h3><p>生日页会使用固定的温柔配乐，不需要额外填写歌曲或上传文件。</p></div><div class="module-static-note">为兼容手机浏览器，音乐会在访客第一次触摸或点击页面后开始播放。</div></section>';
  }

  function toggleModule(code) {
    if (!(currentPlan().optionalModulePool || []).includes(code)) return;
    state.activeModules = state.activeModules.includes(code)
      ? state.activeModules.filter(function (item) { return item !== code; })
      : state.activeModules.concat(code);
    renderModules();
    afterChange();
  }
  function renderReview() {
    var plan = currentPlan(); var modulesText = fixedModules.concat(state.activeModules).map(function (code) { return modules[code] && modules[code].name || code; }).join("\u3001");
    var rows = [["\u8ba2\u5355", state.orderNumber || "\u7b49\u5f85\u6b63\u5f0f\u8ba2\u5355"], ["\u5957\u9910", (state.lockedPlanName || plan.name) + " \u00b7 \u00a5" + (state.lockedPlanPrice || plan.priceCny)], ["\u9875\u9762\u6a21\u677f", state.templateId || "\u8fd8\u672a\u9009\u62e9"], ["\u5bff\u661f", state.recipient.recipientName || "\u8fd8\u672a\u586b\u5199"], ["\u751f\u65e5", state.recipient.birthday || "\u8fd8\u672a\u586b\u5199"], ["\u7167\u7247", (state.media.cover && state.media.cover.status === "complete" ? "\u5c01\u9762\u5df2\u4e0a\u4f20" : "\u8fd8\u672a\u4e0a\u4f20\u5c01\u9762") + "\uff1b\u76f8\u518c " + completeGalleryPhotos().length + " / " + plan.galleryLimit], ["\u5df2\u5f00\u542f\u529f\u80fd", modulesText], ["\u8bbf\u95ee\u65b9\u5f0f", "\u4ec5\u901a\u8fc7\u4e13\u5c5e\u94fe\u63a5\u8bbf\u95ee\uff0c\u4e0d\u516c\u5f00\u641c\u7d22\u7d22\u5f15"]];
    $("#reviewSummary").innerHTML = rows.map(function (row) { return '<article class="review-item"><span>' + row[0] + '</span><strong>' + e(row[1]) + '</strong></article>'; }).join("");
    var notices = []; if (!canEditOrder()) notices.push("\u8bf7\u4f7f\u7528\u5546\u5bb6\u53d1\u9001\u7684\u4e13\u5c5e\u8ba2\u5355\u94fe\u63a5\uff0c\u624d\u80fd\u5b89\u5168\u63d0\u4ea4\u8d44\u6599\u3002"); if (!state.media.cover || state.media.cover.status !== "complete") notices.push("\u8fd8\u9700\u8981\u4e00\u5f20\u5c01\u9762\u56fe\u3002"); if (!completeGalleryPhotos().length) notices.push("\u8fd8\u9700\u8981\u81f3\u5c11\u4e00\u5f20\u56de\u5fc6\u7167\u7247\u3002"); if (!state.privacy.privacyConfirmed) notices.push("\u63d0\u4ea4\u524d\u8bf7\u8ba4\u771f\u9605\u8bfb\u5e76\u4e3b\u52a8\u786e\u8ba4\u6388\u6743\u8bf4\u660e\u3002");
    $("#reviewNotices").innerHTML = notices.map(function (notice) { return '<div class="notice">' + e(notice) + '</div>'; }).join("");
  }

  function setStep(step, skipHistory) { state.currentStep = Math.min(6, Math.max(1, Number(step) || 1)); $$(".step-card").forEach(function (card) { card.classList.toggle("active", Number(card.dataset.step) === state.currentStep); }); if (state.currentStep === 3) renderUploads(); if (state.currentStep === 5) renderModules(); if (state.currentStep === 6) renderReview(); $("#prevStep").disabled = state.currentStep === 1; $("#nextStep").textContent = state.currentStep === 6 ? "\u524d\u5f80\u786e\u8ba4\u63d0\u4ea4" : "\u7ee7\u7eed"; renderProgress(); persistLocal(); if (!skipHistory) history.pushState({ step: state.currentStep }, "", "#step-" + state.currentStep); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function renderProgress() { var values = [Boolean(state.templateId && state.order.contactValue), Boolean(state.recipient.recipientName && state.recipient.birthday && state.recipient.relationshipType), Boolean(state.media.cover && state.media.cover.status === "complete" && state.media.gallery.some(function (item) { return item.status === "complete"; })), Boolean(state.content.headline), true, Boolean(state.privacy.privacyConfirmed)]; var percent = Math.round(values.filter(Boolean).length / 6 * 100); $("#completionPercent").textContent = percent + "%"; $("#completionBar").style.width = percent + "%"; $("#stepPills").innerHTML = [1,2,3,4,5,6].map(function (step) { var classes = ["step-pill"]; if (step === state.currentStep) classes.push("active"); else if (state.completedSteps.has(step)) classes.push("done"); else if (step > state.currentStep) classes.push("locked"); return '<button type="button" class="' + classes.join(" ") + '" data-step-target="' + step + '">' + step + '</button>'; }).join(""); }
  function renderSaveStatus(message) { $("#saveStatus").textContent = message || (state.mode === "cloud" ? "已连接安全保存" : "等待安全订单链接"); }

  async function nextStep() { if (!await validateStep(state.currentStep, true)) return; state.completedSteps.add(state.currentStep); if (state.currentStep < 6) setStep(state.currentStep + 1); else await submitOrder(); }
  async function validateStep(step, focus) {
    clearErrors(); syncFromForm(); var plan = currentPlan(); var first = ""; var add = function (key, message) { if (!first) first = key; setError(key, message); };
    if (step === 1) { if (!canEditOrder()) add("contactValue", "\u8bf7\u901a\u8fc7\u5546\u5bb6\u53d1\u9001\u7684\u4e13\u5c5e\u94fe\u63a5\u586b\u5199\u6b63\u5f0f\u8ba2\u5355\u3002"); if (!text(state.order.contactValue)) add("contactValue", "\u8bf7\u7559\u4e0b\u63a5\u6536\u5236\u4f5c\u901a\u77e5\u7684\u8054\u7cfb\u65b9\u5f0f\u3002"); else if (!validContact(state.order.contactMethod, state.order.contactValue)) add("contactValue", "\u8fd9\u9879\u8054\u7cfb\u65b9\u5f0f\u770b\u8d77\u6765\u4e0d\u592a\u5b8c\u6574\uff0c\u8bf7\u68c0\u67e5\u540e\u518d\u8bd5\u3002"); if (!state.templateId) add("templateId", "\u8bf7\u5148\u9009\u62e9\u4e00\u5957\u9875\u9762\u6a21\u677f\u3002"); }
    if (step === 2) { if (!text(state.recipient.recipientName)) add("recipientName", "\u8bf7\u586b\u5199 TA \u7684\u6635\u79f0\u3002"); if (!validDate(state.recipient.birthday)) add("birthday", "\u8bf7\u586b\u5199\u6709\u6548\u7684\u751f\u65e5\u65e5\u671f\u3002"); if (!text(state.recipient.relationshipType)) add("relationshipType", "\u8bf7\u544a\u8bc9\u6211\u4eec\u4f60\u4eec\u7684\u5173\u7cfb\u3002"); if (!state.sender.senderAnonymous && !text(state.sender.senderName)) add("senderName", "\u4e0d\u533f\u540d\u65f6\uff0c\u8bf7\u7559\u4e0b\u9001\u793c\u4eba\u7684\u6635\u79f0\u3002"); }
    if (step === 3) { if (!state.media.cover || state.media.cover.status !== "complete") add("cover", "\u8bf7\u5148\u5b8c\u6210\u5c01\u9762\u56fe\u4e0a\u4f20\u3002"); var complete = completeGalleryPhotos(); if (!complete.length) add("gallery", "\u8bf7\u81f3\u5c11\u4e0a\u4f20 1 \u5f20\u56de\u5fc6\u7167\u7247\u3002"); if (complete.length > plan.galleryLimit) add("gallery", "\u5f53\u524d\u8ba2\u5355\u6700\u591a " + plan.galleryLimit + " \u5f20\u56de\u5fc6\u7167\u7247\u3002"); if (state.media.gallery.some(function (photo) { return ["processing","uploading"].includes(photo.status); })) add("gallery", "\u8bf7\u7b49\u5f85\u6240\u6709\u6b63\u5728\u5904\u7406\u7684\u7167\u7247\u5b8c\u6210\u3002"); }
    if (step === 4) { if (!text(state.content.headline)) add("headline", "\u9996\u9875\u4e3b\u795d\u798f\u662f\u8fd9\u4efd\u793c\u7269\u7684\u5f00\u573a\uff0c\u8bf7\u5199\u4e0b\u4e00\u53e5\u3002"); else if (Array.from(state.content.headline).length > 15) add("headline", "\u9996\u9875\u4e3b\u795d\u798f\u4e0d\u80fd\u8d85\u8fc7 15 \u4e2a\u5b57\u3002"); else if (/[<>]/.test(state.content.headline)) add("headline", "\u4e3b\u795d\u798f\u91cc\u4e0d\u80fd\u5305\u542b\u7279\u6b8a\u6807\u7b7e\u7b26\u53f7\u3002"); }
    if (step === 5) { if (state.activeModules.includes("surpriseBox")) { if (!state.modules.surpriseBox.imageryCode) add("modules", "\u60ca\u559c\u76f2\u76d2\u9700\u8981\u9009\u62e9\u4e00\u79cd\u610f\u8c61\u3002"); if (!text(state.modules.surpriseBox.surpriseMessage)) add("modules", "\u8bf7\u5199\u4e0b\u76f2\u76d2\u6253\u5f00\u65f6\u60f3\u8bf4\u7684\u4e00\u53e5\u8bdd\u3002"); } if (state.activeModules.includes("futureMailbox") && (!validDate(state.modules.futureMailbox.openDate) || !text(state.modules.futureMailbox.content))) add("modules", "\u672a\u6765\u4fe1\u7bb1\u9700\u8981\u6253\u5f00\u65e5\u671f\u548c\u4e00\u5c01\u4fe1\u3002"); if (state.activeModules.includes("wishBottle") && !text(state.modules.wishBottle.prompt)) add("modules", "\u8bb8\u613f\u74f6\u91cc\u8fd8\u6ca1\u6709\u653e\u5165\u4e00\u53e5\u5fc3\u613f\u3002"); }
    if (step === 6 && !state.privacy.privacyConfirmed) add("privacyConfirmed", "\u8bf7\u4e3b\u52a8\u52fe\u9009\u5e76\u786e\u8ba4\u8fd9\u4efd\u6388\u6743\u8bf4\u660e\u3002");
    if (first && focus) focusError(first); return !first;
  }
  async function submitOrder() {
    for (var step = 1; step <= 6; step += 1) { if (!await validateStep(step, false)) { setStep(step); focusError(firstError()); return; } state.completedSteps.add(step); }
    if (!canEditOrder()) return showToast("\u8bf7\u4f7f\u7528\u5546\u5bb6\u53d1\u9001\u7684\u4e13\u5c5e\u8ba2\u5355\u94fe\u63a5\u63d0\u4ea4\u6b63\u5f0f\u8d44\u6599\u3002");
    try { $("#submitOrder").disabled = true; $("#submitOrder").textContent = "\u6b63\u5728\u5b89\u5168\u63d0\u4ea4\u2026"; await window.BirthdayCloudOrders.saveDraft(state.orderId, snapshot()); var result = await window.BirthdayCloudOrders.submitOrder(state.orderId); state.orderStatus = result.order && result.order.status || "submitted"; $("#submitSuccess").hidden = false; $("#submitSuccess").innerHTML = '<strong>\u8d44\u6599\u5df2\u7ecf\u5b89\u5168\u63d0\u4ea4\u3002</strong><span>\u8ba2\u5355\u53f7\uff1a' + e(state.orderNumber) + '。\u5546\u5bb6\u4f1a\u5728 24 \u5c0f\u65f6\u5185\u68c0\u67e5\u7167\u7247\u548c\u5185\u5bb9\uff1b\u5982\u9700\u8865\u5145\uff0c\u4f1a\u901a\u8fc7\u4f60\u7559\u4e0b\u7684\u8054\u7cfb\u65b9\u5f0f\u8054\u7cfb\u3002</span>'; $("#nextStep").disabled = true; $("#prevStep").disabled = true; $("#submitOrder").textContent = "\u5df2\u63d0\u4ea4"; renderBanner(); renderReview(); showToast("\u63d0\u4ea4\u6210\u529f\uff0c\u8c22\u8c22\u4f60\u8ba4\u771f\u5b8c\u6210\u8fd9\u4efd\u793c\u7269\u3002"); } catch (error) { console.error("Submission failed:", error); $("#submitOrder").disabled = false; $("#submitOrder").textContent = "\u786e\u8ba4\u63d0\u4ea4\u5236\u4f5c\u8d44\u6599"; showToast("\u63d0\u4ea4\u5931\u8d25\uff1a" + (error.message || "\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002")); }
  }

  function validContact(type, value) { var source = text(value); if (type === "phone") return /^1\d{10}$/.test(source.replace(/[\s-]/g, "")); if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source); return source.length >= 2; }
  function validDate(value) { return Boolean(value) && !Number.isNaN(new Date(value + "T12:00:00").getTime()); }
  function channelName(value) { return ({ taobao: "\u6dd8\u5b9d", xianyu: "\u95f2\u9c7c", wechat: "\u5fae\u4fe1", xiaohongshu: "\u5c0f\u7ea2\u4e66", manual: "\u5546\u5bb6\u521b\u5efa" })[value] || "\u5546\u5bb6\u521b\u5efa"; }
  function syncConditional() { $$("[data-show-when]").forEach(function (field) { var pair = field.dataset.showWhen.split(":"); field.classList.toggle("hidden", pair[0] === "relationshipType" && state.recipient.relationshipType !== pair[1]); }); }
  function updateCounter() { $("#headlineCounter").textContent = Array.from(state.content.headline || "").length + " / 15"; }
  function clearErrors() { $$(".field-error").forEach(function (item) { item.textContent = ""; }); $$(".field.invalid").forEach(function (item) { item.classList.remove("invalid"); }); }
  function setError(key, message) { var error = $('[data-error-for="' + key + '"]'); if (error) error.textContent = message; var input = $('[name="' + key + '"]'); if (input && input.closest(".field")) input.closest(".field").classList.add("invalid"); }
  function firstError() { var item = $$(".field-error").find(function (element) { return element.textContent; }); return item && item.dataset.errorFor || ""; }
  function focusError(key) { var node = $('[name="' + key + '"]') || $('[data-error-for="' + key + '"]'); if (!node) return; node.scrollIntoView({ behavior: "smooth", block: "center" }); if (node.focus) setTimeout(function () { node.focus(); }, 240); }
  function showToast(message) { $("#toast").textContent = message; $("#toast").classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { $("#toast").classList.remove("show"); }, 4200); }

  init();
})();
