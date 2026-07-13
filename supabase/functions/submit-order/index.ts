import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const allowedImagery = new Set(["kitten", "fireworks", "flowers", "stars", "butterflies", "balloons", "ocean", "petals"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const service = serviceClient();
    const user = await requireUser(req, service);
    const { orderId } = await req.json();
    if (!orderId) throw new Error("缺少 orderId。");

    const { data: order, error } = await service.from("orders").select("id, customer_user_id, plan:plans(photo_limit), recipient_name, recipient_birthday, privacy_consent_at").eq("id", orderId).single();
    if (error || !order) throw new Error("订单不存在。");
    if (order.customer_user_id !== user.id) throw new Error("无权提交该订单。");

    const { data: content } = await service.from("order_content").select("headline, main_message, long_message").eq("order_id", orderId).maybeSingle();
    const { data: modules } = await service.from("order_modules").select("module_code, enabled, configuration").eq("order_id", orderId);
    const { data: files } = await service.from("order_files").select("file_type").eq("order_id", orderId).eq("status", "uploaded");

    const notices: string[] = [];
    if (!order.recipient_name) notices.push("请填写寿星姓名。");
    if (!order.recipient_birthday) notices.push("请填写生日日期。");
    if (!content?.headline) notices.push("请填写首页主祝福。");
    if (!order.privacy_consent_at) notices.push("请确认隐私授权。");
    const coverCount = (files || []).filter((file: any) => file.file_type === "cover").length;
    const galleryCount = (files || []).filter((file: any) => file.file_type === "gallery").length;
    if (coverCount < 1) notices.push("请上传封面照片。");
    if (galleryCount < 1) notices.push("请至少上传 1 张回忆照片。");
    if (galleryCount > Number(order.plan?.photo_limit || 0)) notices.push(`当前套餐最多 ${order.plan.photo_limit} 张相册照片。`);

    const surprise = (modules || []).find((item: any) => item.module_code === "surpriseBox" && item.enabled);
    if (surprise) {
      const config = surprise.configuration || {};
      if (!allowedImagery.has(config.imageryCode)) notices.push("惊喜盲盒意象不正确。");
      if (!config.surpriseMessage) notices.push("惊喜盲盒需要填写专属祝福。");
    }

    if (notices.length) return json({ ok: false, notices }, 422);
    const now = new Date().toISOString();
    const { data, error: updateError } = await service.from("orders").update({ status: "submitted", submitted_at: now }).eq("id", orderId).select("id, status, submitted_at").single();
    if (updateError) throw updateError;
    await service.from("order_events").insert({ order_id: orderId, event_type: "order_submitted", actor_user_id: user.id });
    return json({ ok: true, order: data });
  } catch (error) {
    return json({ error: error.message }, 400);
  }
});

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
async function requireUser(req: Request, service: any) {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Error("请先登录。");
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) throw new Error("登录状态无效。");
  return data.user;
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
