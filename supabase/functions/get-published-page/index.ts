import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { slug } = await req.json();
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(String(slug || ""))) throw new Error("链接无效。");

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order, error } = await service
      .from("orders")
      .select("id, public_slug, status, recipient_name, recipient_birthday, sender_name, sender_anonymous, relationship_type, template:templates(code,name,palette)")
      .eq("public_slug", slug)
      .eq("status", "published")
      .single();
    if (error || !order) throw new Error("这份生日惊喜不存在、尚未发布或已下线。");

    const { data: content } = await service
      .from("order_content")
      .select("headline, main_message, long_message, signature, access_mode, allow_share, allow_indexing")
      .eq("order_id", order.id)
      .maybeSingle();

    if ((content?.access_mode || "unlisted") !== "unlisted") {
      throw new Error("此页面目前不支持这种访问方式。");
    }

    const { data: modules } = await service
      .from("order_modules")
      .select("module_code, enabled, configuration")
      .eq("order_id", order.id)
      .eq("enabled", true);

    const { data: files } = await service
      .from("order_files")
      .select("file_type, storage_bucket, storage_path, sort_order, caption")
      .eq("order_id", order.id)
      .eq("status", "uploaded")
      .in("file_type", ["cover", "gallery"])
      .order("sort_order");

    const signedFiles = await Promise.all((files || []).map(async (file: any) => {
      const { data, error: signedError } = await service.storage
        .from(file.storage_bucket)
        .createSignedUrl(file.storage_path, 60 * 60);
      if (signedError || !data?.signedUrl) return null;
      return { fileType: file.file_type, url: data.signedUrl, caption: file.caption || "", sortOrder: file.sort_order };
    }));
    const validFiles = signedFiles.filter(Boolean) as any[];
    const moduleMap: Record<string, any> = {};
    for (const module of modules || []) {
      moduleMap[module.module_code] = { enabled: true, ...(module.configuration || {}) };
    }
    if (moduleMap.surpriseBox) {
      moduleMap.surpriseBox = { ...moduleMap.surpriseBox, displayName: "惊喜盲盒", renderMode: "immersive" };
    }

    return json({
      page: {
        templateId: order.template?.code || "T01",
        templateName: order.template?.name || "",
        palette: order.template?.palette || {},
        recipient: { name: order.recipient_name || "", birthday: order.recipient_birthday || "" },
        sender: { name: order.sender_name || "", anonymous: Boolean(order.sender_anonymous) },
        relationship: order.relationship_type || "",
        content: {
          headline: content?.headline || content?.main_message || "",
          message: content?.long_message || content?.main_message || "",
          signature: content?.signature || ""
        },
        photos: {
          cover: validFiles.find((file) => file.fileType === "cover") || null,
          gallery: validFiles.filter((file) => file.fileType === "gallery")
        },
        modules: moduleMap
      }
    });
  } catch (error) {
    return json({ error: error.message || "无法打开这份生日惊喜。" }, 404);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
