(function () {
  "use strict";

  window.BD_SUPABASE_CONFIG = window.BD_SUPABASE_CONFIG || {
    enabled: false,
    url: "",
    publishableKey: "",
    privateBucket: "birthday-order-private",
    publishedBucket: "birthday-published-assets"
  };

  window.BirthdaySupabase = {
    isEnabled() {
      const config = window.BD_SUPABASE_CONFIG;
      return Boolean(config && config.enabled && config.url && config.publishableKey && window.supabase);
    },
    getClient() {
      if (!this.isEnabled()) return null;
      if (!this.client) {
        this.client = window.supabase.createClient(
          window.BD_SUPABASE_CONFIG.url,
          window.BD_SUPABASE_CONFIG.publishableKey
        );
      }
      return this.client;
    }
  };
})();
