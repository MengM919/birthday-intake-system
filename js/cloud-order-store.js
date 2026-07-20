(function () {
  "use strict";

  function getClient() {
    var client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  }

  function errorMessage(error, fallback) {
    return error && error.message ? error.message : fallback;
  }

  async function functionErrorMessage(error, fallback) {
    var response = error && error.context;
    if (response && typeof response.clone === "function") {
      try {
        var data = await response.clone().json();
        if (data && data.error) return String(data.error);
        if (data && data.message) return String(data.message);
      } catch (ignore) {
        try {
          var text = await response.clone().text();
          if (text) return text;
        } catch (secondIgnore) {
          // Keep the Supabase error message as a safe fallback.
        }
      }
    }
    return errorMessage(error, fallback);
  }
  function allowedDraftStatus(status) {
    return ["claimed", "draft", "needs_revision"].includes(status);
  }

  function activeModules(snapshot) {
    var codes = Array.isArray(snapshot.activeModules) ? snapshot.activeModules : [];
    return Array.from(new Set(codes));
  }

  function moduleDisplayName(code) {
    return window.BD_MODULES && window.BD_MODULES[code] && window.BD_MODULES[code].name || code;
  }

  function configurationFor(code, snapshot) {
    var display = { displayName: moduleDisplayName(code) };
    if (code === "bgm") return Object.assign(display, { enabled: true, track: "the_walters_i_love_you_so" });
    if (code === "countdown") return Object.assign(display, { birthday: snapshot.recipient && snapshot.recipient.birthday || null });
    if (code === "surpriseBox") return Object.assign(display, {
      displayName: "\u60ca\u559c\u76f2\u76d2",
      sceneMode: "random_immersive",
      scenePoolVersion: "v1",
      revealStyle: "gift_box"
    });
    return Object.assign(display, (snapshot.modules && snapshot.modules[code]) || {});
  }
  async function claimOrder(orderNumber, token) {
    var client = getClient();
    var result = await client.functions.invoke("claim-order", { body: { orderNumber: orderNumber, token: token } });
    if (result.error) throw new Error(errorMessage(result.error, "\u65e0\u6cd5\u9886\u53d6\u8ba2\u5355\u3002"));
    if (!result.data || result.data.error) throw new Error((result.data && result.data.error) || "\u65e0\u6cd5\u9886\u53d6\u8ba2\u5355\u3002");
    return result.data;
  }

  async function createOrder(input) {
    var client = getClient();
    var result = await client.functions.invoke("create-order", { body: input });
    if (result.error) throw new Error(errorMessage(result.error, "\u65e0\u6cd5\u521b\u5efa\u8ba2\u5355\u3002"));
    if (!result.data || result.data.error) throw new Error((result.data && result.data.error) || "\u65e0\u6cd5\u521b\u5efa\u8ba2\u5355\u3002");
    return result.data;
  }

  async function submitOrder(orderId) {
    var client = getClient();
    var result = await client.functions.invoke("submit-order", { body: { orderId: orderId } });
    if (result.error) throw new Error(errorMessage(result.error, "\u65e0\u6cd5\u63d0\u4ea4\u8ba2\u5355\u3002"));
    if (!result.data || result.data.ok === false) {
      var notices = result.data && result.data.notices;
      throw new Error(Array.isArray(notices) ? notices.join("\n") : ((result.data && result.data.error) || "\u65e0\u6cd5\u63d0\u4ea4\u8ba2\u5355\u3002"));
    }
    return result.data;
  }

  async function loadOrder(orderId) {
    var client = getClient();
    var orderResult = await client.from("orders").select("*").eq("id", orderId).single();
    if (orderResult.error) throw orderResult.error;
    var order = orderResult.data;
    var results = await Promise.all([
      client.from("order_content").select("*").eq("order_id", orderId).maybeSingle(),
      client.from("order_modules").select("*").eq("order_id", orderId).order("sort_order"),
      client.from("order_files").select("*").eq("order_id", orderId).eq("status", "uploaded").order("sort_order"),
      client.from("plans").select("id, code, name, price, photo_limit, description").eq("id", order.plan_id).maybeSingle(),
      order.template_id ? client.from("templates").select("id, code, name, palette").eq("id", order.template_id).maybeSingle() : Promise.resolve({ data: null, error: null })
    ]);
    if (results.some(function (result) { return result.error; })) throw results.find(function (result) { return result.error; }).error;
    var files = await Promise.all((results[2].data || []).map(async function (file) {
      var previewUrl = "";
      try {
        previewUrl = await window.BirthdayStorage.getPrivateFileUrl(file.storage_path, 600, file.storage_bucket);
      } catch (error) {
        console.warn("Could not create a private preview URL.", error);
      }
      return Object.assign({}, file, { previewUrl: previewUrl });
    }));
    return { order: order, content: results[0].data || null, modules: results[1].data || [], files: files, plan: results[3].data || null, template: results[4].data || null };
  }

  async function templateIdFor(code) {
    if (!code) return null;
    var client = getClient();
    var result = await client.from("templates").select("id").eq("code", code).maybeSingle();
    if (result.error) throw result.error;
    return result.data ? result.data.id : null;
  }

  async function saveDraft(orderId, snapshot) {
    var client = getClient();
    var now = new Date().toISOString();
    var templateId = await templateIdFor(snapshot.templateId);
    var nextStatus = allowedDraftStatus(snapshot.orderStatus) ? "draft" : snapshot.orderStatus;
    var orderPayload = {
      template_id: templateId,
      recipient_name: snapshot.recipient.recipientName || null,
      recipient_birthday: snapshot.recipient.birthday || null,
      show_age: Boolean(snapshot.recipient.showAge),
      relationship_type: snapshot.recipient.relationshipType || null,
      sender_name: snapshot.sender.senderName || null,
      sender_anonymous: Boolean(snapshot.sender.senderAnonymous),
      contact_method: snapshot.order.contactMethod || null,
      contact_value: snapshot.order.contactValue || null,
      privacy_consent_at: snapshot.privacy.privacyConfirmed ? now : null,
      status: nextStatus
    };
    var orderResult = await client.from("orders").update(orderPayload).eq("id", orderId);
    if (orderResult.error) throw orderResult.error;

    var contentPayload = {
      order_id: orderId,
      headline: snapshot.content.headline || null,
      main_message: snapshot.content.headline || null,
      long_message: snapshot.content.longMessage || null,
      signature: snapshot.content.signature || null,
      music: { fixedTrack: "the_walters_i_love_you_so", enabled: activeModules(snapshot).includes("bgm") },
      access_mode: "unlisted",
      allow_share: true,
      allow_indexing: false,
      custom_data: {
        relationshipOther: snapshot.recipient.relationshipOther || "",
        blessingMode: snapshot.content.blessingMode || "write",
        inspirationFacts: snapshot.content.inspirationFacts || "",
        inspirationTone: snapshot.content.inspirationTone || "warm",
        polishSource: snapshot.content.polishSource || ""
      }
    };
    var contentResult = await client.from("order_content").upsert(contentPayload, { onConflict: "order_id" });
    if (contentResult.error) throw contentResult.error;

    var fixed = ["gallery", "messageWall", "countdown"];
    var allCodes = Array.from(new Set(fixed.concat(activeModules(snapshot), Object.keys(snapshot.modules || {}))));
    var moduleRows = allCodes.map(function (code, index) {
      return {
        order_id: orderId,
        module_code: code,
        enabled: fixed.includes(code) || activeModules(snapshot).includes(code),
        configuration: configurationFor(code, snapshot),
        sort_order: index + 1
      };
    });
    if (moduleRows.length) {
      var modulesResult = await client.from("order_modules").upsert(moduleRows, { onConflict: "order_id,module_code" });
      if (modulesResult.error) throw modulesResult.error;
    }
    return { savedAt: now };
  }

  async function uploadFile(orderId, fileType, file, metadata) {
    var client = getClient();
    var userResult = await client.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new Error("\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5\u3002");
    var user = userResult.data.user;
    var category = fileType === "cover" ? "cover" : "gallery";
    window.BirthdayStorage.validateFile(file, fileType === "cover" ? "cover" : "image");
    var bucket = window.BD_SUPABASE_CONFIG.privateBucket || "birthday-order-private";
    var storagePath = window.BirthdayStorage.makeStoragePath(orderId, user.id, category, file);
    var upload = await client.storage.from(bucket).upload(storagePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    var recordPayload = {
      order_id: orderId,
      uploaded_by: user.id,
      file_type: fileType,
      storage_bucket: bucket,
      storage_path: storagePath,
      original_filename: metadata.originalName || file.name,
      mime_type: file.type,
      size_bytes: file.size,
      width: metadata.width || null,
      height: metadata.height || null,
      sort_order: Number(metadata.sortOrder) || 0,
      is_featured: Boolean(metadata.isFeatured),
      featured_sort_order: metadata.featuredSortOrder || null,
      focal_x: Number.isFinite(metadata.focalX) ? metadata.focalX : null,
      focal_y: Number.isFinite(metadata.focalY) ? metadata.focalY : null,
      crop_data: metadata.cropData || {},
      status: "uploaded"
    };
    var record = await client.from("order_files").insert(recordPayload).select("*").single();
    if (record.error) {
      await client.storage.from(bucket).remove([storagePath]);
      throw record.error;
    }
    return record.data;
  }

  async function updateFileMetadata(recordId, metadata) {
    var client = getClient();
    var result = await client.from("order_files").update({
      sort_order: metadata.sortOrder,
      is_featured: Boolean(metadata.isFeatured),
      featured_sort_order: metadata.featuredSortOrder || null,
      focal_x: Number.isFinite(metadata.focalX) ? metadata.focalX : null,
      focal_y: Number.isFinite(metadata.focalY) ? metadata.focalY : null,
      crop_data: metadata.cropData || {}
    }).eq("id", recordId).select("*").single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function deleteFile(fileRecord) {
    if (!fileRecord || !fileRecord.id) return;
    var client = getClient();
    var bucket = fileRecord.storage_bucket || window.BD_SUPABASE_CONFIG.privateBucket || "birthday-order-private";
    var removeResult = await client.storage.from(bucket).remove([fileRecord.storage_path]);
    if (removeResult.error) throw removeResult.error;
    var recordResult = await client.from("order_files").delete().eq("id", fileRecord.id);
    if (recordResult.error) throw recordResult.error;
  }

  async function listAdminOrders() {
    var client = getClient();
    var result = await client.from("orders").select("id, order_number, recipient_name, recipient_birthday, sender_name, contact_method, contact_value, purchase_channel, external_order_number, status, created_at, submitted_at, published_at, published_url, public_slug, plans(code, name, price, photo_limit), templates(code, name)").order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function listBlessingWallMessages(orderId) {
    var client = getClient();
    var result = await client.from("blessing_wall_messages")
      .select("id, nickname, message, emoji, status, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function moderateBlessingWallMessage(messageId, status) {
    var client = getClient();
    var userResult = await client.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new Error("登录状态已失效，请重新登录。");
    var result = await client.from("blessing_wall_messages").update({
      status: status,
      deleted_at: status === "deleted" ? new Date().toISOString() : null,
      deleted_by: status === "deleted" ? userResult.data.user.id : null
    }).eq("id", messageId).select("id, status").single();
    if (result.error) throw result.error;
    return result.data;
  }
  async function updateOrderStatus(orderId, status) {
    var client = getClient();
    var payload = { status: status };
    if (status === "approved") payload.approved_at = new Date().toISOString();
    var result = await client.from("orders").update(payload).eq("id", orderId).select("*").single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function publishOrder(orderId) {
    var client = getClient();
    var result = await client.functions.invoke("publish-order", { body: { orderId: orderId } });
    if (result.error) throw new Error(await functionErrorMessage(result.error, "\u65e0\u6cd5\u53d1\u5e03\u751f\u65e5\u9875\u3002"));
    if (!result.data || result.data.error) throw new Error((result.data && result.data.error) || "\u65e0\u6cd5\u53d1\u5e03\u751f\u65e5\u9875\u3002");
    return result.data;
  }

  window.BirthdayCloudOrders = {
    claimOrder: claimOrder,
    createOrder: createOrder,
    submitOrder: submitOrder,
    loadOrder: loadOrder,
    saveDraft: saveDraft,
    uploadFile: uploadFile,
    updateFileMetadata: updateFileMetadata,
    deleteFile: deleteFile,
    listAdminOrders: listAdminOrders,
    updateOrderStatus: updateOrderStatus,
    listBlessingWallMessages: listBlessingWallMessages,
    moderateBlessingWallMessage: moderateBlessingWallMessage,
    publishOrder: publishOrder
  };
})();