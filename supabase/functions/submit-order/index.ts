import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const fixedModules = new Set(["gallery", "messageWall", "countdown"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const service = serviceClient();
    const user = await requireUser(request, service);
    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || "");
    if (!orderId) throw new Error("\u7f3a\u5c11\u8ba2\u5355\u7f16\u53f7\u3002");

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, customer_user_id, status, template_id, recipient_name, recipient_birthday, relationship_type, sender_name, sender_anonymous, contact_value, privacy_consent_at, plan:plans(id,code,photo_limit)")
      .eq("id", orderId)
      .single();
    if (orderError || !order) throw new Error("\u8ba2\u5355\u4e0d\u5b58\u5728\u6216\u5df2\u88ab\u5220\u9664\u3002");
    if (order.customer_user_id !== user.id) throw new Error("\u4f60\u65e0\u6743\u63d0\u4ea4\u8fd9\u4efd\u8ba2\u5355\u3002");
    if (!["claimed", "draft", "needs_revision"].includes(String(order.status))) {
      throw new Error("\u8fd9\u4efd\u8ba2\u5355\u5f53\u524d\u4e0d\u80fd\u518d\u6b21\u63d0\u4ea4\uff0c\u8bf7\u8054\u7cfb\u5546\u5bb6\u786e\u8ba4\u72b6\u6001\u3002");
    }

    const plan = asOne((order as Record<string, unknown>).plan) as Record<string, unknown> | null;
    if (!plan) throw new Error("\u8ba2\u5355\u5957\u9910\u914d\u7f6e\u4e0d\u5b8c\u6574\uff0c\u8bf7\u8054\u7cfb\u5546\u5bb6\u5904\u7406\u3002");

    const [contentResult, moduleResult, fileResult, allowedResult] = await Promise.all([
      service.from("order_content").select("headline, main_message, long_message").eq("order_id", orderId).maybeSingle(),
      service.from("order_modules").select("module_code, enabled, configuration").eq("order_id", orderId),
      service.from("order_files").select("file_type, status").eq("order_id", orderId),
      service.from("plan_modules").select("module_code, is_included, is_optional").eq("plan_id", String(plan.id))
    ]);
    if (contentResult.error) throw contentResult.error;
    if (moduleResult.error) throw moduleResult.error;
    if (fileResult.error) throw fileResult.error;
    if (allowedResult.error) throw allowedResult.error;

    const notices: string[] = [];
    const headline = String(contentResult.data?.headline || contentResult.data?.main_message || "").trim();
    const uploaded = (fileResult.data || []).filter((file) => file.status === "uploaded");
    const galleryCount = uploaded.filter((file) => file.file_type === "gallery").length;
    const coverCount = uploaded.filter((file) => file.file_type === "cover").length;
    const allowed = new Set((allowedResult.data || []).map((row) => row.module_code));
    const galleryLimit = Number(plan.photo_limit || 0);

    if (!order.template_id) notices.push("\u8bf7\u5148\u9009\u62e9\u4e00\u5957\u751f\u65e5\u9875\u9762\u6a21\u677f\u3002");
    if (!clean(order.contact_value)) notices.push("\u8bf7\u7559\u4e0b\u63a5\u6536\u5236\u4f5c\u901a\u77e5\u7684\u8054\u7cfb\u65b9\u5f0f\u3002");
    if (!clean(order.recipient_name)) notices.push("\u8bf7\u586b\u5199\u5bff\u661f\u7684\u79f0\u547c\u3002");
    if (!validDate(order.recipient_birthday)) notices.push("\u8bf7\u586b\u5199\u6709\u6548\u7684\u751f\u65e5\u65e5\u671f\u3002");
    if (!clean(order.relationship_type)) notices.push("\u8bf7\u8bf4\u660e\u4f60\u4eec\u7684\u5173\u7cfb\u3002");
    if (!order.sender_anonymous && !clean(order.sender_name)) notices.push("\u4e0d\u533f\u540d\u65f6\uff0c\u8bf7\u586b\u5199\u9001\u793c\u4eba\u7684\u79f0\u547c\u3002");
    if (!headline) notices.push("\u8bf7\u586b\u5199\u9996\u9875\u4e3b\u795d\u798f\u8bed\u3002");
    if (Array.from(headline).length > 15) notices.push("\u9996\u9875\u4e3b\u795d\u798f\u8bed\u4e0d\u80fd\u8d85\u8fc7 15 \u4e2a\u5b57\u3002");
    if (!order.privacy_consent_at) notices.push("\u8bf7\u786e\u8ba4\u8d44\u6599\u6388\u6743\u4e0e\u9690\u79c1\u8bf4\u660e\u3002");
    if (coverCount !== 1) notices.push("\u8bf7\u4e0a\u4f20 1 \u5f20\u5c01\u9762\u56fe\u3002");
    if (galleryCount < 1) notices.push("\u8bf7\u81f3\u5c11\u4e0a\u4f20 1 \u5f20\u56de\u5fc6\u7167\u7247\u3002");
    if (galleryLimit > 0 && galleryCount > galleryLimit) {
      notices.push("\u5f53\u524d\u5957\u9910\u6700\u591a\u4e0a\u4f20 " + galleryLimit + " \u5f20\u56de\u5fc6\u7167\u7247\u3002");
    }

    for (const module of moduleResult.data || []) {
      if (!module.enabled) continue;
      if (!allowed.has(module.module_code)) {
        notices.push("\u5f53\u524d\u5957\u9910\u4e0d\u5305\u542b\u201c" + module.module_code + "\u201d\u529f\u80fd\u3002");
      }
      if (module.module_code === "surpriseBox") {
        const config = asObject(module.configuration);
        if (config.sceneMode && String(config.sceneMode) !== "random_immersive") {
          notices.push("\u60ca\u559c\u76f2\u76d2\u914d\u7f6e\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u4fdd\u5b58\u8349\u7a3f\u3002");
        }
      }
      if (module.module_code === "futureMailbox") {
        const config = asObject(module.configuration);
        if (!validDate(config.openDate) || !clean(config.content)) {
          notices.push("\u672a\u6765\u4fe1\u7bb1\u9700\u8981\u586b\u5199\u6253\u5f00\u65e5\u671f\u548c\u4fe1\u4ef6\u5185\u5bb9\u3002");
        }
      }
      if (module.module_code === "wishBottle" && !clean(asObject(module.configuration).prompt)) {
        notices.push("\u8bb8\u613f\u74f6\u9700\u8981\u5199\u4e0b\u4e00\u53e5\u5fc3\u613f\u3002");
      }
    }

    fixedModules.forEach((code) => {
      if (!allowed.has(code)) notices.push("\u8ba2\u5355\u5957\u9910\u914d\u7f6e\u4e0d\u5b8c\u6574\uff0c\u8bf7\u8054\u7cfb\u5546\u5bb6\u5904\u7406\u3002");
    });

    if (notices.length) return json({ ok: false, notices }, 422);

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await service
      .from("orders")
      .update({ status: "submitted", submitted_at: now })
      .eq("id", orderId)
      .select("id, order_number, status, submitted_at")
      .single();
    if (updateError || !updated) throw updateError || new Error("\u8ba2\u5355\u63d0\u4ea4\u5931\u8d25\u3002");

    const { error: eventError } = await service.from("order_events").insert({
      order_id: orderId,
      event_type: "order_submitted",
      actor_user_id: user.id,
      metadata: { galleryCount, galleryLimit: galleryLimit > 0 ? galleryLimit : null }
    });
    if (eventError) throw eventError;
    return json({ ok: true, order: updated });
  } catch (error) {
    console.error("submit-order failed", error);
    return json({ ok: false, error: message(error) }, 400);
  }
});

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Edge Function \u7f3a\u5c11 Supabase \u670d\u52a1\u7aef\u5bc6\u94a5\u914d\u7f6e\u3002");
  return createClient(url, key);
}

async function requireUser(request: Request, service: ReturnType<typeof createClient>) {
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Error("\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5\u3002");
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) throw new Error("\u767b\u5f55\u72b6\u6001\u65e0\u6548\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5\u3002");
  return data.user;
}

function asOne(value: unknown) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clean(value: unknown) { return String(value || "").trim(); }
function validDate(value: unknown) { return Boolean(value) && !Number.isNaN(new Date(String(value) + "T12:00:00").getTime()); }
function message(error: unknown) { return error instanceof Error ? error.message : "\u8ba2\u5355\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"; }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers }); }