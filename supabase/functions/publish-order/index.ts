import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const service = serviceClient();
    const admin = await requireAdmin(request, service);
    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || "");
    if (!orderId) throw new Error("缺少订单编号。");

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, status, recipient_name, recipient_birthday, sender_name, sender_anonymous, relationship_type, public_slug, template:templates(code,name,palette)")
      .eq("id", orderId)
      .single();
    if (orderError || !order) throw new Error("订单不存在。");
    if (!["approved", "published"].includes(order.status)) throw new Error("请先将订单标记为“已批准”，再发布生日页面。");

    const [contentResult, moduleResult, fileResult] = await Promise.all([
      service.from("order_content").select("*").eq("order_id", orderId).maybeSingle(),
      service.from("order_modules").select("module_code, enabled, configuration, sort_order").eq("order_id", orderId).order("sort_order"),
      service.from("order_files").select("file_type, storage_bucket, storage_path, sort_order, caption, is_featured, featured_sort_order, focal_x, focal_y, crop_data").eq("order_id", orderId).eq("status", "uploaded").order("sort_order")
    ]);
    if (contentResult.error) throw contentResult.error;
    if (moduleResult.error) throw moduleResult.error;
    if (fileResult.error) throw fileResult.error;
    const content = contentResult.data;
    if ((content?.access_mode || "unlisted") !== "unlisted") throw new Error("密码访问尚未上线，请保持“仅通过专属链接访问”。");

    const moduleMap: Record<string, Record<string, unknown>> = {};
    for (const module of moduleResult.data || []) moduleMap[module.module_code] = { enabled: Boolean(module.enabled), ...(module.configuration || {}) };
    if (moduleMap.surpriseBox) moduleMap.surpriseBox = { ...moduleMap.surpriseBox, displayName: "惊喜盲盒", renderMode: "immersive" };
    if (moduleMap.bgm) moduleMap.bgm = { ...moduleMap.bgm, enabled: Boolean(moduleMap.bgm.enabled), fixedTrack: "the_walters_i_love_you_so" };

    const files = (fileResult.data || []).map((file) => ({
      fileType: file.file_type,
      bucket: file.storage_bucket,
      path: file.storage_path,
      caption: file.caption || "",
      sortOrder: file.sort_order || 0,
      isFeatured: Boolean(file.is_featured),
      featuredSortOrder: file.featured_sort_order || null,
      focalX: file.focal_x == null ? 0.5 : Number(file.focal_x),
      focalY: file.focal_y == null ? 0.5 : Number(file.focal_y),
      cropData: file.crop_data || {}
    }));
    const birthdayPageConfig = {
      orderId: order.id,
      templateId: order.template?.code || "T01",
      recipient: { name: order.recipient_name, birthday: order.recipient_birthday },
      sender: { name: order.sender_name, anonymous: order.sender_anonymous },
      relationship: order.relationship_type,
      content: {
        headline: content?.headline || content?.main_message || "",
        message: content?.long_message || content?.main_message || "",
        signature: content?.signature || ""
      },
      photos: {
        cover: files.find((file) => file.fileType === "cover") || null,
        gallery: files.filter((file) => file.fileType === "gallery")
      },
      modules: moduleMap,
      privacy: { allowShare: content?.allow_share ?? true, allowIndexing: false, pageVisibility: "unlisted" }
    };

    const slug = order.public_slug || crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    const base = (Deno.env.get("PUBLIC_BIRTHDAY_BASE_URL") || "https://mengm919.github.io/birthday-intake-system/birthday.html").replace(/\/+$/, "");
    const publishedUrl = base + "?slug=" + encodeURIComponent(slug);
    const now = new Date().toISOString();
    const { error: updateError } = await service
      .from("orders")
      .update({ status: "published", public_slug: slug, published_url: publishedUrl, published_at: now })
      .eq("id", orderId);
    if (updateError) throw updateError;
    await service.from("order_events").insert({
      order_id: orderId,
      event_type: "published",
      actor_user_id: admin.id,
      metadata: { publishedUrl, templateId: order.template?.code || "T01", moduleCodes: Object.keys(moduleMap) }
    });
    return json({ ok: true, publishedUrl, publicSlug: slug, birthdayPageConfig });
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
  const { data: admin } = await service.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) throw new Error("当前账号没有商家权限。");
  return data.user;
}
function message(error: unknown) { return error instanceof Error ? error.message : "生日页面发布失败，请稍后再试。"; }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers }); }
