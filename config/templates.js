(function () {
  "use strict";

  var assets = Array.isArray(window.BD_TEMPLATE_ASSETS) ? window.BD_TEMPLATE_ASSETS : [];
  var fallback = [
    { legacyId: "T01", templateId: "line_bloom_white", name: "\u6674\u65e5\u624b\u7ed8", description: "\u6e05\u65b0\u624b\u7ed8\u98ce\u7684\u751f\u65e5\u795d\u798f\u3002", previewThumbImage: "assets/templates/T01/preview.webp", previewCoverImage: "assets/templates/T01/preview.png", category: "line_art", suitableFor: "\u6e05\u65b0\u795d\u798f" }
  ];
  var source = assets.length ? assets : fallback;

  window.BD_TEMPLATES = source.map(function (asset) {
    return {
      id: asset.legacyId || asset.code,
      assetId: asset.templateId || asset.legacyId || asset.code,
      name: asset.name || asset.templateName || asset.legacyId,
      category: asset.category || "birthday",
      tags: Array.isArray(asset.decorElements) ? asset.decorElements : [],
      description: asset.description || "\u4e3a TA \u51c6\u5907\u7684\u751f\u65e5\u9875\u9762\u3002",
      suitableFor: asset.suitableFor || "\u751f\u65e5\u795d\u798f",
      version: asset.version || "1.0.0",
      premium: Boolean(asset.isPremiumTemplate),
      palette: asset.palette || {},
      previewImage: asset.previewThumbImage || asset.previewCoverImage,
      fullPreviewImage: asset.previewCoverImage || asset.previewThumbImage
    };
  });
})();