import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const allowedPlans = new Set(["basic_166", "upgrade_288"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const service = serviceClient();
    const admin = await requireAdmin(request, service);
    const body = await request.json().catch(() => ({}));
    const planCode = String(body.planCode || "basic_166");
    if (!allowedPlans.has(planCode)) throw new Error("套餐只能是基础心意款或惊喜升级款。");

    const { data: plan, error: planError } = await service
      .from("plans").select("id, code, name, photo_limit").eq("code", planCode).eq("is_active", true).single();
    if (planError || !plan) throw new Error("所选套餐暂不可用，请刷新后重试。");

    const orderNumber = normalizeOrderNumber(body.orderNumber) || makeOrderNumber();
    const token = crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    const { data: order, error: orderError } = await service
      .from("orders")
      .insert({
        order_number: orderNumber,
        plan_id: plan.id,
        template_id: null,
        claim_token_hash: await hashToken(token),
        claim_expires_at: expiresAt,
        purchase_channel: cleanChannel(body.purchaseChannel),
        external_order_number: cleanText(body.externalOrderNumber, 80),
        status: "created"
      })
      .select("id, order_number, claim_expires_at, status")
      .single();
    if (orderError || !order) throw orderError || new Error("订单创建失败。");

    await service.from("order_events").insert({
      order_id: order.id,
      event_type: "order_created",
      actor_user_id: admin.id,
      metadata: { source: "merchant_console", planCode: plan.code }
    });

    return json({
      ok: true,
      order,
      plan: { code: plan.code, name: plan.name, photoLimit: plan.photo_limit },
      claimToken: token,
      claimUrlQuery: "?order=" + encodeURIComponent(order.order_number) + "&token=" + encodeURIComponent(token)
    });
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

async function requireAdmin(request: Request, service: ReturnType<typeof createClient>) {
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Error("请先登录商家账号。");
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) throw new Error("登录状态无效，请重新登录。");
  const { data: admin, error: adminError } = await service
    .from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (adminError || !admin) throw new Error("当前账号没有商家后台权限。");
  return data.user;
}

function cleanText(value: unknown, limit: number) {
  const text = String(value || "").trim().replace(/[<>]/g, "");
  return text ? Array.from(text).slice(0, limit).join("") : null;
}

function cleanChannel(value: unknown) {
  const allowed = new Set(["manual", "taobao", "xianyu", "wechat", "xiaohongshu"]);
  const channel = String(value || "manual");
  return allowed.has(channel) ? channel : "manual";
}

function normalizeOrderNumber(value: unknown) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9_-]{6,48}$/.test(code) ? code : "";
}

function makeOrderNumber() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return "BD" + day + crypto.randomUUID().slice(0, 8).toUpperCase();
}

async function hashToken(token: string) {
  const secret = Deno.env.get("CLAIM_TOKEN_SECRET");
  if (!secret) throw new Error("Edge Function 缺少 CLAIM_TOKEN_SECRET，请先配置密钥。");
  const bytes = new TextEncoder().encode(secret + ":" + token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "订单创建失败，请稍后重试。";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}
