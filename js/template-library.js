(function () {
  "use strict";

  var grid = document.querySelector("#templateLibraryGrid");
  var dialog = document.querySelector("#templateLibraryDialog");
  var preview = document.querySelector("#templateLibraryPreview");
  var info = document.querySelector("#templateLibraryInfo");
  var close = document.querySelector("#closeTemplateLibraryDialog");
  var title = document.querySelector("#libraryTitle");
  var intro = document.querySelector("#libraryIntro");
  var assets = Array.isArray(window.BD_TEMPLATE_ASSETS) ? window.BD_TEMPLATE_ASSETS : [];

  if (title) title.textContent = "11 \u5957\u751f\u65e5\u6a21\u677f\u8d44\u4ea7\u5e93";
  if (intro) intro.textContent = "\u8fd9\u91cc\u662f\u751f\u65e5\u9875\u7684\u6b63\u5f0f\u6a21\u677f\u6e05\u5355\u3002\u6bcf\u5957\u6a21\u677f\u90fd\u6709\u56fa\u5b9a\u7684\u8272\u5f69\u3001\u5b57\u4f53\u6c14\u8d28\u3001\u5c01\u9762\u6784\u56fe\u548c\u529f\u80fd\u5757\u89c4\u5219\uff0c\u53d1\u5e03\u65f6\u4f1a\u8fde\u540c\u7248\u672c\u5feb\u7167\u4e00\u8d77\u4fdd\u5b58\u3002";
  if (!grid) return;

  grid.innerHTML = assets.map(function (asset) {
    var palette = asset.palette || {};
    return '<button type="button" class="template-library-card" data-template-id="' + escapeHtml(asset.legacyId) + '" style="--template-primary:' + escapeHtml(palette.primary || "#ef6f95") + ';--template-bg:' + escapeHtml(palette.background || "#fffdf7") + '">' +
      '<span class="template-library-preview"><img src="' + escapeHtml(asset.previewThumbImage || asset.previewCoverImage) + '" alt="' + escapeHtml(asset.name) + '" loading="lazy" decoding="async" data-fallback="' + escapeHtml(asset.previewCoverImage || "") + '"><b class="template-library-code">' + escapeHtml(asset.legacyId) + '</b>' + (asset.isPremiumTemplate ? '<i class="template-library-premium">\u4f18\u9009</i>' : '') + '</span>' +
      '<span class="template-library-copy"><h2>' + escapeHtml(asset.name) + '</h2><p>' + escapeHtml(asset.description) + '</p><span class="template-library-swatches"><span style="background:' + escapeHtml(palette.primary || "#ef6f95") + '"></span><span style="background:' + escapeHtml(palette.accent || "#2f8be8") + '"></span><span style="background:' + escapeHtml(palette.highlight || "#f7c948") + '"></span></span></span>' +
      '</button>';
  }).join("");

  grid.querySelectorAll("img[data-fallback]").forEach(function (image) {
    image.addEventListener("error", function () {
      var fallback = image.getAttribute("data-fallback");
      if (fallback && image.src.indexOf(fallback) === -1) image.src = fallback;
    }, { once: true });
  });

  grid.addEventListener("click", function (event) {
    var card = event.target.closest("[data-template-id]");
    if (!card) return;
    var id = card.getAttribute("data-template-id");
    var asset = assets.find(function (item) { return item.legacyId === id; });
    if (asset) open(asset);
  });

  if (close) close.addEventListener("click", function () { dialog.close(); });
  if (dialog) dialog.addEventListener("click", function (event) { if (event.target === dialog) dialog.close(); });

  function open(asset) {
    if (!dialog || !preview || !info) return;
    preview.src = asset.previewCoverImage || asset.previewThumbImage;
    preview.alt = asset.name + " \u6a21\u677f\u5927\u56fe\u9884\u89c8";
    preview.onerror = function () { if (asset.previewThumbImage && preview.src.indexOf(asset.previewThumbImage) === -1) preview.src = asset.previewThumbImage; };
    info.innerHTML = '<p class="library-kicker">' + escapeHtml(asset.legacyId) + ' / ' + escapeHtml(asset.category) + '</p><h2>' + escapeHtml(asset.name) + '</h2><p>' + escapeHtml(asset.description) + '</p><p>' + escapeHtml(asset.suitableFor) + '</p><div class="library-meta"><span>\u7248\u672c ' + escapeHtml(asset.version) + '</span><span>' + escapeHtml(asset.coverStyle) + '</span><span>' + escapeHtml(asset.layoutRule) + '</span><span>' + escapeHtml(asset.copyTone) + '</span></div>';
    dialog.showModal();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();