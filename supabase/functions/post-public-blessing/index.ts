import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
const allowedEmoji = new Set(["🎂", "🎈", "✨", "🎁", "🌷", "💌", "⭐", "🫶"]);
const rateLimitCount = 3;
const rateLimitWindowMs = 10 * 60 * 1000;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "list");
    const service = serviceClient();

    if (action === "moderate") {
      return json({ ok: true, message: await moderateMessage(request, service, body) });
    }

    const slug = String(body.slug || "");
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(slug)) throw new Error("这份生日惊喜链接无效。");
    const order = await publishedOrder(service, slug);
    await assertWallEnabled(service, order.id);

    if (action === "list") return json({ ok: true, ...(await listMessages(service, order.id, body)) });
    if (action === "create") return json({ ok: true, message: await createMessage(request, service, order.id, body) }, 201);
    throw new Error("不支持的留言操作。");
  } catch (error) {
    return json({ ok: false, error: message(error) }, 400);
  }
});

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("祝福墙暂时不可用，请稍后再试。");
  return createClient(url, key);
}

async function publishedOrder(service: any, slug: string) {
  const { data, error } = await service
    .from("orders")
    .select("id")
    .eq("public_slug", slug)
    .eq("status", "published")
    .single();
  if (error || !data) throw new Error("这份生日惊喜还没有发布或已下线。");
  return data;
}

async function assertWallEnabled(service: any, orderId: string) {
  const { data, error } = await service
    .from("order_modules")
    .select("enabled")
    .eq("order_id", orderId)
    .eq("module_code", "messageWall")
    .maybeSingle();
  if (error || !data?.enabled) throw new Error("这份生日页没有开启祝福墙。");
}

async function listMessages(service: any, orderId: string, body: Record<string, unknown>) {
  const limit = Math.max(1, Math.min(24, Number(body.limit) || 12));
  const offset = Math.max(0, Number(body.offset) || 0);
  const { data, error } = await service
    .from("blessing_wall_messages")
    .select("id, nickname, message, emoji, created_at")
    .eq("order_id", orderId)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);
  if (error) throw new Error("祝福墙暂时不可用，请稍后再试。");
  const rows = data || [];
  const messages = rows.slice(0, limit);
  return { messages, nextOffset: offset + messages.length, hasMore: rows.length > limit };
}

async function createMessage(request: Request, service: any, orderId: string, body: Record<string, unknown>) {
  if (String(body.website || "").trim()) {
    return { id: "ignored", nickname: "匿名朋友", message: "", emoji: "✨", created_at: new Date().toISOString() };
  }

  const messageText = sanitize(body.message, 200);
  const anonymous = Boolean(body.anonymous);
  const nickname = anonymous ? "匿名朋友" : sanitize(body.nickname, 20) || "一位朋友";
  const emoji = allowedEmoji.has(String(body.emoji || "")) ? String(body.emoji) : "✨";
  if (!messageText) throw new Error("写下一句祝福后再送出吧。");

  const ipHash = await hash(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown");
  const windowStart = new Date(Date.now() - rateLimitWindowMs).toISOString();
  const { count, error: rateError } = await service
    .from("blessing_wall_messages")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart);
  if (rateError) throw new Error("祝福墙暂时不可用，请稍后再试。");
  if (Number(count || 0) >= rateLimitCount) {
    throw new Error("十分钟内最多留下三条祝福，等一会儿再来写吧。");
  }

  const userAgentHash = await hash(request.headers.get("user-agent") || "unknown");
  const { data, error } = await service
    .from("blessing_wall_messages")
    .insert({
      order_id: orderId,
      nickname,
      message: messageText,
      emoji,
      ip_hash: ipHash,
      user_agent_hash: userAgentHash,
      status: "visible"
    })
    .select("id, nickname, message, emoji, created_at")
    .single();
  if (error || !data) throw new Error("暂时没能收下这份祝福，请稍后再试。");
  return data;
}

async function moderateMessage(request: Request, service: any, body: Record<string, unknown>) {
  const admin = await requireAdmin(request, service);
  const id = String(body.messageId || "");
  const status = String(body.status || "");
  if (!/^[a-f0-9-]{36}$/i.test(id) || !["hidden", "deleted", "visible"].includes(status)) {
    throw new Error("留言处理参数无效。");
  }

  const { data, error } = await service
    .from("blessing_wall_messages")
    .update({
      status,
      deleted_at: status === "deleted" ? new Date().toISOString() : null,
      deleted_by: status === "deleted" ? admin.id : null
    })
    .eq("id", id)
    .select("id, status")
    .single();
  if (error || !data) throw new Error("暂时无法处理这条留言。");
  return data;
}

async function requireAdmin(request: Request, service: any) {
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Error("请先登录商家账号。");
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) throw new Error("登录状态无效。");
  const { data: admin } = await service.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) throw new Error("当前账号没有商家权限。");
  return data.user;
}

function sanitize(value: unknown, limit: number) {
  return Array.from(String(value || "")
    .replace(/[<>]/g, "")
    .replace(/https?:\/\/\S+/gi, "[链接已移除]")
    .replace(/\s+/g, " ")
    .trim())
    .slice(0, limit)
    .join("");
}

async function hash(value: string) {
  const secret = Deno.env.get("WALL_RATE_LIMIT_SECRET") || Deno.env.get("CLAIM_TOKEN_SECRET");
  if (!secret) throw new Error("祝福墙暂时不可用，请稍后再试。");
  const buffer = new TextEncoder().encode(secret + ":" + value);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "祝福墙暂时不可用，请稍后再试。";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}