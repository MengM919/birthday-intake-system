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

    const { data: files, error: fileError } = await service.from("order_files").select("storage_bucket, storage_path").eq("order_id", orderId);
    if (fileError) throw fileError;
    const grouped = new Map<string, string[]>();
    for (const file of files || []) {
      if (!grouped.has(file.storage_bucket)) grouped.set(file.storage_bucket, []);
      grouped.get(file.storage_bucket)!.push(file.storage_path);
    }
    for (const [bucket, paths] of grouped.entries()) {
      if (paths.length) await service.storage.from(bucket).remove(paths);
    }

    await service.from("order_events").insert({ order_id: orderId, event_type: "deleted", actor_user_id: admin.id });
    const { error } = await service.from("orders").delete().eq("id", orderId);
    if (error) throw error;
    return json({ ok: true, deletedOrderId: orderId, removedFiles: files?.length || 0 });
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
