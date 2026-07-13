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
    const admin = await requireAdmin(req, service);
    const { orderId } = await req.json();
    if (!orderId) throw new Error("缺少 orderId。");

    const { data: order, error } = await service.from("orders").select("*, plan:plans(code,name,photo_limit), template:templates(code,name,palette)").eq("id", orderId).single();
    if (error || !order) throw new Error("订单不存在。");
    const { data: content } = await service.from("order_content").select("*").eq("order_id", orderId).maybeSingle();
    const { data: modules } = await service.from("order_modules").select("module_code, enabled, configuration, sort_order").eq("order_id", orderId).order("sort_order");
    const { data: files } = await service.from("order_files").select("file_type, storage_bucket, storage_path, sort_order, caption").eq("order_id", orderId).eq("status", "uploaded").order("sort_order");

    const moduleMap: Record<string, unknown> = {};
    for (const mod of modules || []) {
      moduleMap[mod.module_code] = { enabled: mod.enabled, ...(mod.configuration || {}) };
    }
    if (moduleMap.surpriseBox) {
      moduleMap.surpriseBox = { ...(moduleMap.surpriseBox as Record<string, unknown>), displayName: "惊喜盲盒", renderMode: "immersive" };
    }

    const birthdayPageConfig = {
      orderId: order.id,
      templateId: order.template?.code,
      recipient: { name: order.recipient_name, birthday: order.recipient_birthday },
      sender: { name: order.sender_name, anonymous: order.sender_anonymous },
      relationship: order.relationship_type,
      content: {
        headline: content?.headline,
        message: content?.long_message || content?.main_message || content?.headline
      },
      photos: {
        cover: (files || []).find((file: any) => file.file_type === "cover") || null,
        gallery: (files || []).filter((file: any) => file.file_type === "gallery")
      },
      modules: moduleMap,
      privacy: {
        allowShare: content?.allow_share ?? true,
        allowIndexing: content?.allow_indexing ?? false,
        pageVisibility: content?.access_mode || "unlisted"
      }
    };

    const slug = order.public_slug || crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const publishedUrl = `${Deno.env.get("PUBLIC_BIRTHDAY_BASE_URL") || "https://mengm919.github.io/birthday-intake-system/pages/"}${slug}/`;
    const { error: updateError } = await service.from("orders").update({
      status: "published",
      public_slug: slug,
      published_url: publishedUrl,
      published_at: new Date().toISOString()
    }).eq("id", orderId);
    if (updateError) throw updateError;
    await service.from("order_events").insert({ order_id: orderId, event_type: "published", actor_user_id: admin.id, metadata: { publishedUrl } });
    return json({ ok: true, birthdayPageConfig, publishedUrl });
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
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
