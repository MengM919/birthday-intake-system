(function () {
  "use strict";

  function getClient() {
    const client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  }

  function getError(error, fallback) {
    return error && error.message ? error.message : fallback;
  }

  function moduleConfiguration(moduleCode, modules, music, birthday) {
    if (moduleCode === "surpriseBox") {
      return Array.isArray(modules.surpriseBox) ? (modules.surpriseBox[0] || {}) : {};
    }
    if (moduleCode === "bgm") return { music: music || {} };
    if (moduleCode === "countdown") return { birthday: birthday || null };
    return modules[moduleCode] || {};
  }

  async function claimOrder(orderNumber, token) {
    const client = getClient();
    const { data, error } = await client.functions.invoke("claim-order", {
      body: { orderNumber, token }
    });
    if (error) throw new Error(getError(error, "Unable to claim this order."));
    return data;
  }

  async function createOrder(input) {
    const client = getClient();
    const { data, error } = await client.functions.invoke("create-order", { body: input });
    if (error) throw new Error(getError(error, "Unable to create the order."));
    return data;
  }

  async function submitOrder(orderId) {
    const client = getClient();
    const { data, error } = await client.functions.invoke("submit-order", { body: { orderId } });
    if (error) throw new Error(getError(error, "Unable to submit the order."));
    return data;
  }

  async function loadOrder(orderId) {
    const client = getClient();
    const { data: order, error: orderError } = await client
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (orderError) throw orderError;

    const [contentResult, modulesResult, filesResult, planResult, templateResult] = await Promise.all([
      client.from("order_content").select("*").eq("order_id", orderId).maybeSingle(),
      client.from("order_modules").select("*").eq("order_id", orderId).order("sort_order"),
      client.from("order_files").select("*").eq("order_id", orderId).eq("status", "uploaded").order("sort_order"),
      client.from("plans").select("code, name, photo_limit").eq("id", order.plan_id).maybeSingle(),
      client.from("templates").select("code, name, palette").eq("id", order.template_id).maybeSingle()
    ]);

    if (contentResult.error) throw contentResult.error;
    if (modulesResult.error) throw modulesResult.error;
    if (filesResult.error) throw filesResult.error;
    if (planResult.error) throw planResult.error;
    if (templateResult.error) throw templateResult.error;

    const files = await Promise.all((filesResult.data || []).map(async (file) => {
      let previewUrl = "";
      try {
        previewUrl = await window.BirthdayStorage.getPrivateFileUrl(file.storage_path, 600);
      } catch (error) {
        console.warn("Could not create a signed preview URL.", error);
      }
      return { ...file, previewUrl };
    }));

    return {
      order,
      content: contentResult.data || null,
      modules: modulesResult.data || [],
      files,
      plan: planResult.data || null,
      template: templateResult.data || null
    };
  }

  async function saveDraft(orderId, snapshot) {
    const client = getClient();
    const now = new Date().toISOString();
    const orderPayload = {
      recipient_name: snapshot.recipient.recipientName || null,
      recipient_birthday: snapshot.recipient.birthday || null,
      show_age: Boolean(snapshot.recipient.showAge),
      relationship_type: snapshot.recipient.relationshipType || null,
      sender_name: snapshot.sender.senderName || null,
      sender_anonymous: Boolean(snapshot.sender.senderAnonymous),
      contact_method: snapshot.order.contactMethod || null,
      contact_value: snapshot.order.contactValue || null,
      purchase_channel: snapshot.order.orderChannel || "manual",
      external_order_number: snapshot.order.orderNo || null,
      privacy_consent_at: snapshot.privacy.privacyConfirmed ? now : null,
      status: "draft"
    };
    const { error: orderError } = await client.from("orders").update(orderPayload).eq("id", orderId);
    if (orderError) throw orderError;

    const contentPayload = {
      order_id: orderId,
      headline: snapshot.content.headline || null,
      main_message: snapshot.content.headline || null,
      long_message: snapshot.content.longMessage || null,
      signature: snapshot.content.signature || null,
      music: snapshot.music || {},
      access_mode: snapshot.privacy.pageVisibility || "unlisted",
      allow_share: Boolean(snapshot.privacy.allowShare),
      allow_indexing: Boolean(snapshot.privacy.allowIndexing),
      custom_data: {
        aiFacts: snapshot.content.aiFacts || "",
        aiTone: snapshot.content.aiTone || "warm",
        relationshipOther: snapshot.recipient.relationshipOther || ""
      }
    };
    const { error: contentError } = await client
      .from("order_content")
      .upsert(contentPayload, { onConflict: "order_id" });
    if (contentError) throw contentError;

    const activeModules = snapshot.selectedModules || [];
    const candidateCodes = Array.from(new Set([
      ...activeModules,
      ...Object.keys(snapshot.modules || {}),
      "gallery",
      "bgm",
      "countdown"
    ]));
    const rows = candidateCodes.map((moduleCode, index) => ({
      order_id: orderId,
      module_code: moduleCode,
      enabled: activeModules.includes(moduleCode),
      configuration: moduleConfiguration(
        moduleCode,
        snapshot.modules || {},
        snapshot.music || {},
        snapshot.recipient && snapshot.recipient.birthday
      ),
      sort_order: index + 1
    }));
    if (rows.length) {
      const { error: modulesError } = await client
        .from("order_modules")
        .upsert(rows, { onConflict: "order_id,module_code" });
      if (modulesError) throw modulesError;
    }
    return { savedAt: now };
  }

  async function uploadFile(orderId, fileType, file, metadata) {
    const client = getClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("Your sign-in session is no longer valid.");
    const kind = fileType === "cover" ? "cover" : "gallery";
    window.BirthdayStorage.validateFile(file, fileType === "cover" ? "cover" : "image");
    const bucket = window.BD_SUPABASE_CONFIG.privateBucket || "birthday-order-private";
    const storagePath = window.BirthdayStorage.makeStoragePath(orderId, userData.user.id, kind, file);
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(storagePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data: record, error: recordError } = await client
      .from("order_files")
      .insert({
        order_id: orderId,
        uploaded_by: userData.user.id,
        file_type: fileType,
        storage_bucket: bucket,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        width: metadata.width || null,
        height: metadata.height || null,
        sort_order: metadata.sortOrder || 0,
        status: "uploaded"
      })
      .select("*")
      .single();
    if (recordError) {
      await client.storage.from(bucket).remove([storagePath]);
      throw recordError;
    }
    return record;
  }

  async function deleteFile(fileRecord) {
    const client = getClient();
    if (!fileRecord || !fileRecord.id) return;
    const bucket = fileRecord.storage_bucket || window.BD_SUPABASE_CONFIG.privateBucket || "birthday-order-private";
    const { error: storageError } = await client.storage.from(bucket).remove([fileRecord.storage_path]);
    if (storageError) throw storageError;
    const { error: recordError } = await client.from("order_files").delete().eq("id", fileRecord.id);
    if (recordError) throw recordError;
  }

  async function listAdminOrders() {
    const client = getClient();
    const { data, error } = await client
      .from("orders")
      .select("id, order_number, recipient_name, recipient_birthday, sender_name, contact_method, contact_value, purchase_channel, status, created_at, submitted_at, plans(code, name), templates(code, name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function updateOrderStatus(orderId, status) {
    const client = getClient();
    const changes = { status };
    if (status === "approved") changes.approved_at = new Date().toISOString();
    const { data, error } = await client.from("orders").update(changes).eq("id", orderId).select("*").single();
    if (error) throw error;
    return data;
  }

  window.BirthdayCloudOrders = {
    claimOrder,
    createOrder,
    submitOrder,
    loadOrder,
    saveDraft,
    uploadFile,
    deleteFile,
    listAdminOrders,
    updateOrderStatus
  };
})();