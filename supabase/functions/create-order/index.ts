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
    await requireAdmin(req, service);
    const body = await req.json();
    const orderNumber = body.orderNumber || `BD${new Date().toISOString().slice(0, 10).replaceAll("-", "")}${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const token = crypto.randomUUID().replaceAll("-", "");
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

    const { data: plan, error: planError } = await service.from("plans").select("id").eq("code", body.planCode || "basic_99").single();
    if (planError) throw planError;
    const { data: template, error: templateError } = await service.from("templates").select("id").eq("code", body.templateCode || "T01").single();
    if (templateError) throw templateError;

    const { data, error } = await service.from("orders").insert({
      order_number: orderNumber,
      plan_id: plan.id,
      template_id: template.id,
      claim_token_hash: tokenHash,
      claim_expires_at: expiresAt,
      purchase_channel: body.purchaseChannel || "manual",
      external_order_number: body.externalOrderNumber || null,
      status: "created"
    }).select("id, order_number, claim_expires_at").single();
    if (error) throw error;

    await service.from("order_events").insert({ order_id: data.id, event_type: "order_created", metadata: { source: "create-order" } });
    return json({ order: data, claimToken: token, claimUrlQuery: `?order=${orderNumber}&token=${token}` });
  } catch (error) {
    return json({ error: error.message }, 400);
  }
});

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function requireAdmin(req: Request, service: any) {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Error("请先登录商家账号。");
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) throw new Error("登录状态无效。");
  const { data: admin } = await service.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) throw new Error("当前账号没有商家权限。");
  return data.user;
}

async function hashToken(token: string) {
  const secret = Deno.env.get("CLAIM_TOKEN_SECRET") || "dev-only-change-me";
  const bytes = new TextEncoder().encode(`${secret}:${token}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
