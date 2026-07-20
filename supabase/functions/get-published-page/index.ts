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
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(slug)) {
      throw new PublishedPageError("not-found", "\u8fd9\u4efd\u751f\u65e5\u60ca\u559c\u94fe\u63a5\u65e0\u6548\u3002");
    }

    const service = serviceClient();
    const snapshot = await loadSnapshot(service, slug);
    const page = snapshot || await loadLegacyPage(service, slug);
    return json({ ok: true, page });
  } catch (error) {
    const code = publicErrorCode(error);
    console.error("get-published-page failed", { code, message: message(error) });
    return json({ ok: false, code, error: message(error) }, publicErrorStatus(error));
  }
});

async function loadSnapshot(service: ReturnType<typeof createClient>, slug: string) {
  const { data, error } = await service
    .from("generated_pages")
    .select("id, public_slug, status, config_snapshot")
    .eq("public_slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  if (!data) return null;

  const snapshot = asObject(data.config_snapshot);
  if (!snapshot || !Object.keys(snapshot).length) return null;
  return publicPageFromSnapshot(service, snapshot, slug);
}

async function publicPageFromSnapshot(service: ReturnType<typeof createClient>, snapshot: Record<string, unknown>, slug: string) {
  const rawPhotos = asObject(snapshot.photos);
  const galleryRows = Array.isArray(rawPhotos.gallery) ? rawPhotos.gallery : [];
  const cover = await signedPhoto(service, asObject(rawPhotos.cover));
  const gallery = (await Promise.all(galleryRows.map((file) => signedPhoto(service, asObject(file))))).filter(Boolean);
  const content = asObject(snapshot.content);
  const modules = normalizeModules(asObject(snapshot.modules));

  return {
    slug,
    templateId: String(snapshot.templateId || asObject(snapshot.templateAsset).legacyId || "T01"),
    templateAsset: sanitizeTemplateAsset(asObject(snapshot.templateAsset)),
    recipient: cleanPerson(asObject(snapshot.recipient)),
    sender: cleanSender(asObject(snapshot.sender)),
    relationship: String(snapshot.relationship || ""),
    content: {
      headline: clampHeadline(String(content.headline || "")),
      message: String(content.message || ""),
      signature: String(content.signature || ""),
      heroTitleLine1: String(content.heroTitleLine1 || content.hero_title_line_1 || ""),
      heroTitleLine2: String(content.heroTitleLine2 || content.hero_title_line_2 || ""),
      heroSubtitle: String(content.heroSubtitle || content.hero_subtitle || ""),
      senderSignature: String(content.senderSignature || content.sender_signature || ""),
      openCta: String(content.openCta || content.open_cta || ""),
      shareTitle: String(content.shareTitle || content.share_title || ""),
      shareDescription: String(content.shareDescription || content.share_description || ""),
      shareCoverUrl: String(content.shareCoverUrl || content.share_cover_url || ""),
      music: asObject(content.music)
    },
    photos: { cover, gallery },
    modules,
    privacy: { allowShare: Boolean(asObject(snapshot.privacy).allowShare ?? true), allowIndexing: false, pageVisibility: "unlisted" }
  };
}

async function loadLegacyPage(service: ReturnType<typeof createClient>, slug: string) {
  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id, public_slug, status, recipient_name, recipient_birthday, sender_name, sender_anonymous, relationship_type, template:templates(code,name,palette)")
    .eq("public_slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) {
    const status = await orderStatusForSlug(service, slug);
    if (status && status !== "published") {
      throw new PublishedPageError("unpublished", "\u8fd9\u4efd\u751f\u65e5\u60ca\u559c\u8fd8\u5728\u51c6\u5907\u4e2d\u3002");
    }
    throw new PublishedPageError("not-found", "\u6ca1\u6709\u627e\u5230\u8fd9\u4efd\u751f\u65e5\u60ca\u559c\u3002");
  }

  const [contentResult, moduleResult, fileResult] = await Promise.all([
    service.from("order_content").select("headline, main_message, long_message, signature, access_mode, allow_share, music, custom_data").eq("order_id", order.id).maybeSingle(),
    service.from("order_modules").select("module_code, enabled, configuration, sort_order").eq("order_id", order.id).eq("enabled", true).order("sort_order"),
    service.from("order_files").select("file_type, storage_bucket, storage_path, sort_order, caption, is_featured, featured_sort_order, focal_x, focal_y, crop_data").eq("order_id", order.id).eq("status", "uploaded").in("file_type", ["cover", "gallery"]).order("sort_order")
  ]);
  if (contentResult.error) throw contentResult.error;
  if (moduleResult.error) throw moduleResult.error;
  if (fileResult.error) throw fileResult.error;

  const content = contentResult.data;
  const custom = asObject(content?.custom_data);
  if ((content?.access_mode || "unlisted") !== "unlisted") {
    throw new PublishedPageError("render-error", "\u8be5\u9875\u9762\u7684\u8bbf\u95ee\u65b9\u5f0f\u6682\u4e0d\u652f\u6301\u3002");
  }

  const rawFiles = (fileResult.data || []).map((file: Record<string, unknown>) => ({
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
  }));
  const signedFiles = (await Promise.all(rawFiles.map((file) => signedPhoto(service, file)))).filter(Boolean);
  const template = asOne((order as Record<string, unknown>).template) as Record<string, unknown> | null;
  const modules = normalizeModules(buildModuleMap(moduleResult.data || []));

  return {
    slug,
    templateId: String(template?.code || "T01"),
    templateAsset: {
      templateId: String(template?.code || "T01"),
      legacyId: String(template?.code || "T01"),
      name: String(template?.name || ""),
      palette: asObject(template?.palette),
      version: "legacy"
    },
    recipient: { name: String(order.recipient_name || ""), birthday: order.recipient_birthday || "" },
    sender: { name: String(order.sender_name || ""), anonymous: Boolean(order.sender_anonymous) },
    relationship: String(order.relationship_type || ""),
    content: {
      headline: clampHeadline(String(content?.headline || content?.main_message || "")),
      message: String(content?.long_message || content?.main_message || ""),
      signature: String(content?.signature || ""),
      heroTitleLine1: String(custom.heroTitleLine1 || custom.hero_title_line_1 || ""),
      heroTitleLine2: String(custom.heroTitleLine2 || custom.hero_title_line_2 || ""),
      heroSubtitle: String(custom.heroSubtitle || custom.hero_subtitle || ""),
      senderSignature: String(custom.senderSignature || custom.sender_signature || ""),
      openCta: String(custom.openCta || custom.open_cta || ""),
      shareTitle: String(custom.shareTitle || custom.share_title || ""),
      shareDescription: String(custom.shareDescription || custom.share_description || ""),
      shareCoverUrl: String(custom.shareCoverUrl || custom.share_cover_url || ""),
      music: asObject(content?.music)
    },
    photos: {
      cover: signedFiles.find((file) => file?.fileType === "cover") || null,
      gallery: signedFiles.filter((file) => file?.fileType === "gallery")
    },
    modules,
    privacy: { allowShare: content?.allow_share ?? true, allowIndexing: false, pageVisibility: "unlisted" }
  };
}

async function signedPhoto(service: ReturnType<typeof createClient>, file: Record<string, unknown>) {
  const bucket = String(file.bucket || "");
  const path = String(file.path || "");
  if (!bucket || !path) return null;
  const { data, error } = await service.storage.from(bucket).createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) {
    console.warn("Could not sign birthday page asset");
    return null;
  }
  return {
    fileType: String(file.fileType || "other"),
    url: data.signedUrl,
    caption: String(file.caption || ""),
    sortOrder: Number(file.sortOrder || 0),
    isFeatured: Boolean(file.isFeatured),
    featuredSortOrder: file.featuredSortOrder == null ? null : Number(file.featuredSortOrder),
    focalX: file.focalX == null ? 0.5 : Number(file.focalX),
    focalY: file.focalY == null ? 0.5 : Number(file.focalY),
    cropData: asObject(file.cropData)
  };
}

function buildModuleMap(rows: Array<Record<string, unknown>>) {
  const modules: Record<string, Record<string, unknown>> = {};
  rows.forEach((row) => {
    if (!row.enabled) return;
    const code = String(row.module_code || "");
    if (code) modules[code] = { enabled: true, ...asObject(row.configuration) };
  });
  return modules;
}

function normalizeModules(input: Record<string, unknown>) {
  const modules: Record<string, Record<string, unknown>> = {};
  Object.keys(input).forEach((code) => {
    const config = asObject(input[code]);
    if (config.enabled === false) return;
    modules[code] = { enabled: true, ...config };
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
  if (modules.bgm) modules.bgm = { ...modules.bgm, fixedTrack: "the_walters_i_love_you_so" };
  return modules;
}

function sanitizeTemplateAsset(asset: Record<string, unknown>) {
  return {
    templateId: String(asset.templateId || asset.legacyId || "line_bloom_white"),
    legacyId: String(asset.legacyId || "T01"),
    name: String(asset.name || ""),
    version: String(asset.version || "1.0.0"),
    category: String(asset.category || ""),
    palette: asObject(asset.palette),
    coverStyle: String(asset.coverStyle || "freeform_frame"),
    typography: asObject(asset.typography),
    iconStyle: String(asset.iconStyle || ""),
    moduleCardStyle: String(asset.moduleCardStyle || ""),
    buttonStyle: String(asset.buttonStyle || ""),
    decorElements: Array.isArray(asset.decorElements) ? asset.decorElements : [],
    copyTone: String(asset.copyTone || ""),
    layoutRule: String(asset.layoutRule || ""),
    supportedModules: Array.isArray(asset.supportedModules) ? asset.supportedModules : [],
    isPremiumTemplate: Boolean(asset.isPremiumTemplate),
    layout: asObject(asset.layout),
    visual: asObject(asset.visual),
    copy: asObject(asset.copy),
    moduleVariants: asObject(asset.moduleVariants)
  };
}

function cleanPerson(person: Record<string, unknown>) {
  return { name: String(person.name || ""), birthday: String(person.birthday || "") };
}

function cleanSender(sender: Record<string, unknown>) {
  return { name: String(sender.name || ""), anonymous: Boolean(sender.anonymous) };
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

type PublicPageErrorCode = "not-found" | "unpublished" | "render-error" | "network-error";

class PublishedPageError extends Error {
  constructor(public code: PublicPageErrorCode, message: string) {
    super(message);
    this.name = "PublishedPageError";
  }
}

async function orderStatusForSlug(service: ReturnType<typeof createClient>, slug: string) {
  const { data, error } = await service
    .from("orders")
    .select("status")
    .eq("public_slug", slug)
    .maybeSingle();
  if (error) throw error;
  return String(data?.status || "");
}

function publicErrorCode(error: unknown): PublicPageErrorCode {
  return error instanceof PublishedPageError ? error.code : "network-error";
}

function publicErrorStatus(error: unknown) {
  if (!(error instanceof PublishedPageError)) return 503;
  if (error.code === "not-found") return 404;
  if (error.code === "unpublished") return 409;
  if (error.code === "network-error") return 503;
  return 422;
}
function isMissingTable(error: unknown) {
  const info = error as { code?: string; message?: string };
  return info?.code === "42P01" || info?.code === "PGRST205" || /generated_pages/i.test(String(info?.message || "")) && /schema cache|does not exist/i.test(String(info?.message || ""));
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("\u751f\u65e5\u9875\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\u3002");
  return createClient(url, key);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "\u6682\u65f6\u65e0\u6cd5\u6253\u5f00\u8fd9\u4efd\u751f\u65e5\u60ca\u559c\u3002";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}