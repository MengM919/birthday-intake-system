import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const service = serviceClient();
    const user = await requireUser(req, service);
    const { orderNumber, token } = await req.json();
    if (!orderNumber || !token) throw new Error("缺少订单号或领取 token。");

    const { data: order, error } = await service.from("orders").select("id, order_number, customer_user_id, claim_token_hash, claim_expires_at, status").eq("order_number", orderNumber).single();
    if (error || !order) throw new Error("订单不存在。");
    if (order.customer_user_id && order.customer_user_id !== user.id) throw new Error("该订单已被其他用户领取。");
    if (order.claim_expires_at && new Date(order.claim_expires_at).getTime() < Date.now()) throw new Error("领取链接已过期，请联系商家重新生成。");
    const tokenHash = await hashToken(token);
    if (tokenHash !== order.claim_token_hash) throw new Error("领取 token 不正确。");

    const { data, error: updateError } = await service.from("orders").update({
      customer_user_id: user.id,
      claimed_at: new Date().toISOString(),
      status: order.status === "created" ? "claimed" : order.status
    }).eq("id", order.id).select("id, order_number, status, customer_user_id").single();
    if (updateError) throw updateError;

    await service.from("order_events").insert({ order_id: order.id, event_type: "order_claimed", actor_user_id: user.id });
    return json({ order: data });
  } catch (error) {
    return json({ error: error.message }, 400);
  }
});

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function requireUser(req: Request, service: any) {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Error("请先打开页面并建立匿名登录状态。");
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) throw new Error("登录状态无效。");
  return data.user;
}

async function hashToken(token: string) {
  const secret = Deno.env.get("CLAIM_TOKEN_SECRET");
  if (!secret) {
    throw new Error("订单领取服务尚未完成安全配置，请联系商家处理。");
  }
  const bytes = new TextEncoder().encode(`${secret}:${token}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
