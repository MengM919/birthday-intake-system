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
    if (!orderId) throw new Error("\u7f3a\u5c11\u8ba2\u5355\u7f16\u53f7\u3002");

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, order_number, status, recipient_name, recipient_birthday, sender_name, sender_anonymous, relationship_type, public_slug, template:templates(id,code,name,palette,template_key,template_category,template_version,cover_style,typography,icon_style,module_card_style,button_style,decor_elements,copy_tone,layout_rule,supported_modules,default_scene_assets,preview_cover_image,preview_thumb_image,is_premium_template,template_manifest)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("\u8ba2\u5355\u4e0d\u5b58\u5728\u3002");
    if (!['approved', 'published'].includes(order.status)) {
      throw new Error("\u8bf7\u5148\u5c06\u8ba2\u5355\u6807\u8bb0\u4e3a\u201c\u5df2\u6279\u51c6\u201d\uff0c\u518d\u53d1\u5e03\u751f\u65e5\u9875\u9762\u3002");
    }

    const template = asOne((order as Record<string, unknown>).template) as Record<string, unknown> | null;
    if (!template) throw new Error("\u8ba2\u5355\u8fd8\u6ca1\u6709\u9009\u62e9\u751f\u65e5\u6a21\u677f\u3002");

    const [contentResult, moduleResult, fileResult, versionResult] = await Promise.all([
      service.from("order_content").select("*").eq("order_id", orderId).maybeSingle(),
      service.from("order_modules").select("module_code, enabled, configuration, sort_order").eq("order_id", orderId).order("sort_order"),
      service.from("order_files").select("id, file_type, storage_bucket, storage_path, sort_order, caption, is_featured, featured_sort_order, focal_x, focal_y, crop_data").eq("order_id", orderId).eq("status", "uploaded").order("sort_order"),
      service.from("template_versions").select("id, version, manifest").eq("template_id", String(template.id)).eq("is_current", true).maybeSingle()
    ]);

    if (contentResult.error) throw contentResult.error;
    if (moduleResult.error) throw moduleResult.error;
    if (fileResult.error) throw fileResult.error;
    if (versionResult.error) throw versionResult.error;

    const content = contentResult.data;
    if ((content?.access_mode || "unlisted") !== "unlisted") {
      throw new Error("\u5bc6\u7801\u8bbf\u95ee\u5c1a\u672a\u4e0a\u7ebf\uff0c\u8bf7\u4fdd\u6301\u201c\u4ec5\u901a\u8fc7\u4e13\u5c5e\u94fe\u63a5\u8bbf\u95ee\u201d\u3002");
    }

    const modules = buildModuleMap(moduleResult.data || []);
    const files = (fileResult.data || []).map((file: Record<string, unknown>) => privateFileSnapshot(file));
    const templateAsset = buildTemplateSnapshot(template, versionResult.data || null);
    const slug = String(order.public_slug || randomSlug());
    const base = (Deno.env.get("PUBLIC_BIRTHDAY_BASE_URL") || "https://mengm919.github.io/birthday-intake-system/birthday.html").replace(/\/+$/, "");
    const publishedUrl = `${base}?slug=${encodeURIComponent(slug)}`;
    const birthdayPageConfig = buildBirthdayPageConfig({ order, content, modules, files, templateAsset, slug, publishedUrl });
    const now = new Date().toISOString();

    const { data: generatedPage, error: generatedError } = await service
      .from("generated_pages")
      .upsert({
        order_id: order.id,
        template_id: template.id,
        template_version_id: versionResult.data?.id || null,
        public_slug: slug,
        status: "published",
        config_snapshot: birthdayPageConfig,
        published_url: publishedUrl,
        published_at: now
      }, { onConflict: "order_id" })
      .select("id")
      .single();
    if (generatedError || !generatedPage) throw generatedError || new Error("\u751f\u65e5\u9875\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25\u3002");

    const { error: deleteAssetsError } = await service
      .from("generated_page_assets")
      .delete()
      .eq("generated_page_id", generatedPage.id);
    if (deleteAssetsError) throw deleteAssetsError;

    const assetRows = files
      .filter((file) => file.fileType === "cover" || file.fileType === "gallery")
      .map((file) => ({
        generated_page_id: generatedPage.id,
        source_file_id: file.sourceFileId || null,
        asset_type: file.fileType,
        storage_bucket: file.bucket || null,
        storage_path: file.path || null,
        sort_order: file.sortOrder || 0,
        metadata: {
          caption: file.caption || "",
          isFeatured: Boolean(file.isFeatured),
          featuredSortOrder: file.featuredSortOrder || null,
          focalX: file.focalX,
          focalY: file.focalY,
          cropData: file.cropData || {}
        }
      }));
    if (assetRows.length) {
      const { error: assetsError } = await service.from("generated_page_assets").insert(assetRows);
      if (assetsError) throw assetsError;
    }

    const { error: updateError } = await service
      .from("orders")
      .update({ status: "published", public_slug: slug, published_url: publishedUrl, published_at: now })
      .eq("id", orderId);
    if (updateError) throw updateError;

    const { error: eventError } = await service.from("order_events").insert({
      order_id: orderId,
      event_type: "published",
      actor_user_id: admin.id,
      metadata: {
        publishedUrl,
        publicSlug: slug,
        generatedPageId: generatedPage.id,
        templateId: templateAsset.legacyId,
        templateVersion: templateAsset.version,
        moduleCodes: Object.keys(modules)
      }
    });
    if (eventError) throw eventError;

    return json({ ok: true, publishedUrl, publicSlug: slug, birthdayPageConfig, generatedPageId: generatedPage.id });
  } catch (error) {
    console.error("publish-order failed", error);
    return json({ ok: false, error: message(error) }, 400);
  }
});

function buildModuleMap(rows: Array<Record<string, unknown>>) {
  const modules: Record<string, Record<string, unknown>> = {};
  rows.forEach((row) => {
    if (!row.enabled) return;
    const code = String(row.module_code || "");
    if (!code) return;
    modules[code] = { enabled: true, ...asObject(row.configuration) };
  });
  if (modules.messageWall) {
    modules.messageWall = { ...modules.messageWall, displayName: "\u795d\u798f\u5899", publicMode: true };
  }
  if (modules.surpriseBox) {
    modules.surpriseBox = {
      ...modules.surpriseBox,
      displayName: "\u60ca\u559c\u76f2\u76d2",
      sceneMode: "random_immersive",
      scenePoolVersion: "v1",
      renderMode: "immersive",
      revealStyle: "gift_box"
    };
  }
  if (modules.bgm) {
    modules.bgm = { ...modules.bgm, fixedTrack: "the_walters_i_love_you_so" };
  }
  return modules;
}

function privateFileSnapshot(file: Record<string, unknown>) {
  return {
    sourceFileId: String(file.id || ""),
    fileType: String(file.file_type || "other"),
    bucket: String(file.storage_bucket || ""),
    path: String(file.storage_path || ""),
    caption: String(file.caption || ""),
    sortOrder: Number(file.sort_order || 0),
    isFeatured: Boolean(file.is_featured),
    featuredSortOrder: file.featured_sort_order == null ? null : Number(file.featured_sort_order),
    focalX: file.focal_x == null ? 0.5 : Number(file.focal_x),
    focalY: file.focal_y == null ? 0.5 : Number(file.focal_y),
    cropData: asObject(file.crop_data)
  };
}

function buildTemplateSnapshot(template: Record<string, unknown>, version: Record<string, unknown> | null) {
  const stored = asObject(template.template_manifest);
  const versionManifest = asObject(version?.manifest);
  const base = { ...stored, ...versionManifest } as Record<string, unknown>;
  return {
    ...base,
    templateId: String(base.templateId || template.template_key || template.code || "line_bloom_white"),
    legacyId: String(base.legacyId || template.code || "T01"),
    name: String(base.name || template.name || ""),
    version: String(version?.version || base.version || template.template_version || "1.0.0"),
    category: String(base.category || template.template_category || ""),
    palette: { ...asObject(template.palette), ...asObject(base.palette) },
    coverStyle: String(base.coverStyle || template.cover_style || "freeform_frame"),
    typography: { ...asObject(template.typography), ...asObject(base.typography) },
    iconStyle: String(base.iconStyle || template.icon_style || ""),
    moduleCardStyle: String(base.moduleCardStyle || template.module_card_style || ""),
    buttonStyle: String(base.buttonStyle || template.button_style || ""),
    decorElements: Array.isArray(base.decorElements) ? base.decorElements : asArray(template.decor_elements),
    copyTone: String(base.copyTone || template.copy_tone || ""),
    layoutRule: String(base.layoutRule || template.layout_rule || ""),
    supportedModules: Array.isArray(base.supportedModules) ? base.supportedModules : asArray(template.supported_modules),
    defaultSceneAssets: asObject(base.defaultSceneAssets || template.default_scene_assets),
    previewCoverImage: String(base.previewCoverImage || template.preview_cover_image || ""),
    previewThumbImage: String(base.previewThumbImage || template.preview_thumb_image || ""),
    isPremiumTemplate: Boolean(base.isPremiumTemplate ?? template.is_premium_template)
  };
}

function buildBirthdayPageConfig(input: {
  order: Record<string, unknown>;
  content: Record<string, unknown> | null;
  modules: Record<string, Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
  templateAsset: Record<string, unknown>;
  slug: string;
  publishedUrl: string;
}) {
  const headline = clampHeadline(String(input.content?.headline || input.content?.main_message || ""));
  return {
    schemaVersion: "2026-07-template-library-v1",
    generatedAt: new Date().toISOString(),
    slug: input.slug,
    publishedUrl: input.publishedUrl,
    orderId: input.order.id,
    orderNumber: input.order.order_number,
    templateId: input.templateAsset.legacyId || "T01",
    templateAsset: input.templateAsset,
    recipient: {
      name: String(input.order.recipient_name || ""),
      birthday: input.order.recipient_birthday || ""
    },
    sender: {
      name: String(input.order.sender_name || ""),
      anonymous: Boolean(input.order.sender_anonymous)
    },
    relationship: String(input.order.relationship_type || ""),
    content: {
      headline,
      message: String(input.content?.long_message || input.content?.main_message || ""),
      signature: String(input.content?.signature || ""),
      music: asObject(input.content?.music)
    },
    photos: {
      cover: input.files.find((file) => file.fileType === "cover") || null,
      gallery: input.files.filter((file) => file.fileType === "gallery")
    },
    modules: input.modules,
    privacy: {
      allowShare: input.content?.allow_share ?? true,
      allowIndexing: false,
      pageVisibility: "unlisted"
    }
  };
}

function clampHeadline(value: string) {
  return Array.from(value.trim()).slice(0, 15).join("");
}

function asOne(value: unknown) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function randomSlug() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 20);
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Edge Function \u7f3a\u5c11 Supabase \u670d\u52a1\u7aef\u5bc6\u94a5\u914d\u7f6e\u3002");
  return createClient(url, key);
}

async function requireAdmin(request: Request, service: ReturnType<typeof createClient>) {
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Error("\u8bf7\u5148\u767b\u5f55\u5546\u5bb6\u8d26\u53f7\u3002");
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) throw new Error("\u767b\u5f55\u72b6\u6001\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002");
  const { data: admin } = await service.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) throw new Error("\u5f53\u524d\u8d26\u53f7\u6ca1\u6709\u5546\u5bb6\u6743\u9650\u3002");
  return data.user;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "\u751f\u65e5\u9875\u9762\u53d1\u5e03\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}