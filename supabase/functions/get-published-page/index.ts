import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const body = await request.json().catch(() => ({}));
    const slug = String(body.slug || "");
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(slug)) throw new Error("这份生日惊喜链接无效。");

    const service = serviceClient();
    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, public_slug, status, recipient_name, recipient_birthday, sender_name, sender_anonymous, relationship_type, template:templates(code,name,palette)")
      .eq("public_slug", slug)
      .eq("status", "published")
      .single();
    if (orderError || !order) throw new Error("这份生日惊喜不存在、尚未发布或已下线。");

    const [contentResult, moduleResult, fileResult] = await Promise.all([
      service.from("order_content").select("headline, main_message, long_message, signature, access_mode, allow_share, allow_indexing, music").eq("order_id", order.id).maybeSingle(),
      service.from("order_modules").select("module_code, enabled, configuration, sort_order").eq("order_id", order.id).eq("enabled", true).order("sort_order"),
      service.from("order_files").select("file_type, storage_bucket, storage_path, sort_order, caption, is_featured, featured_sort_order, focal_x, focal_y, crop_data").eq("order_id", order.id).eq("status", "uploaded").in("file_type", ["cover", "gallery"]).order("sort_order")
    ]);
    if (contentResult.error) throw contentResult.error;
    if (moduleResult.error) throw moduleResult.error;
    if (fileResult.error) throw fileResult.error;
    const content = contentResult.data;
    if ((content?.access_mode || "unlisted") !== "unlisted") throw new Error("该页面的访问方式暂不支持。");

    const signedFiles = await Promise.all((fileResult.data || []).map(async (file) => {
      const { data, error } = await service.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 60 * 30);
      if (error || !data?.signedUrl) return null;
      return {
        fileType: file.file_type,
        url: data.signedUrl,
        caption: file.caption || "",
        sortOrder: file.sort_order || 0,
        isFeatured: Boolean(file.is_featured),
        featuredSortOrder: file.featured_sort_order || null,
        focalX: file.focal_x == null ? 0.5 : Number(file.focal_x),
        focalY: file.focal_y == null ? 0.5 : Number(file.focal_y),
        cropData: file.crop_data || {}
      };
    }));
    const files = signedFiles.filter(Boolean) as Array<Record<string, unknown>>;
    const moduleMap: Record<string, Record<string, unknown>> = {};
    for (const module of moduleResult.data || []) {
      moduleMap[module.module_code] = { enabled: true, ...(module.configuration || {}) };
    }
    if (moduleMap.surpriseBox) moduleMap.surpriseBox = { ...moduleMap.surpriseBox, displayName: "惊喜盲盒", renderMode: "immersive" };
    if (moduleMap.messageWall) moduleMap.messageWall = { ...moduleMap.messageWall, displayName: "祝福墙", publicMode: true };

    return json({
      ok: true,
      page: {
        slug,
        templateId: order.template?.code || "T01",
        templateName: order.template?.name || "",
        palette: order.template?.palette || {},
        recipient: { name: order.recipient_name || "", birthday: order.recipient_birthday || "" },
        sender: { name: order.sender_name || "", anonymous: Boolean(order.sender_anonymous) },
        relationship: order.relationship_type || "",
        content: {
          headline: content?.headline || content?.main_message || "",
          message: content?.long_message || content?.main_message || "",
          signature: content?.signature || "",
          music: content?.music || {}
        },
        photos: {
          cover: files.find((file) => file.fileType === "cover") || null,
          gallery: files.filter((file) => file.fileType === "gallery")
        },
        modules: moduleMap,
        privacy: {
          allowShare: content?.allow_share ?? true,
          allowIndexing: false,
          pageVisibility: "unlisted"
        }
      }
    });
  } catch (error) {
    return json({ ok: false, error: message(error) }, 404);
  }
});

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("生日页服务暂时不可用。");
  return createClient(url, key);
}
function message(error: unknown) { return error instanceof Error ? error.message : "暂时无法打开这份生日惊喜。"; }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers }); }
