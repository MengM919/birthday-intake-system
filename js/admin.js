(function () {
  "use strict";

  window.BirthdayAdmin = {
    async requireAdmin() {
      const client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) throw new Error("Supabase 未启用，当前后台仍为本地演示模式。");
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const userId = userData && userData.user && userData.user.id;
      if (!userId) throw new Error("请先登录商家账号。");
      const { data, error } = await client.from("admin_users").select("user_id, role").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("当前账号没有商家后台权限。");
      return data;
    }
  };
})();
