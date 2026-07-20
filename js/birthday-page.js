(function () {
  "use strict";

  var root = document.querySelector("#birthdayPage");
  var slug = new URLSearchParams(window.location.search).get("slug");
  var countdownTimer = 0;
  var pageData = null;
  var pageAsset = null;

  var fallbackAsset = {
    templateId: "line_bloom_white",
    legacyId: "T01",
    name: "\u6674\u65e5\u624b\u7ed8",
    palette: { primary: "#ef6f95", accent: "#2f8be8", background: "#fffdf7", ink: "#27221f", soft: "#fff5eb", highlight: "#f7c948" },
    typography: { display: "handwritten" },
    coverStyle: "freeform_frame",
    layoutRule: "airy_split",
    buttonStyle: "sketch_pill",
    moduleCardStyle: "outlined_paper",
    decorElements: ["sparkle", "bloom", "ribbon"],
    copyTone: "bright_warm"
  };

  var moduleLabels = {
    gallery: "\u56de\u5fc6\u76f8\u518c",
    messageWall: "\u795d\u798f\u5899",
    wishBottle: "\u8bb8\u613f\u74f6",
    futureMailbox: "\u672a\u6765\u4fe1\u7bb1",
    dailyLuck: "\u4eca\u65e5\u597d\u8fd0",
    surpriseBox: "\u60ca\u559c\u76f2\u76d2",
    bgm: "\u80cc\u666f\u97f3\u4e50",
    countdown: "\u751f\u65e5\u5012\u8ba1\u65f6"
  };

  if (!root) return;
  if (!slug) {
    fail("\u8fd9\u4efd\u751f\u65e5\u60ca\u559c\u94fe\u63a5\u7f3a\u5c11\u8bbf\u95ee\u51ed\u8bc1\u3002");
    return;
  }
  void load();

  async function load() {
    try {
      var client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) throw new Error("\u751f\u65e5\u9875\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\u3002");
      var response = await client.functions.invoke("get-published-page", { body: { slug: slug } });
      if (response.error) throw await functionError(response.error, "\u6682\u65f6\u65e0\u6cd5\u6253\u5f00\u8fd9\u4efd\u751f\u65e5\u60ca\u559c\u3002");
      if (!response.data || response.data.ok === false || !response.data.page) {
        throw new Error(response.data && response.data.error || "\u6682\u65f6\u65e0\u6cd5\u6253\u5f00\u8fd9\u4efd\u751f\u65e5\u60ca\u559c\u3002");
      }
      draw(response.data.page);
    } catch (error) {
      console.error("Published birthday page load failed:", error);
      fail(error && error.message || "\u6682\u65f6\u65e0\u6cd5\u6253\u5f00\u8fd9\u4efd\u751f\u65e5\u60ca\u559c\u3002");
    }
  }

  async function functionError(error, fallback) {
    var response = error && error.context;
    if (response && typeof response.clone === "function") {
      try {
        var data = await response.clone().json();
        if (data && data.error) return new Error(String(data.error));
      } catch (ignore) {
        // The regular Supabase error is still useful below.
      }
    }
    return new Error(error && error.message || fallback);
  }

  function draw(page) {
    pageData = page;
    pageAsset = resolveAsset(page);
    var palette = pageAsset.palette || fallbackAsset.palette;
    var recipient = page.recipient || {};
    var sender = page.sender || {};
    var content = page.content || {};
    var modules = page.modules || {};
    var gallery = Array.isArray(page.photos && page.photos.gallery) ? page.photos.gallery.slice() : [];
    var orderedGallery = orderGallery(gallery);
    var name = String(recipient.name || "TA").trim() || "TA";
    var headline = cleanHeadline(content.headline || defaultHeadline(name));

    document.title = name + "\u7684\u751f\u65e5\u60ca\u559c";
    applyThemeVariables(palette);

    root.innerHTML =
      '<main class="birthday-shell theme-' + escapeHtml(pageAsset.legacyId || page.templateId || "T01") + ' asset-' + escapeHtml(pageAsset.templateId || "line_bloom_white") + ' tone-' + escapeHtml(pageAsset.copyTone || "bright_warm") + '" data-layout="' + escapeHtml(pageAsset.layoutRule || "airy_split") + '" data-cover-style="' + escapeHtml(pageAsset.coverStyle || "freeform_frame") + '">' +
        renderDecorations(pageAsset) +
        '<section class="birthday-hero" id="top">' +
          '<nav class="top-feature-dock" aria-label="\u751f\u65e5\u9875\u5feb\u901f\u5bfc\u822a">' + renderFeatureButtons(modules, orderedGallery.length > 0) + '</nav>' +
          '<div class="hero-layout">' +
            '<div class="hero-copy">' +
              '<p class="hero-eyebrow">' + escapeHtml(heroEyebrow(pageAsset, name)) + '</p>' +
              headlineMarkup(headline, pageAsset) +
              '<p class="hero-message">' + escapeHtml(content.message || defaultMessage(name)) + '</p>' +
              '<p class="hero-signature">' + renderSignature(sender, content) + '</p>' +
            '</div>' +
            renderCover(page.photos && page.photos.cover, name, pageAsset) +
          '</div>' +
        '</section>' +
        renderCountdown() +
        '<div class="page-sections">' +
          (orderedGallery.length ? renderAlbum(orderedGallery) : "") +
          (modules.messageWall ? renderWall() : "") +
          (modules.wishBottle ? renderWishBottle(modules.wishBottle) : "") +
          (modules.futureMailbox ? renderFutureMailbox(modules.futureMailbox) : "") +
          (modules.dailyLuck ? renderDailyLuckModule() : "") +
          (modules.surpriseBox ? renderSurpriseBox() : "") +
          (modules.bgm ? renderMusicModule() : "") +
        '</div>' +
        '<footer class="birthday-footer"><span class="footer-spark" aria-hidden="true"></span><p>\u4eca\u5929\u7684\u5feb\u4e50\uff0c\u6709\u4eba\u8ba4\u771f\u5730\u66ff\u4f60\u6536\u597d\u4e86\u3002</p></footer>' +
      '</main>';

    bindPageEvents(page, pageAsset, name);
    startCountdown(recipient.birthday);
    renderSavedWishes();
    if (modules.messageWall && window.BirthdayPublicWall) {
      void window.BirthdayPublicWall.mount({ slug: slug, root: document.querySelector("#publicBlessingWall") });
    }
    if (modules.dailyLuck && window.BirthdayDailyLuck) {
      void renderDailyLuck(recipient.birthday);
    }
  }

  function resolveAsset(page) {
    var requested = page.templateAsset || {};
    var finder = window.BD_TEMPLATE_ASSET_BY_ID;
    var match = typeof finder === "function" && finder(requested.templateId || requested.legacyId || page.templateId);
    var current = match || (Array.isArray(window.BD_TEMPLATE_ASSETS) && window.BD_TEMPLATE_ASSETS.find(function (asset) {
      return asset.legacyId === page.templateId || asset.templateId === page.templateId;
    })) || fallbackAsset;
    var palette = Object.assign({}, fallbackAsset.palette, current.palette || {}, page.palette || {}, requested.palette || {});
    return Object.assign({}, fallbackAsset, current, requested, { palette: palette });
  }

  function applyThemeVariables(palette) {
    var variables = {
      "--birthday-primary": palette.primary || fallbackAsset.palette.primary,
      "--birthday-accent": palette.accent || fallbackAsset.palette.accent,
      "--birthday-bg": palette.background || fallbackAsset.palette.background,
      "--birthday-ink": palette.ink || fallbackAsset.palette.ink,
      "--birthday-soft": palette.soft || fallbackAsset.palette.soft,
      "--birthday-highlight": palette.highlight || fallbackAsset.palette.highlight
    };
    Object.keys(variables).forEach(function (key) { document.documentElement.style.setProperty(key, variables[key]); });
  }

  function renderDecorations(asset) {
    var elements = Array.isArray(asset.decorElements) ? asset.decorElements : [];
    return '<div class="template-decor" aria-hidden="true">' + elements.map(function (element, index) {
      return '<span class="decor decor-' + escapeHtml(element) + ' decor-' + (index + 1) + '"></span>';
    }).join("") + '</div>';
  }

  function renderFeatureButtons(modules, hasGallery) {
    var entries = ["countdown"];
    if (hasGallery) entries.push("gallery");
    ["messageWall", "wishBottle", "futureMailbox", "dailyLuck", "surpriseBox", "bgm"].forEach(function (code) {
      if (modules[code]) entries.push(code);
    });
    return entries.map(function (code) {
      var target = code === "gallery" ? "#gallery" : code === "countdown" ? "#countdown" : "#module-" + code;
      return '<button type="button" data-scroll="' + target + '">' + escapeHtml(moduleLabels[code] || code) + '</button>';
    }).join("");
  }

  function headlineMarkup(headline, asset) {
    var pieces = splitHeadline(headline);
    return '<h1 class="hero-headline headline-' + escapeHtml(asset.typography && asset.typography.display || "handwritten") + '">' + pieces.map(function (piece) {
      return '<span>' + escapeHtml(piece) + '</span>';
    }).join("") + '</h1>';
  }

  function splitHeadline(value) {
    var chars = Array.from(value || "");
    if (chars.length <= 8) return [chars.join("")];
    var pivot = chars.length > 12 ? 6 : Math.ceil(chars.length / 2);
    return [chars.slice(0, pivot).join(""), chars.slice(pivot).join("")];
  }

  function renderCover(photo, name, asset) {
    if (!photo || !photo.url) {
      return '<figure class="hero-photo placeholder-photo"><div class="placeholder-shape"></div><figcaption>\u4eca\u5929\u7684\u4e3b\u89d2\uff0c\u6b63\u5728\u7b49\u5f85\u51fa\u573a\u3002</figcaption></figure>';
    }
    var x = clamp(Number(photo.focalX == null ? 0.5 : photo.focalX), 0, 1) * 100;
    var y = clamp(Number(photo.focalY == null ? 0.5 : photo.focalY), 0, 1) * 100;
    return '<figure class="hero-photo" style="--focal-x:' + x + '%;--focal-y:' + y + '%" data-cover-shape="' + escapeHtml(asset.coverStyle || "freeform_frame") + '">' +
      '<span class="portrait-aura" aria-hidden="true"></span>' +
      '<img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(name) + '\u7684\u751f\u65e5\u5c01\u9762\u7167" referrerpolicy="no-referrer">' +
      '<span class="portrait-corner portrait-corner-a" aria-hidden="true"></span><span class="portrait-corner portrait-corner-b" aria-hidden="true"></span>' +
    '</figure>';
  }

  function renderCountdown() {
    return '<section id="countdown" class="countdown-section"><div class="countdown-title"><span class="cake-mark" aria-hidden="true">&#127874;</span><p>\u8ddd\u79bb\u4e0b\u4e00\u6b21\u751f\u65e5\u8fd8\u6709</p><span class="countdown-spark" aria-hidden="true"></span></div><div id="birthdayCountdown" class="countdown-grid" aria-live="polite"></div></section>';
  }

  function renderAlbum(photos) {
    var pages = chunk(photos, 8);
    return '<section id="gallery" class="content-section album-section"><div class="section-heading"><div><p class="section-kicker">\u628a\u77ac\u95f4\u6536\u597d</p><h2>\u56de\u5fc6\u76f8\u518c</h2><p>\u6709\u4e9b\u77ac\u95f4\uff0c\u503c\u5f97\u88ab\u597d\u597d\u88c5\u8fdb\u8fd9\u4e00\u9875\u3002</p></div><span class="section-stamp" aria-hidden="true">\u4e3a\u4f60\u7559\u4f4f<br>\u8fd9\u4e9b\u77ac\u95f4</span></div>' +
      '<div class="album-carousel" data-gallery-carousel>' + pages.map(function (group, pageIndex) {
        return '<div class="polaroid-gallery gallery-page" data-gallery-page="' + pageIndex + '">' + group.map(function (photo, index) {
          return photoCard(photo, pageIndex * 8 + index);
        }).join("") + '</div>';
      }).join("") + '</div>' +
      (pages.length > 1 ? '<div class="gallery-pagination"><button type="button" class="gallery-page-button" data-gallery-prev>\u4e0a\u4e00\u7ec4</button><span data-gallery-page-status>1 / ' + pages.length + '</span><button type="button" class="gallery-page-button" data-gallery-next>\u4e0b\u4e00\u7ec4</button></div>' : "") +
    '</section>';
  }

  function photoCard(photo, index) {
    var defaultCaptions = ["\u8fd9\u4e00\u5929\u5f88\u4eae", "\u6211\u4eec\u5728\u4e00\u8d77", "\u7559\u4f4f\u5c0f\u5c0f\u5feb\u4e50", "\u628a\u8fd9\u4e00\u523b\u6536\u597d", "\u5f88\u9ad8\u5174\u6709\u4f60", "\u8fd9\u4e00\u5f20\u6700\u820d\u4e0d\u5f97\u5220", "\u4eca\u5929\u4e5f\u8981\u7b11\u5440", "\u751f\u65e5\u5feb\u4e50\u5440"];
    var caption = String(photo.caption || defaultCaptions[index % defaultCaptions.length]);
    return '<figure class="polaroid polaroid-' + (index % 6) + '"><img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(caption) + '" loading="lazy" referrerpolicy="no-referrer"><figcaption>' + escapeHtml(caption) + '</figcaption></figure>';
  }

  function renderWall() {
    return '<section id="module-messageWall" class="content-section wall-section"><div id="publicBlessingWall"></div></section>';
  }

  function renderWishBottle(config) {
    var title = config && config.title || "\u8bb8\u613f\u74f6";
    var prompt = config && config.prompt || "\u5199\u4e0b\u4e00\u53e5\u5fc3\u613f\uff0c\u628a\u5b83\u8f7b\u8f7b\u653e\u8fdb\u751f\u65e5\u8fd9\u5929\u3002";
    return '<section id="module-wishBottle" class="content-section module-section wish-section"><div class="section-heading"><div><p class="section-kicker">\u628a\u613f\u671b\u653e\u8fdb\u4eca\u5929</p><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(prompt) + '</p></div><span class="module-doodle doodle-bottle" aria-hidden="true"></span></div><div class="wish-preview" data-wish-list></div><button type="button" class="warm-action" data-wish>\u5199\u4e00\u4e2a\u5c0f\u5fc3\u613f</button></section>';
  }

  function renderFutureMailbox(config) {
    return '<section id="module-futureMailbox" class="content-section module-section future-section"><div class="section-heading"><div><p class="section-kicker">\u7559\u7ed9\u672a\u6765\u7684\u4fe1</p><h2>\u672a\u6765\u4fe1\u7bb1</h2><p>\u6709\u4e00\u5c01\u4fe1\uff0c\u60f3\u7559\u7ed9\u672a\u6765\u7684\u4f60\u6162\u6162\u6253\u5f00\u3002</p></div><span class="module-doodle doodle-letter" aria-hidden="true"></span></div><div class="future-letter" data-future-letter data-open-date="' + escapeHtml(config && config.openDate || "") + '" data-letter="' + escapeHtml(config && config.content || "") + '"></div></section>';
  }

  function renderDailyLuckModule() {
    return '<section id="module-dailyLuck" class="content-section module-section luck-section"><div class="section-heading"><div><p class="section-kicker">\u4eca\u5929\u4e5f\u6709\u5c0f\u597d\u8fd0</p><h2>\u4eca\u65e5\u597d\u8fd0</h2><p>\u4eca\u5929\u7684\u661f\u8c61\u548c\u5c0f\u798f\u6c14\uff0c\u60f3\u5b89\u9759\u5730\u966a\u5728\u4f60\u8eab\u8fb9\u3002</p></div><span class="module-doodle doodle-star" aria-hidden="true"></span></div><div id="dailyLuckContent" class="daily-luck-content"><p>\u6b63\u5728\u4e3a TA \u6536\u96c6\u4eca\u5929\u7684\u5c0f\u5e78\u8fd0\u2026</p></div></section>';
  }

  function renderSurpriseBox() {
    return '<section id="module-surpriseBox" class="content-section module-section surprise-section"><div class="section-heading"><div><p class="section-kicker">\u7559\u7ed9\u4f60\u7684\u60ca\u559c</p><h2>\u60ca\u559c\u76f2\u76d2</h2><p>\u8fd9\u53ea\u793c\u76d2\u91cc\uff0c\u85cf\u7740\u4e00\u4efd\u53ea\u5c5e\u4e8e\u4eca\u5929\u7684\u6e29\u67d4\u60ca\u559c\u3002</p></div><span class="module-doodle doodle-gift" aria-hidden="true"></span></div><button type="button" class="gift-box-control" data-surprise aria-label="\u6253\u5f00\u60ca\u559c\u76f2\u76d2"><span class="gift-box-illustration" aria-hidden="true"><i></i><b></b><em></em></span><span><strong>\u6253\u5f00\u793c\u76d2</strong><small>\u6536\u4e0b\u4eca\u5929\u7684\u5c0f\u60ca\u559c</small></span></button></section>';
  }

  function renderMusicModule() {
    return '<section id="module-bgm" class="content-section music-section"><span class="music-note" aria-hidden="true"></span><div><p class="section-kicker">\u8fd9\u4e00\u9996\uff0c\u9001\u7ed9\u4f60</p><h2>\u4e00\u9996\u6e29\u67d4\u7684\u751f\u65e5\u6b4c</h2><p>\u8f7b\u8f7b\u70b9\u4e00\u4e0b\u9875\u9762\uff0c\u65cb\u5f8b\u5c31\u4f1a\u6162\u6162\u54cd\u8d77\u3002</p></div></section>';
  }

  function bindPageEvents(page, asset, name) {
    root.addEventListener("click", function (event) {
      var target = event.target.closest("[data-scroll]");
      if (target) {
        var section = document.querySelector(target.dataset.scroll);
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (event.target.closest("[data-gallery-prev]")) return moveGallery(-1);
      if (event.target.closest("[data-gallery-next]")) return moveGallery(1);
      if (event.target.closest("[data-wish]")) return openWishComposer();
      if (event.target.closest("[data-surprise]") && window.openSurpriseExperience) {
        var config = Object.assign({}, page.modules && page.modules.surpriseBox || {}, { pageKey: page.slug || slug, recipientName: name });
        window.openSurpriseExperience(config, {
          templateId: asset.legacyId || page.templateId,
          templateAssetId: asset.templateId,
          primaryColor: asset.palette.primary,
          accentColor: asset.palette.accent,
          backgroundColor: asset.palette.background,
          inkColor: asset.palette.ink,
          highlightColor: asset.palette.highlight
        });
      }
    });
    var future = root.querySelector("[data-future-letter]");
    if (future) renderFutureLetter(future);
  }

  function moveGallery(direction) {
    var carousel = root.querySelector("[data-gallery-carousel]");
    if (!carousel) return;
    var pages = Array.prototype.slice.call(carousel.querySelectorAll("[data-gallery-page]"));
    var width = carousel.clientWidth || 1;
    var current = Math.round(carousel.scrollLeft / width);
    var next = clamp(current + direction, 0, pages.length - 1);
    carousel.scrollTo({ left: next * width, behavior: "smooth" });
    window.setTimeout(function () { updateGalleryStatus(carousel, pages.length); }, 260);
  }

  function updateGalleryStatus(carousel, count) {
    var status = root.querySelector("[data-gallery-page-status]");
    if (!status || !count) return;
    var current = clamp(Math.round(carousel.scrollLeft / Math.max(carousel.clientWidth, 1)), 0, count - 1);
    status.textContent = (current + 1) + " / " + count;
  }

  function openWishComposer() {
    if (document.querySelector(".wish-composer")) return;
    var layer = document.createElement("section");
    layer.className = "wish-composer";
    layer.innerHTML = '<form><button class="composer-close" type="button" aria-label="\u5173\u95ed">&times;</button><p class="section-kicker">\u5199\u4e0b\u4e00\u4e2a\u5c0f\u5fc3\u613f</p><h3>\u628a\u5fc3\u613f\u88c5\u8fdb\u74f6\u5b50\u91cc</h3><textarea maxlength="120" required placeholder="\u4eca\u5929\u60f3\u5bf9\u81ea\u5df1\u8bf4\u7684\u4e00\u53e5\u8bdd\u2026"></textarea><p class="composer-error" aria-live="polite"></p><button class="warm-action" type="submit">\u597d\u597d\u6536\u4e0b\u8fd9\u4e2a\u5fc3\u613f</button></form>';
    document.body.appendChild(layer);
    var close = function () { layer.remove(); };
    layer.querySelector(".composer-close").addEventListener("click", close);
    layer.addEventListener("click", function (event) { if (event.target === layer) close(); });
    layer.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      var text = layer.querySelector("textarea").value.trim();
      var error = layer.querySelector(".composer-error");
      if (!text) {
        error.textContent = "\u5199\u4e0b\u4e00\u53e5\u5fc3\u613f\uff0c\u518d\u628a\u5b83\u653e\u8fdb\u74f6\u5b50\u91cc\u5427\u3002";
        return;
      }
      saveWish(text);
      renderSavedWishes();
      layer.querySelector("form").innerHTML = '<div class="wish-sent"><span aria-hidden="true">&#10024;</span><h3>\u5fc3\u613f\u5df2\u7ecf\u6536\u597d\u4e86</h3><p>\u5b83\u4f1a\u5728\u9002\u5408\u7684\u65f6\u5019\uff0c\u6162\u6162\u5411\u4f60\u9760\u8fd1\u3002</p><button class="warm-action" type="button">\u77e5\u9053\u5566</button></div>';
      layer.querySelector("button").addEventListener("click", close);
    });
  }

  function wishStorageKey() { return "birthday-wishes:" + (slug || "page"); }
  function savedWishes() {
    try {
      var value = JSON.parse(window.localStorage.getItem(wishStorageKey()) || "[]");
      return Array.isArray(value) ? value.slice(0, 3) : [];
    } catch (error) {
      return [];
    }
  }
  function saveWish(text) {
    var list = savedWishes();
    list.unshift({ text: text, createdAt: Date.now() });
    try { window.localStorage.setItem(wishStorageKey(), JSON.stringify(list.slice(0, 3))); } catch (error) { console.warn("Wish was not persisted locally.", error); }
  }
  function renderSavedWishes() {
    var output = root.querySelector("[data-wish-list]");
    if (!output) return;
    var wishes = savedWishes();
    output.innerHTML = wishes.length ? wishes.map(function (item) { return '<p>\u201c' + escapeHtml(item.text) + '\u201d</p>'; }).join("") : '<p>\u8fd9\u91cc\u4f1a\u6162\u6162\u6536\u4e0b\u4eca\u5929\u8bb8\u4e0b\u7684\u5fc3\u613f\u3002</p>';
  }

  function renderFutureLetter(element) {
    var openDate = element.dataset.openDate;
    var letter = element.dataset.letter || "";
    if (!openDate || new Date(openDate + "T23:59:59").getTime() <= Date.now()) {
      element.innerHTML = '<p class="future-open-label">\u5199\u7ed9\u672a\u6765\u7684\u4f60</p><p>' + escapeHtml(letter || "\u613f\u672a\u6765\u7684\u6bcf\u4e00\u5929\uff0c\u4e5f\u90fd\u6709\u4eba\u8ba4\u771f\u4e3a\u4f60\u5e86\u795d\u3002") + '</p>';
      return;
    }
    var date = new Date(openDate + "T12:00:00");
    element.innerHTML = '<p class="future-open-label">\u4f1a\u5728\u8fd9\u4e00\u5929\u6253\u5f00</p><strong>' + escapeHtml(date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })) + '</strong><p>\u8fd9\u5c01\u4fe1\u4f1a\u5728\u90a3\u4e00\u5929\uff0c\u518d\u8f7b\u8f7b\u6253\u5f00\u3002</p>';
  }

  async function renderDailyLuck(birthday) {
    var target = root.querySelector("#dailyLuckContent");
    if (!target) return;
    try {
      var data = await window.BirthdayDailyLuck.getDailyLuck(birthday);
      var horoscope = data.horoscope;
      var almanac = data.almanac;
      var horoscopeSource = data.sources && data.sources.horoscope;
      var cards = [];
      if (horoscope) {
        var luckDetails = [];
        if (horoscope.type) luckDetails.push("\u8fd0\u52bf\u7c7b\u578b\uff1a" + horoscope.type);
        if (horoscope.luckyColor) luckDetails.push("\u5e78\u8fd0\u8272\uff1a" + horoscope.luckyColor);
        if (horoscope.luckyNumber) luckDetails.push("\u5e78\u8fd0\u6570\u5b57\uff1a" + horoscope.luckyNumber);
        if (horoscopeSource) luckDetails.push("\u6570\u636e\uff1a" + horoscopeSource);
        cards.push('<article class="luck-card"><span>\u661f\u8c61\u5c0f\u63d0\u793a</span><strong>' + escapeHtml(horoscope.summary || "\u4eca\u5929\u7684\u661f\u8c61\u6b63\u5728\u7ed9\u4f60\u9001\u4e0a\u4e00\u4efd\u8f7b\u8f7b\u7684\u795d\u798f\u3002") + '</strong><small>' + escapeHtml(luckDetails.join(" \u00b7 ") || "\u4ec5\u4f9b\u5a31\u4e50\u53c2\u8003") + '</small></article>');
      }
      if (almanac) {
        cards.push('<article class="luck-card"><span>\u4eca\u65e5\u5c0f\u5b9c\u5fcc</span><strong>\u5b9c\uff1a' + escapeHtml(almanac.suitable || "\u628a\u5feb\u4e50\u6536\u4e0b") + '</strong><small>\u5fcc\uff1a' + escapeHtml(almanac.avoid || "\u5bf9\u81ea\u5df1\u592a\u4e0d\u5ba2\u6c14") + '</small></article>');
      }
      target.innerHTML = cards.join("") || '<p class="luck-unavailable">\u4eca\u65e5\u7684\u5c0f\u597d\u8fd0\u6b63\u5728\u8def\u4e0a\uff0c\u7a0d\u540e\u518d\u6765\u770b\u770b\u4e5f\u53ef\u4ee5\u3002</p>';
    } catch (error) {
      target.innerHTML = '<p class="luck-unavailable">\u4eca\u65e5\u7684\u5c0f\u597d\u8fd0\u6682\u65f6\u5728\u8def\u4e0a\uff0c\u7a0d\u540e\u518d\u6765\u770b\u770b\u4e5f\u53ef\u4ee5\u3002</p>';
      console.warn("Daily luck unavailable:", error);
    }
  }

  function startCountdown(birthday) {
    window.clearInterval(countdownTimer);
    var output = root.querySelector("#birthdayCountdown");
    if (!output || !birthday) return;
    function tick() {
      var target = nextBirthday(birthday);
      var distance = Math.max(0, target.getTime() - Date.now());
      var units = [
        [Math.floor(distance / 86400000), "\u5929"],
        [Math.floor(distance % 86400000 / 3600000), "\u65f6"],
        [Math.floor(distance % 3600000 / 60000), "\u5206"],
        [Math.floor(distance % 60000 / 1000), "\u79d2"]
      ];
      output.innerHTML = units.map(function (unit) {
        return '<div><b>' + String(unit[0]).padStart(2, "0") + '</b><span>' + unit[1] + '</span></div>';
      }).join("");
    }
    tick();
    countdownTimer = window.setInterval(tick, 1000);
  }

  function nextBirthday(value) {
    var parsed = new Date(String(value) + "T12:00:00");
    var now = new Date();
    var target = new Date(now.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setFullYear(target.getFullYear() + 1);
    return target;
  }

  function orderGallery(gallery) {
    var featured = gallery.filter(function (photo) { return photo && photo.isFeatured; }).sort(function (a, b) {
      return Number(a.featuredSortOrder || 999) - Number(b.featuredSortOrder || 999);
    });
    var others = gallery.filter(function (photo) { return photo && !photo.isFeatured; });
    return featured.concat(others);
  }

  function heroEyebrow(asset, name) {
    var map = {
      bright_warm: "\u7ed9 " + name + " \u7684\u751f\u65e5\u5c0f\u5b87\u5b99",
      playful_loud: "\u4eca\u5929\u5fc5\u987b\u4e3a " + name + " \u70ed\u70ed\u95f9\u95f9",
      letter_like: "\u4e00\u5c01\u5199\u7ed9 " + name + " \u7684\u751f\u65e5\u4fe1",
      cheery_party: "\u4eca\u5929\u7684\u4e3b\u89d2\u5c31\u662f " + name,
      adoring_soft: "\u8fd9\u4e00\u5929\uff0c\u4e3a " + name + " \u4eae\u8d77\u6765",
      midnight_romance: "\u4e3a " + name + " \u853c\u8d77\u7684\u4e00\u665a\u661f\u5149",
      sunny_free: "\u7ed9 " + name + " \u7684\u590f\u65e5\u751f\u65e5\u5047\u65e5",
      tender_romance: "\u8ba4\u771f\u5199\u7ed9 " + name + " \u7684\u4e00\u9875\u5fc3\u610f",
      fresh_healing: "\u4eca\u5929\u7684\u6d77\u98ce\u4e5f\u5728\u795d " + name + " \u751f\u65e5\u5feb\u4e50",
      sweet_surprise: "\u4e00\u4efd\u4e3a " + name + " \u51c6\u5907\u7684\u60ca\u559c",
      young_confident: "\u4eca\u5929\uff0c\u8981\u5927\u58f0\u795d " + name + " \u751f\u65e5\u5feb\u4e50"
    };
    return map[asset.copyTone] || map.bright_warm;
  }

  function defaultHeadline(name) { return "\u613f" + name + "\u6bcf\u5929\u90fd\u95ea\u95ea\u53d1\u5149"; }
  function defaultMessage(name) { return "\u4eca\u5929\u7684\u504f\u7231\u3001\u795d\u798f\u548c\u597d\u591a\u597d\u591a\u5feb\u4e50\uff0c\u90fd\u60f3\u8ba4\u771f\u5730\u9001\u7ed9" + name + "\u3002"; }
  function renderSignature(sender, content) {
    if (sender && sender.anonymous) return "\u4e00\u4efd\u6084\u6084\u9001\u8fbe\u7684\u5fc3\u610f";
    return "\u6765\u81ea " + escapeHtml(content.signature || sender && sender.name || "\u4e00\u4f4d\u7231\u4f60\u7684\u4eba");
  }
  function chunk(items, size) { var result = []; for (var index = 0; index < items.length; index += size) result.push(items.slice(index, index + size)); return result; }
  function cleanHeadline(value) { return Array.from(String(value || "").replace(/[<>]/g, "").trim()).slice(0, 15).join("") || "\u751f\u65e5\u5feb\u4e50"; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
  function escapeHtml(value) { var element = document.createElement("div"); element.textContent = String(value == null ? "" : value); return element.innerHTML; }
  function fail(message) { root.innerHTML = '<section class="birthday-error"><span aria-hidden="true">&#10024;</span><strong>\u6682\u65f6\u65e0\u6cd5\u6253\u5f00</strong><p>' + escapeHtml(message || "\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002") + '</p></section>'; }
})();
