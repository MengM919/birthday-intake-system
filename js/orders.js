(function () {
  "use strict";

  window.BirthdayOrders = {
    async claimOrder(orderNumber, token) {
      const client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) throw new Error("Supabase 未启用，当前仍为本地演示模式。");
      const { data, error } = await client.functions.invoke("claim-order", {
        body: { orderNumber, token }
      });
      if (error) throw error;
      return data;
    },
    async submitOrder(orderId) {
      const client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) throw new Error("Supabase 未启用，当前仍为本地演示模式。");
      const { data, error } = await client.functions.invoke("submit-order", {
        body: { orderId }
      });
      if (error) throw error;
      return data;
    }
  };
})();
