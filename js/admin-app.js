(function () {
  "use strict";

  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
  var orders = [];
  var selectedOrderId = "";
  var activeUser = null;
  var selectedRecord = null;

  function client() {
    var value = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
    if (!value) throw new Error("Supabase \u8fd8\u6ca1\u6709\u914d\u7f6e\u5b8c\u6574\u3002");
    return value;
  }

  function escapeHtml(value) {
    var element = document.createElement("div");
    element.textContent = String(value == null ? "" : value);
    return element.innerHTML;
  }

  function statusName(status) {
    return ({ created: "\u5f85\u9886\u53d6", claimed: "\u5f85\u586b\u5199", draft: "\u586b\u5199\u4e2d", submitted: "\u5df2\u63d0\u4ea4", reviewing: "\u5ba1\u6838\u4e2d", needs_revision: "\u9700\u4fee\u6539", approved: "\u5df2\u6279\u51c6", generating: "\u751f\u6210\u4e2d", published: "\u5df2\u53d1\u5e03", cancelled: "\u5df2\u53d6\u6d88", archived: "\u5df2\u5f52\u6863" })[status] || status;
  }

  async function init() {
    if (!window.BirthdaySupabase || !window.BirthdaySupabase.isEnabled || !window.BirthdaySupabase.isEnabled()) {
      $("#loginError").textContent = "Supabase \u8fd8\u6ca1\u6709\u914d\u7f6e\u5b8c\u6574\uff0c\u8bf7\u5148\u5728 config/supabase.js \u586b\u5165 Project URL \u548c Publishable Key\u3002";
      return;
    }
    bindEvents();
    var result = await client().auth.getSession();
    if (result.data && result.data.session) await openWorkspace(result.data.session.user);
  }

  function bindEvents() {
    $("#adminLoginForm").addEventListener("submit", function (event) { event.preventDefault(); void signIn(event.currentTarget); });
    $("#adminSignOut").addEventListener("click", function () { void signOut(); });
    $("#createOrderForm").addEventListener("submit", function (event) { event.preventDefault(); void createOrder(event.currentTarget); });
    $("#refreshOrders").addEventListener("click", function () { void loadOrders(); });
    $("#orderSearch").addEventListener("input", renderOrders);
    $("#statusFilter").addEventListener("change", renderOrders);
    $("#ordersTable").addEventListener("click", function (event) {
      var row = event.target.closest("[data-order-id]");
      if (row) void selectOrder(row.dataset.orderId);
    });
    $("#claimResult").addEventListener("click", function (event) {
      if (!event.target.closest(".copy-claim")) return;
      var input = $(".claim-url", $("#claimResult"));
      if (!input) return;
      void navigator.clipboard.writeText(input.value).then(function () { event.target.textContent = "\u5df2\u590d\u5236"; setTimeout(function () { event.target.textContent = "\u590d\u5236\u94fe\u63a5"; }, 1300); }).catch(function () { input.select(); document.execCommand("copy"); });
    });
    $("#orderDetail").addEventListener("click", function (event) {
      var status = event.target.closest("[data-status]");
      if (status) return void changeStatus(status.dataset.status);
      var publish = event.target.closest("[data-publish]");
      if (publish) return void publishSelected();
      var copy = event.target.closest("[data-copy-page]");
      if (copy) return copyPublishedUrl(copy.dataset.copyPage);
      if (event.target.closest("[data-copy-config]")) return copyBirthdayPageConfig();
      if (event.target.closest("[data-download-order]")) return downloadOrderJson();
      var wallAction = event.target.closest("[data-wall-status]");
      if (wallAction) return void moderateWallMessage(wallAction.dataset.wallMessageId, wallAction.dataset.wallStatus);
    });
  }

  async function signIn(form) {
    var button = $("button[type=submit]", form);
    $("#loginError").textContent = "";
    button.disabled = true;
    try {
      var data = new FormData(form);
      var result = await client().auth.signInWithPassword({ email: String(data.get("email") || "").trim(), password: String(data.get("password") || "") });
      if (result.error) throw result.error;
      await openWorkspace(result.data.user);
    } catch (error) {
      $("#loginError").textContent = error.message || "\u65e0\u6cd5\u767b\u5f55\uff0c\u8bf7\u68c0\u67e5\u90ae\u7bb1\u3001\u5bc6\u7801\u548c\u5546\u5bb6\u6743\u9650\u3002";
    } finally { button.disabled = false; }
  }

  async function openWorkspace(user) {
    var admin = await client().from("admin_users").select("user_id, role").eq("user_id", user.id).maybeSingle();
    if (admin.error) throw admin.error;
    if (!admin.data) {
      await client().auth.signOut();
      $("#loginError").textContent = "\u8fd9\u4e2a\u8d26\u53f7\u6ca1\u6709\u5546\u5bb6\u540e\u53f0\u6743\u9650\u3002\u8bf7\u5148\u5728 Supabase \u7684 admin_users \u8868\u4e3a\u8be5 UID \u6dfb\u52a0\u6743\u9650\u3002";
      return;
    }
    activeUser = user;
    $("#adminLogin").hidden = true;
    $("#adminWorkspace").hidden = false;
    $("#adminIdentity").textContent = (user.email || "\u5df2\u767b\u5f55\u5546\u5bb6") + " \u00b7 " + (admin.data.role || "admin");
    await loadOrders();
  }

  async function signOut() {
    await client().auth.signOut();
    activeUser = null; orders = []; selectedOrderId = "";
    $("#adminWorkspace").hidden = true;
    $("#adminLogin").hidden = false;
    $("#adminLoginForm").reset();
  }

  async function createOrder(form) {
    var button = $("button[type=submit]", form); button.disabled = true; button.textContent = "\u6b63\u5728\u521b\u5efa\u2026";
    try {
      var data = new FormData(form);
      var result = await window.BirthdayCloudOrders.createOrder({
        planCode: data.get("planCode"),
        purchaseChannel: data.get("purchaseChannel"),
        externalOrderNumber: String(data.get("externalOrderNumber") || "").trim() || null
      });
      var baseUrl = window.location.href.replace(/admin\.html(?:\?.*)?$/, "index.html");
      var url = baseUrl + result.claimUrlQuery;
      var fragment = $("#claimTemplate").content.cloneNode(true);
      $(".claim-order-number", fragment).textContent = result.order.order_number;
      $(".claim-url", fragment).value = url;
      var target = $("#claimResult"); target.hidden = false; target.innerHTML = ""; target.appendChild(fragment);
      form.reset();
      await loadOrders();
    } catch (error) {
      window.alert("\u521b\u5efa\u8ba2\u5355\u5931\u8d25\uff1a" + (error.message || "\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"));
    } finally { button.disabled = false; button.textContent = "\u521b\u5efa\u9886\u53d6\u94fe\u63a5"; }
  }

  async function loadOrders() {
    $("#ordersState").textContent = "\u6b63\u5728\u8bfb\u53d6\u5236\u4f5c\u961f\u5217\u2026";
    try {
      orders = await window.BirthdayCloudOrders.listAdminOrders();
      $("#ordersState").textContent = orders.length ? "\u5171 " + orders.length + " \u4efd\u8ba2\u5355" : "\u8fd8\u6ca1\u6709\u8ba2\u5355\u3002";
      renderOrders();
      if (selectedOrderId && orders.some(function (order) { return order.id === selectedOrderId; })) await selectOrder(selectedOrderId, true);
    } catch (error) {
      $("#ordersState").textContent = "\u65e0\u6cd5\u8bfb\u53d6\u8ba2\u5355\uff1a" + (error.message || "\u8bf7\u68c0\u67e5\u5546\u5bb6\u6743\u9650\u3002");
      $("#ordersTable").innerHTML = "";
    }
  }

  function filteredOrders() {
    var search = String($("#orderSearch").value || "").trim().toLowerCase();
    var filter = $("#statusFilter").value;
    return orders.filter(function (order) {
      if (filter !== "all" && order.status !== filter) return false;
      if (!search) return true;
      return [order.order_number, order.recipient_name, order.sender_name, order.external_order_number, order.contact_value].join(" ").toLowerCase().includes(search);
    });
  }

  function renderOrders() {
    var result = filteredOrders();
    $("#ordersTable").innerHTML = result.map(function (order) {
      var plan = order.plans || {}; var template = order.templates || {};
      var active = order.id === selectedOrderId ? " active" : "";
      return '<button type="button" role="listitem" class="order-row' + active + '" data-order-id="' + escapeHtml(order.id) + '"><div><strong>' + escapeHtml(order.order_number) + '</strong><small>' + escapeHtml(order.recipient_name || "\u8fd8\u672a\u586b\u5bff\u661f") + ' \u00b7 ' + escapeHtml(plan.name || "\u672a\u77e5\u5957\u9910") + '</small><small>' + escapeHtml(template.code || "\u672a\u9009\u6a21\u677f") + ' \u00b7 ' + formatDate(order.created_at) + '</small></div><span class="status-chip">' + statusName(order.status) + '</span></button>';
    }).join("") || '<div class="empty-detail"><strong>\u6ca1\u6709\u5339\u914d\u7684\u8ba2\u5355</strong><span>\u6362\u4e00\u4e2a\u641c\u7d22\u8bcd\u6216\u72b6\u6001\u7b5b\u9009\u8bd5\u8bd5\u3002</span></div>';
  }

  async function selectOrder(orderId, quiet) {
    selectedOrderId = orderId; renderOrders();
    $("#orderDetail").innerHTML = '<div class="empty-detail"><strong>\u6b63\u5728\u52a0\u8f7d\u8ba2\u5355\u8d44\u6599\u2026</strong></div>';
    try {
      var record = await window.BirthdayCloudOrders.loadOrder(orderId);
      renderDetail(record);
    } catch (error) {
      $("#orderDetail").innerHTML = '<div class="empty-detail"><strong>\u6682\u65f6\u65e0\u6cd5\u6253\u5f00\u8fd9\u4efd\u8ba2\u5355</strong><span>' + escapeHtml(error.message || "\u8bf7\u70b9\u51fb\u5237\u65b0\u540e\u91cd\u8bd5\u3002") + '</span></div>';
      if (!quiet) console.error(error);
    }
  }

  function relationshipName(value) {
    return ({ lover: "恋人", best_friend: "闺蜜 / 挚友", friend: "好朋友", classmate: "同学", family: "家人", other: "其他" })[value] || value || "还未填写";
  }

  function moduleName(row) {
    var name = row.configuration && row.configuration.displayName ||
      (window.BD_MODULES && window.BD_MODULES[row.module_code] && window.BD_MODULES[row.module_code].name) ||
      row.module_code;
    if (row.module_code === "surpriseBox" && row.configuration && row.configuration.imageryCode) {
      var image = (window.BD_IMAGERY || []).find(function (item) { return item.id === row.configuration.imageryCode; });
      if (image) name += " · " + image.name;
    }
    return name;
  }

  function renderDetail(record) {
    selectedRecord = record;
    var order = record.order || {};
    var content = record.content || {};
    var plan = record.plan || {};
    var template = record.template || {};
    var enabledModules = (record.modules || []).filter(function (item) { return item.enabled; });
    var files = record.files || [];
    var contact = order.contact_method ? order.contact_method + " · " + (order.contact_value || "") : "还未留下";
    var items = [
      ["套餐", plan.name || "未读取到套餐"],
      ["模板", template.code ? template.code + " · " + (template.name || "") : "还未选择"],
      ["寿星", order.recipient_name || "还未填写"],
      ["生日", order.recipient_birthday || "还未填写"],
      ["关系", relationshipName(order.relationship_type)],
      ["送礼人", order.sender_anonymous ? "匿名" : (order.sender_name || "还未填写")],
      ["联系方式", contact],
      ["客户状态", statusName(order.status)]
    ];
    var enabledNames = enabledModules.map(moduleName);
    var photos = files.map(function (file) {
      return file.previewUrl ? '<img src="' + escapeHtml(file.previewUrl) + '" alt="' + escapeHtml(file.original_filename || "订单照片") + '">' : "";
    }).join("");
    var statuses = ["reviewing", "needs_revision", "approved", "cancelled"].map(function (status) {
      return '<button type="button" class="detail-action" data-status="' + status + '">' + statusName(status) + '</button>';
    }).join("");
    $("#orderDetail").innerHTML =
      '<div class="detail-heading"><div><p class="eyebrow">ORDER DETAIL</p><h2>' + escapeHtml(order.order_number || "订单") + '</h2><p>' + statusName(order.status) + ' · 提交于 ' + formatDate(order.submitted_at || order.created_at) + '</p></div><span class="status-chip">' + statusName(order.status) + '</span></div>' +
      '<section class="detail-section"><h3>客户资料</h3><div class="detail-list">' + items.map(function (item) {
        return '<div class="detail-item"><span>' + item[0] + '</span><strong>' + escapeHtml(item[1]) + '</strong></div>';
      }).join("") + '</div></section>' +
      '<section class="detail-section"><h3>主祝福</h3><div class="detail-copy"><strong>' + escapeHtml(content.headline || "还未填写") + '</strong><br>' + escapeHtml(content.long_message || "客户没有保留长祝福。") + (content.signature ? '<br><br>From ' + escapeHtml(content.signature) : "") + '</div></section>' +
      '<section class="detail-section"><h3>已开启功能</h3><div class="detail-copy">' + escapeHtml(enabledNames.join("、") || "暂无") + '</div></section>' +
      '<section class="detail-section"><h3>客户照片 ( ' + files.length + ' )</h3><div class="detail-photos">' + (photos || "<span>还没有完成上传的照片。</span>") + '</div></section>' +
      '<section class="detail-section"><h3>公开祝福墙</h3><div id="wallModeration" class="wall-moderation"><span>正在读取公开留言…</span></div></section>' +
      '<section class="detail-section"><h3>制作操作</h3><div class="detail-actions">' + statuses +
        '<button type="button" class="detail-action" data-copy-config>复制 birthdayPageConfig</button>' +
        '<button type="button" class="detail-action" data-download-order>下载订单 JSON</button>' +
        '<button type="button" class="detail-action publish" data-publish>审核通过并发布</button>' +
        (order.published_url ? '<button type="button" class="detail-action" data-copy-page="' + escapeHtml(order.published_url) + '">复制生日页链接</button>' : "") +
      '</div><p id="detailResult" class="detail-result"></p></section>';
    void renderWallModeration(order.id);
  }

  async function renderWallModeration(orderId) {
    var target = $("#wallModeration");
    if (!target) return;
    try {
      var messages = await window.BirthdayCloudOrders.listBlessingWallMessages(orderId);
      target.innerHTML = messages.length ? messages.map(function (message) {
        var actions = message.status === "visible"
          ? '<button type="button" data-wall-status="hidden" data-wall-message-id="' + escapeHtml(message.id) + '">隐藏</button><button type="button" data-wall-status="deleted" data-wall-message-id="' + escapeHtml(message.id) + '">删除</button>'
          : '<button type="button" data-wall-status="visible" data-wall-message-id="' + escapeHtml(message.id) + '">恢复展示</button><button type="button" data-wall-status="deleted" data-wall-message-id="' + escapeHtml(message.id) + '">删除</button>';
        return '<article class="wall-moderation-card"><div><strong>' + escapeHtml(message.emoji || "✨") + " " + escapeHtml(message.nickname || "匿名朋友") + '</strong><span>' + escapeHtml(message.message || "") + '</span><small>' + formatDate(message.created_at) + " · " + escapeHtml(message.status) + '</small></div><div class="wall-moderation-actions">' + actions + '</div></article>';
      }).join("") : '<span>这份生日页还没有收到公开留言。</span>';
    } catch (error) {
      target.innerHTML = '<span>暂时无法读取祝福墙：' + escapeHtml(error.message || "请刷新后重试。") + '</span>';
    }
  }

  async function moderateWallMessage(messageId, status) {
    try {
      await window.BirthdayCloudOrders.moderateBlessingWallMessage(messageId, status);
      if (selectedRecord && selectedRecord.order) await renderWallModeration(selectedRecord.order.id);
      setDetailResult("祝福墙留言已更新。");
    } catch (error) {
      setDetailResult("留言处理失败：" + (error.message || "请稍后重试。"));
    }
  }

  function birthdayPageConfig(record) {
    var order = record.order || {};
    var content = record.content || {};
    var files = record.files || [];
    var modules = (record.modules || []).reduce(function (result, row) {
      result[row.module_code] = Object.assign({ enabled: Boolean(row.enabled) }, row.configuration || {});
      return result;
    }, {});
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      templateId: record.template && record.template.code || null,
      recipient: { name: order.recipient_name || "", birthday: order.recipient_birthday || "", showAge: Boolean(order.show_age) },
      sender: { name: order.sender_anonymous ? "" : (order.sender_name || ""), anonymous: Boolean(order.sender_anonymous) },
      relationship: order.relationship_type || "",
      content: { headline: content.headline || "", message: content.long_message || "", signature: content.signature || "" },
      photos: {
        cover: files.find(function (file) { return file.file_type === "cover"; }) || null,
        gallery: files.filter(function (file) { return file.file_type === "gallery"; })
      },
      modules: modules
    };
  }

  function copyBirthdayPageConfig() {
    if (!selectedRecord) return;
    copyText(JSON.stringify(birthdayPageConfig(selectedRecord), null, 2), "birthdayPageConfig 已复制。");
  }

  function downloadOrderJson() {
    if (!selectedRecord) return;
    var json = JSON.stringify(selectedRecord, null, 2);
    var url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    var link = document.createElement("a");
    link.href = url;
    link.download = (selectedRecord.order && selectedRecord.order.order_number || "birthday-order") + ".json";
    link.click();
    URL.revokeObjectURL(url);
    setDetailResult("订单 JSON 已开始下载。");
  }

  function copyText(value, successMessage) {
    void navigator.clipboard.writeText(value).then(function () {
      setDetailResult(successMessage);
    }).catch(function () {
      window.prompt("请复制以下内容", value);
    });
  }
  async function changeStatus(status) {
    if (!selectedOrderId) return;
    try { await window.BirthdayCloudOrders.updateOrderStatus(selectedOrderId, status); await loadOrders(); await selectOrder(selectedOrderId, true); setDetailResult("\u72b6\u6001\u5df2\u66f4\u65b0\u4e3a\uff1a" + statusName(status)); } catch (error) { setDetailResult("\u66f4\u65b0\u5931\u8d25\uff1a" + (error.message || "\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002")); }
  }

  async function publishSelected() {
    if (!selectedOrderId || !window.confirm("\u786e\u5b9a\u5df2\u68c0\u67e5\u8fd9\u4efd\u8ba2\u5355\u5417\uff1f\u53d1\u5e03\u540e\u4f1a\u751f\u6210\u4e13\u5c5e\u751f\u65e5\u9875\u94fe\u63a5\u3002")) return;
    try {
      var status = selectedRecord && selectedRecord.order && selectedRecord.order.status;
      if (status === "published") {
        setDetailResult("\u8fd9\u4efd\u8ba2\u5355\u5df2\u7ecf\u53d1\u5e03\uff0c\u5237\u65b0\u540e\u53ef\u590d\u5236\u751f\u65e5\u9875\u94fe\u63a5\u3002");
        return;
      }
      if (status !== "approved") {
        setDetailResult("\u6b63\u5728\u901a\u8fc7\u5ba1\u6838\u2026");
        await window.BirthdayCloudOrders.updateOrderStatus(selectedOrderId, "approved");
      }
      setDetailResult("\u5ba1\u6838\u5df2\u901a\u8fc7\uff0c\u6b63\u5728\u751f\u6210\u4e13\u5c5e\u751f\u65e5\u9875\u2026");
      var result = await window.BirthdayCloudOrders.publishOrder(selectedOrderId);
      setDetailResult("\u5df2\u53d1\u5e03\uff1a" + (result.publishedUrl || result.published_url || "\u8bf7\u5237\u65b0\u8ba2\u5355\u67e5\u770b"));
      await loadOrders(); await selectOrder(selectedOrderId, true);
    } catch (error) { setDetailResult("\u53d1\u5e03\u5931\u8d25\uff1a" + (error.message || "\u8bf7\u68c0\u67e5\u51fd\u6570\u90e8\u7f72\u548c\u5546\u5bb6\u6743\u9650\u3002")); }
  }
  function copyPublishedUrl(value) { void navigator.clipboard.writeText(value).then(function () { setDetailResult("\u751f\u65e5\u9875\u94fe\u63a5\u5df2\u590d\u5236\u3002"); }).catch(function () { window.prompt("\u8bf7\u590d\u5236\u8fd9\u4e2a\u94fe\u63a5", value); }); }
  function setDetailResult(message) { var target = $("#detailResult"); if (target) target.textContent = message; }
  function formatDate(value) { if (!value) return "\u2014"; var date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }); }

  init().catch(function (error) { console.error("Admin console initialization failed:", error); $("#loginError").textContent = "\u5546\u5bb6\u540e\u53f0\u521d\u59cb\u5316\u5931\u8d25\uff1a" + (error.message || "\u8bf7\u5237\u65b0\u91cd\u8bd5\u3002"); });
})();
