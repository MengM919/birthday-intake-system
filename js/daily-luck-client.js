(function () {
  "use strict";

  async function getDailyLuck(birthday) {
    var client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
    if (!client) throw new Error("今日好运服务暂时不可用，请稍后再试。");

    var result = await client.functions.invoke("daily-luck", { body: { birthday: birthday } });
    if (result.error) throw new Error(result.error.message || "今日好运服务暂时不可用，请稍后再试。");
    if (!result.data || result.data.ok === false || result.data.error) {
      throw new Error((result.data && result.data.error) || "今日好运服务暂时不可用，请稍后再试。");
    }
    return result.data;
  }

  window.BirthdayDailyLuck = { getDailyLuck: getDailyLuck };
})();