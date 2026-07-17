(function () {
  "use strict";

  function chars(value) { return Array.from(String(value || "")); }
  function limit(value, max) { return chars(value).slice(0, max).join(""); }
  function clean(value) { return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim(); }

  function relationWord(type) {
    return ({ lover: "\u5fc3\u4e0a\u4eba", best_friend: "\u6700\u8bcd\u61c2\u7684\u4eba", friend: "\u597d\u670b\u53cb", classmate: "\u540c\u8def\u7684\u4eba", family: "\u5bb6\u4eba" })[type] || "\u91cd\u8981\u7684\u4eba";
  }

  function headlineOptions(name, tone) {
    var safeName = clean(name) || "TA";
    var options = {
      warm: ["\u613f" + safeName + "\u65b0\u5c81\u5e73\u5b89\u53c8\u660e\u4eae", "\u4eca\u5929\u7684\u504f\u7231\u90fd\u7ed9" + safeName, safeName + "\uff0c\u8bf7\u4e00\u76f4\u88ab\u597d\u597d\u7231\u7740"],
      bright: [safeName + "\u4eca\u5929\u53ea\u7ba1\u5f00\u5fc3", "\u4e3a" + safeName + "\u6536\u96c6\u4eca\u65e5\u5feb\u4e50", safeName + "\u7684\u65b0\u5c81\u95ea\u95ea\u53d1\u5149"],
      romantic: ["\u4eca\u5929\u7684\u6d6a\u6f2b\u90fd\u5c5e\u4e8e" + safeName, "\u613f" + safeName + "\u88ab\u53ef\u7231\u5305\u56f4", safeName + "\uff0c\u4eca\u5e74\u4e5f\u8bf7\u8086\u610f\u5f00\u5fc3"],
      sincere: ["\u613f" + safeName + "\u65b0\u5c81\u987a\u9042\u65e0\u5fe7", "\u4e3a" + safeName + "\u7559\u4e0b\u8ba4\u771f\u795d\u798f", safeName + "\uff0c\u613f\u4f60\u5fc3\u91cc\u6709\u5149"]
    };
    return (options[tone] || options.warm).map(function (text) { return limit(text, 15); });
  }

  function generate(input) {
    var name = clean(input && input.name) || "TA";
    var facts = clean(input && input.facts);
    var tone = input && input.tone || "warm";
    var relation = relationWord(input && input.relationship);
    return headlineOptions(name, tone).map(function (headline, index) {
      var supporting = facts
        ? "\u5e0c\u671b\u90a3\u4e9b\u5173\u4e8e\u4f60\u4eec\u7684\u5c0f\u4e8b\uff0c\u4f1a\u4e00\u76f4\u5728\u65b0\u5c81\u91cc\u7ee7\u7eed\u53d1\u5149\u3002"
        : "\u8fd9\u4efd\u795d\u798f\uff0c\u60f3\u5e2e\u4f60\u628a\u4eca\u5929\u7684\u5feb\u4e50\u591a\u6536\u85cf\u4e00\u4f1a\u513f\u3002";
      var openings = [
        "\u4e00\u8def\u8d70\u6765\uff0c\u4f60\u662f\u6211\u5fc3\u91cc\u5f88\u91cd\u8981\u7684" + relation + "\u3002",
        "\u65b0\u5c81\u5f00\u59cb\u7684\u8fd9\u4e00\u523b\uff0c\u5f88\u60f3\u8ba9\u4f60\u77e5\u9053\uff1a\u4f60\u503c\u5f97\u88ab\u597d\u597d\u5e86\u795d\u3002",
        "\u4eca\u5929\u4e0d\u7528\u52aa\u529b\u6210\u4e3a\u8c01\uff0c\u505a\u90a3\u4e2a\u88ab\u7231\u7740\u7684\u81ea\u5df1\u5c31\u597d\u3002"
      ];
      return { headline: headline, message: openings[index] + supporting };
    });
  }

  function polish(input) {
    var original = clean(input && input.text);
    var name = clean(input && input.name) || "TA";
    if (!original) return [];
    var compact = original.replace(/[。！？!?]+$/g, "");
    return [
      { headline: limit("\u613f" + name + "\u4eca\u5929\u5f88\u5f00\u5fc3", 15), message: compact + "\u3002\u8fd9\u4efd\u5fc3\u610f\uff0c\u60f3\u966a\u4f60\u628a\u4eca\u5929\u8fc7\u5f97\u6162\u4e00\u70b9\u3002" },
      { headline: limit("\u4eca\u5929\u7684\u504f\u7231\u90fd\u7ed9" + name, 15), message: "\u60f3\u628a\u8fd9\u53e5\u8bdd\u7559\u7ed9\u4f60\uff1a" + compact + "\u3002\u65b0\u5c81\u4e5f\u8bf7\u7ee7\u7eed\u53ef\u7231\u53c8\u81ea\u5728\u3002" },
      { headline: limit(name + "\uff0c\u65b0\u5c81\u8bf7\u95ea\u95ea\u53d1\u5149", 15), message: compact + "\u3002\u4e0d\u7528\u8bf4\u5f97\u592a\u6f02\u4eae\uff0c\u4f60\u77e5\u9053\u8fd9\u662f\u6211\u8ba4\u771f\u60f3\u5bf9\u4f60\u8bf4\u7684\u5c31\u597d\u3002" }
    ];
  }

  window.BirthdayBlessingHelper = { generate: generate, polish: polish, limit: limit };
})();