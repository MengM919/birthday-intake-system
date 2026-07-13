(function () {
  "use strict";

  window.BirthdayAuth = {
    async ensureAnonymousSession() {
      const client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) return { user: null, session: null, offline: true };
      const { data: existing } = await client.auth.getSession();
      if (existing && existing.session) return { user: existing.session.user, session: existing.session };
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      return { user: data.user, session: data.session };
    }
  };
})();
