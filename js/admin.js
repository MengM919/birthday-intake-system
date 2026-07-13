(function () {
  "use strict";

  function getClient() {
    const client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  }

  async function requireAdmin() {
    const client = getClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    const userId = userData && userData.user && userData.user.id;
    if (!userId) throw new Error("Please sign in with the merchant account first.");
    const { data, error } = await client
      .from("admin_users")
      .select("user_id, role, display_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("This account does not have merchant access.");
    return data;
  }

  async function signIn(email, password) {
    const client = getClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return requireAdmin();
  }

  async function signOut() {
    const client = getClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  window.BirthdayAdmin = {
    requireAdmin,
    signIn,
    signOut
  };
})();