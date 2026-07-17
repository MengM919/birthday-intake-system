import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const fixedModules = new Set(["gallery", "messageWall", "countdown"]);
const surpriseImagery = new Set(["kitten", "fireworks", "flowers", "stars", "butterflies", "balloons", "ocean", "petals"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const service = serviceClient();
    const user = await requireUser(request, service);
    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || "");
    if (!orderId) throw new Error("缺少订单编号。");

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, customer_user_id, status, template_id, recipient_name, recipient_birthday, relationship_type, sender_name, sender_anonymous, contact_value, privacy_consent_at, plan:plans(id,code,photo_limit)")
      .eq("id", orderId)
      .single();
    if (orderError || !order) throw new Error("订单不存在或已被删除。");
    if (order.customer_user_id !== user.id) throw new Error("你无权提交这份订单。");
    if (!["claimed", "draft", "needs_revision"].includes(order.status)) throw new Error("这份订单当前不能再次提交，请联系商家确认状态。");

    const [contentResult, moduleResult, fileResult, allowedResult] = await Promise.all([
      service.from("order_content").select("headline, main_message, long_message").eq("order_id", orderId).maybeSingle(),
      service.from("order_modules").select("module_code, enabled, configuration").eq("order_id", orderId),
      service.from("order_files").select("file_type, status").eq("order_id", orderId),
      service.from("plan_modules").select("module_code, is_included, is_optional").eq("plan_id", order.plan.id)
    ]);
    if (contentResult.error) throw contentResult.error;
    if (moduleResult.error) throw moduleResult.error;
    if (fileResult.error) throw fileResult.error;
    if (allowedResult.error) throw allowedResult.error;

    const notices: string[] = [];
    const headline = String(contentResult.data?.headline || contentResult.data?.main_message || "").trim();
    const photos = fileResult.data || [];
    const uploaded = photos.filter((file) => file.status === "uploaded");
    const galleryCount = uploaded.filter((file) => file.file_type === "gallery").length;
    const coverCount = uploaded.filter((file) => file.file_type === "cover").length;
    const allowed = new Set((allowedResult.data || []).map((row) => row.module_code));

    if (!order.template_id) notices.push("请先选择一套生日页面模板。");
    if (!clean(order.contact_value)) notices.push("请留下接收制作通知的联系方式。");
    if (!clean(order.recipient_name)) notices.push("请填写寿星的昵称。");
    if (!validDate(order.recipient_birthday)) notices.push("请填写有效的生日日期。");
    if (!clean(order.relationship_type)) notices.push("请说明你们的关系。");
    if (!order.sender_anonymous && !clean(order.sender_name)) notices.push("不匿名时，请填写送礼人的昵称。");
    if (!headline) notices.push("请填写首页主祝福语。");
    if (Array.from(headline).length > 15) notices.push("首页主祝福语不能超过 15 个字。");
    if (!order.privacy_consent_at) notices.push("请确认资料授权与隐私说明。");
    if (coverCount !== 1) notices.push("请上传 1 张封面图。");
    if (galleryCount < 1) notices.push("请至少上传 1 张回忆照片。");
    if (galleryCount > Number(order.plan.photo_limit || 0)) notices.push("当前套餐最多上传 " + order.plan.photo_limit + " 张回忆照片。");

    for (const module of moduleResult.data || []) {
      if (!module.enabled) continue;
      if (!allowed.has(module.module_code)) notices.push("当前套餐不包含“" + module.module_code + "”功能。");
      if (module.module_code === "surpriseBox") {
        const config = module.configuration || {};
        if (!surpriseImagery.has(String(config.imageryCode || ""))) notices.push("惊喜盲盒需要选择一种有效意象。");
        if (!clean(config.surpriseMessage)) notices.push("请写下惊喜盲盒打开时想说的一句话。");
      }
      if (module.module_code === "futureMailbox") {
        const config = module.configuration || {};
        if (!validDate(config.openDate) || !clean(config.content)) notices.push("未来信箱需要填写打开日期和信件内容。");
      }
      if (module.module_code === "wishBottle" && !clean((module.configuration || {}).prompt)) notices.push("许愿瓶需要写下一句心愿。");
    }
    for (const code of fixedModules) if (!allowed.has(code)) notices.push("订单套餐配置不完整，请联系商家处理。");

    if (notices.length) return json({ ok: false, notices }, 422);
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await service
      .from("orders")
      .update({ status: "submitted", submitted_at: now })
      .eq("id", orderId)
      .select("id, order_number, status, submitted_at")
      .single();
    if (updateError || !updated) throw updateError || new Error("订单提交失败。");
    await service.from("order_events").insert({ order_id: orderId, event_type: "order_submitted", actor_user_id: user.id, metadata: { galleryCount } });
    return json({ ok: true, order: updated });
  } catch (error) {
    return json({ ok: false, error: message(error) }, 400);
  }
});

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Edge Function 缺少 Supabase 服务端密钥配置。");
  return createClient(url, key);
}

async function requireUser(request: Request, service: ReturnType<typeof createClient>) {
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Error("登录状态已失效，请刷新后重试。");
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) throw new Error("登录状态无效，请刷新页面后重试。");
  return data.user;
}

function clean(value: unknown) { return String(value || "").trim(); }
function validDate(value: unknown) { return Boolean(value) && !Number.isNaN(new Date(String(value) + "T12:00:00").getTime()); }
function message(error: unknown) { return error instanceof Error ? error.message : "订单提交失败，请稍后重试。"; }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers }); }
