(function () {
  "use strict";
  var root = document.querySelector("#birthdayPage");
  if (!root) return;

  var fallbackAsset = {
    templateId: "line_bloom_white", legacyId: "T01", version: "1.0.0",
    palette: { primary: "#ef6f95", accent: "#2f8be8", background: "#fffdf7", ink: "#27221f", soft: "#fff5eb", highlight: "#f7c948" },
    typography: { display: "handwritten" }, copyTone: "bright_warm", decorElements: ["sparkle", "bloom", "ribbon"]
  };
  var runtime = { booted: false, requestId: 0, state: "idle", model: null, cleanup: [], storyMounted: false, music: null, activeWishLayer: null, activeWishClose: null };

  function bootstrapBirthdayPage() {
    if (runtime.booted) return;
    runtime.booted = true;
    var environment = parseSlugAndEnvironment();
    if (!environment.slug) return renderStatus("empty", "这份生日惊喜还没有完整链接", "请从送礼人分享的专属链接再次打开。 ");
    void loadBirthdayPage(environment);
  }

  function parseSlugAndEnvironment() {
    var params = new URLSearchParams(window.location.search);
    return {
      slug: cleanSlug(params.get("slug")),
      screenshot: params.get("screenshot") === "1" || params.get("mode") === "screenshot",
      url: window.location.href
    };
  }

  async function loadBirthdayPage(environment) {
    var requestId = ++runtime.requestId;
    runtime.state = "loading";
    renderLoading();
    try {
      var raw = await fetchPublishedPage(environment);
      if (requestId !== runtime.requestId) return;
      var model = resolveTemplateSnapshot(normalizeBirthdayPageData(raw, environment));
      renderBirthdayPageShell(model);
      mountFeatureModules(model);
      if (model.screenshot) openStory(model, { scroll: false, playMusic: false });
      reportReadyOrError("ready", model);
    } catch (error) {
      if (requestId !== runtime.requestId) return;
      var result = classifyError(error);
      renderStatus(result.state, result.title, result.message);
      reportReadyOrError(result.state, error);
    }
  }

  async function fetchPublishedPage(environment) {
    var client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
    if (!client) throw pageError("network-error", "生日页服务暂时没有连上。 ");
    var response = await withTimeout(client.functions.invoke("get-published-page", { body: { slug: environment.slug } }), 14000);
    if (response.error) throw await functionError(response.error, "暂时无法打开这份生日惊喜。 ");
    if (!response.data || response.data.ok === false || !response.data.page) {
      throw pageError("render-error", response.data && response.data.error || "这份生日惊喜的数据还没有准备好。 ");
    }
    return response.data.page;
  }

  function normalizeBirthdayPageData(raw, environment) {
    var page = object(raw), content = object(page.content), recipient = object(page.recipient), sender = object(page.sender);
    var name = text(recipient.name, 40) || "TA";
    var headline = text(content.headline, 15) || defaultHeadline(name);
    var hero = normalizeHero(content, sender, name, headline);
    var photos = object(page.photos);
    var gallery = Array.isArray(photos.gallery) ? photos.gallery.map(normalizePhoto).filter(Boolean) : [];
    return {
      slug: environment.slug, screenshot: environment.screenshot, publishedUrl: text(page.publishedUrl, 500) || environment.url,
      templateSnapshot: object(page.templateAsset), templateId: text(page.templateId, 80), template: null,
      recipient: { name: name, birthday: text(recipient.birthday, 20) },
      sender: { name: text(sender.name, 40), anonymous: Boolean(sender.anonymous) },
      content: {
        headline: headline, message: text(content.message, 1200), signature: text(content.signature, 80),
        heroTitleLine1: hero.lines[0] || "", heroTitleLine2: hero.lines[1] || "", heroSubtitle: hero.subtitle,
        senderSignature: hero.signature, openCta: hero.openCta,
        shareTitle: text(content.shareTitle || content.share_title, 80),
        shareDescription: text(content.shareDescription || content.share_description, 160),
        shareCoverUrl: text(content.shareCoverUrl || content.share_cover_url, 1200), music: object(content.music)
      },
      photos: { cover: normalizePhoto(photos.cover), gallery: orderGallery(gallery) },
      modules: normalizeModules(page.modules), privacy: object(page.privacy)
    };
  }

  function resolveTemplateSnapshot(model) {
    var asset = resolveTemplateAsset(model.templateSnapshot, model.templateId);
    var template = window.BirthdayTemplateRegistry && window.BirthdayTemplateRegistry.resolve ? window.BirthdayTemplateRegistry.resolve(asset) : fallbackTemplate(asset);
    model.template = template;
    model.content.openCta = model.content.openCta || template.copy.openCta || "拆开给你的生日惊喜";
    delete model.templateSnapshot;
    delete model.templateId;
    return model;
  }

  function normalizeHero(content, sender, name, headline) {
    var lines = [text(content.heroTitleLine1 || content.hero_title_line_1, 28), text(content.heroTitleLine2 || content.hero_title_line_2, 28)].filter(Boolean);
    if (!lines.length) lines = [headline];
    return {
      lines: lines.slice(0, 2),
      subtitle: text(content.heroSubtitle || content.hero_subtitle || content.message, 180) || defaultMessage(name),
      signature: signatureFor(sender, content),
      openCta: text(content.openCta || content.open_cta, 32)
    };
  }

  function resolveTemplateAsset(snapshot, legacyId) {
    var finder = window.BD_TEMPLATE_ASSET_BY_ID;
    var base = typeof finder === "function" ? finder(snapshot.templateId || snapshot.legacyId || legacyId) : null;
    return Object.assign({}, fallbackAsset, object(base), snapshot, {
      palette: Object.assign({}, fallbackAsset.palette, object(base && base.palette), object(snapshot.palette)),
      templateId: snapshot.templateId || base && base.templateId || legacyId || fallbackAsset.templateId,
      legacyId: snapshot.legacyId || base && base.legacyId || legacyId || fallbackAsset.legacyId
    });
  }

  function fallbackTemplate(asset) {
    return {
      id: asset.templateId, legacyId: asset.legacyId, version: asset.version || "1.0.0", palette: asset.palette,
      typography: asset.typography || {}, copyTone: asset.copyTone, decorElements: asset.decorElements || [],
      composition: { heroVariant: "classic", galleryVariant: "polaroid-scroll", sectionDivider: "soft-line", footerVariant: "warm-note" },
      visual: {}, copy: { openCta: "拆开给你的生日惊喜", storyLead: "有一些认真准备好的小心意，正在等你慢慢打开。" }, moduleVariants: {}, isV2: false
    };
  }

  function normalizeModules(value) {
    var result = { countdown: { enabled: true } };
    Object.keys(object(value)).forEach(function (code) {
      var config = object(value[code]);
      if (config.enabled !== false) result[code] = Object.assign({ enabled: true }, config);
    });
    return result;
  }

  function normalizePhoto(value) {
    var photo = object(value), url = text(photo.url, 1600);
    if (!url) return null;
    return {
      url: url, caption: text(photo.caption, 120), sortOrder: number(photo.sortOrder, 0), isFeatured: Boolean(photo.isFeatured),
      featuredSortOrder: number(photo.featuredSortOrder, 999), focalX: clamp(number(photo.focalX, .5), 0, 1), focalY: clamp(number(photo.focalY, .5), 0, 1), cropData: object(photo.cropData)
    };
  }

  function renderBirthdayPageShell(model) {
    cleanupMountedFeatures();
    runtime.model = model; runtime.state = "ready"; runtime.storyMounted = false;
    root.dataset.pageState = "ready";
    applyThemeVariables(model.template.palette);
    var classes = "birthday-shell renderer-v2 theme-" + escapeHtml(model.template.legacyId) + " asset-" + escapeHtml(model.template.id) + " hero-" + escapeHtml(model.template.composition.heroVariant) + " gallery-" + escapeHtml(model.template.composition.galleryVariant);
    if (model.screenshot) classes += " screenshot-mode";
    root.innerHTML = '<main class="' + classes + '" data-template-version="' + escapeHtml(model.template.version) + '">' + renderDecorations(model.template) + renderHero(model) + '<div id="birthdayStory" class="birthday-story" hidden>' + renderStory(model) + '</div></main>';
    var clickHandler = function (event) { handleShellClick(event, model); };
    root.addEventListener("click", clickHandler);
    runtime.cleanup.push(function () { root.removeEventListener("click", clickHandler); });
  }

  function renderHero(model) {
    var variant = model.template.composition.heroVariant;
    if (variant === "line-bloom") return '<section id="top" class="birthday-hero hero-layout-line-bloom"><div class="hero-line-copy">' + renderHeroCopy(model) + '</div>' + renderCover(model.photos.cover, model.recipient.name, model.template) + '<span class="hero-line-doodle doodle-flower" aria-hidden="true"></span><span class="hero-line-doodle doodle-arrow" aria-hidden="true"></span></section>';
    if (variant === "collage-poster") return '<section id="top" class="birthday-hero hero-layout-collage"><span class="poster-tape poster-tape-a" aria-hidden="true"></span><span class="poster-tape poster-tape-b" aria-hidden="true"></span><div class="collage-photo-wrap">' + renderCover(model.photos.cover, model.recipient.name, model.template) + '</div><div class="collage-copy">' + renderHeroCopy(model) + '</div><span class="poster-stamp" aria-hidden="true">TODAY<br>IS YOUR DAY</span></section>';
    if (variant === "cinematic-portrait") return '<section id="top" class="birthday-hero hero-layout-cinematic"><div class="cinematic-visual">' + renderCover(model.photos.cover, model.recipient.name, model.template) + '<span class="cinematic-veil" aria-hidden="true"></span></div><div class="cinematic-copy">' + renderHeroCopy(model) + '</div></section>';
    return '<section id="top" class="birthday-hero hero-layout-classic"><div class="classic-copy">' + renderHeroCopy(model) + '</div>' + renderCover(model.photos.cover, model.recipient.name, model.template) + '</section>';
  }

  function renderHeroCopy(model) {
    var content = model.content, lines = [content.heroTitleLine1, content.heroTitleLine2].filter(Boolean);
    return '<div class="hero-copy"><p class="hero-eyebrow">' + escapeHtml(heroEyebrow(model.template, model.recipient.name)) + '</p><h1 class="hero-headline headline-' + escapeHtml(model.template.typography.display || "handwritten") + '">' + lines.map(function (line) { return '<span>' + escapeHtml(line) + '</span>'; }).join("") + '</h1><p class="hero-message">' + escapeHtml(content.heroSubtitle) + '</p>' + (content.senderSignature ? '<p class="hero-signature">' + escapeHtml(content.senderSignature) + '</p>' : "") + renderCountdown() + '<button type="button" class="hero-open-cta" data-open-gift><span aria-hidden="true">✦</span>' + escapeHtml(content.openCta) + '</button></div>';
  }

  function renderCover(photo, name, template) {
    if (!photo || !photo.url) return '<figure class="hero-photo placeholder-photo" data-cover-shape="' + escapeHtml(template.coverStyle || "freeform_frame") + '"><div class="placeholder-shape" aria-hidden="true"></div><figcaption>今天的主角，正在等候出场。</figcaption></figure>';
    return '<figure class="hero-photo" style="--focal-x:' + Math.round(photo.focalX * 100) + '%;--focal-y:' + Math.round(photo.focalY * 100) + '%" data-cover-shape="' + escapeHtml(template.coverStyle || "freeform_frame") + '"><span class="portrait-aura" aria-hidden="true"></span><img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(name) + '的生日封面照" fetchpriority="high" decoding="async" referrerpolicy="no-referrer"><span class="portrait-corner portrait-corner-a" aria-hidden="true"></span><span class="portrait-corner portrait-corner-b" aria-hidden="true"></span></figure>';
  }

  function renderCountdown() { return '<section id="countdown" class="countdown-section countdown-compact"><p class="countdown-title"><span aria-hidden="true">🎂</span>距离下一次生日还有</p><div class="countdown-grid" data-countdown aria-live="polite"></div></section>'; }
  function renderStory(model) {
    var modules = model.modules, sections = [];
    if (modules.bgm) sections.push(renderMusicModule());
    if (model.photos.gallery.length) sections.push(renderAlbum(model));
    if (modules.messageWall) sections.push('<section id="module-messageWall" class="content-section wall-section"><div id="publicBlessingWall"></div></section>');
    if (modules.wishBottle) sections.push(renderWishBottle(modules.wishBottle, model.template));
    if (modules.futureMailbox) sections.push(renderFutureMailbox(modules.futureMailbox, model.template));
    if (modules.dailyLuck) sections.push(renderDailyLuckModule());
    if (modules.surpriseBox) sections.push(renderSurpriseBox(model.template));
    sections.push(renderShare());
    return '<div class="story-intro"><p>✦ ' + escapeHtml(model.template.copy.storyLead) + '</p></div><div class="page-sections">' + sections.join("") + '</div>';
  }

  function renderMusicModule() {
    return '<section id="module-bgm" class="content-section music-section module-music"><div class="music-note" aria-hidden="true"></div><div><p class="section-kicker">THIS SONG IS FOR YOU</p><h2>一首想陪你听完的歌</h2><p data-music-status>准备好后，轻轻点一下就能听见。</p></div><button type="button" class="music-toggle" data-music-toggle aria-pressed="false">播放这首歌</button></section>';
  }

  function renderAlbum(model) {
    var photos = model.photos.gallery, variant = model.template.composition.galleryVariant;
    return '<section id="gallery" class="content-section album-section gallery-variant-' + escapeHtml(variant) + '" data-gallery-root><div class="section-heading"><div><p class="section-kicker">MEMORIES WE KEEP</p><h2>我们一起走过的这些瞬间</h2><p>有些画面不用说很多话，看见就会想起当时的快乐。</p></div><span class="section-stamp" aria-hidden="true">收好<br>这一刻</span></div><div class="gallery-track" data-gallery-track>' + photos.map(photoCard).join("") + '</div><div class="gallery-controls"><button type="button" data-gallery-prev aria-label="查看上一张照片">上一张</button><span data-gallery-progress>1 / ' + photos.length + '</span><button type="button" data-gallery-next aria-label="查看下一张照片">下一张</button></div></section>';
  }

  function photoCard(photo, index) {
    var captions = ["这一天很亮", "我们在一起", "留住小小快乐", "把这一刻收好", "很高兴有你", "这张最舍不得删", "今天也要笑呀", "生日快乐呀"];
    var angles = ["-2.4deg", "1.8deg", "-1.1deg", "2.6deg", "-1.7deg", "1.2deg"];
    var caption = photo.caption || captions[index % captions.length];
    return '<button type="button" class="polaroid polaroid-' + (index % 6) + '" data-gallery-open="' + index + '" data-caption="' + escapeHtml(caption) + '" style="--photo-angle:' + angles[index % angles.length] + '"><figure><img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(caption) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer"><figcaption>' + escapeHtml(caption) + '</figcaption></figure></button>';
  }

  function renderWishBottle(config, template) {
    var title = text(config.title, 40) || "许愿瓶", prompt = text(config.prompt, 180) || "把这一岁的一个小愿望，轻轻放进去。";
    return '<section id="module-wishBottle" class="content-section module-section wish-section variant-' + escapeHtml(template.moduleVariants.wishBottle || "glass-bottle") + '"><div class="section-heading"><div><p class="section-kicker">A WISH FOR YOU</p><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(prompt) + '</p></div><span class="module-doodle doodle-bottle" aria-hidden="true"></span></div><div class="wish-preview" data-wish-list></div><button type="button" class="warm-action" data-wish-open>把愿望放进去</button><p class="module-privacy-note">这句小愿望只会保存在当前设备，不会公开显示。</p></section>';
  }

  function renderFutureMailbox(config, template) {
    var openDate = text(config.openDate, 20), letter = text(config.content, 1000);
    var isOpen = !openDate || new Date(openDate + "T23:59:59").getTime() <= Date.now();
    var dateCopy = openDate ? formatDate(openDate) : "未来的某一天";
    return '<section id="module-futureMailbox" class="content-section module-section future-section variant-' + escapeHtml(template.moduleVariants.futureMailbox || "folded-letter") + '"><div class="section-heading"><div><p class="section-kicker">A LETTER FOR LATER</p><h2>未来信箱</h2><p>' + (isOpen ? "有一封信，想在今天慢慢读给你听。" : "这封信会在约定的那一天，再轻轻打开。") + '</p></div><span class="module-doodle doodle-letter" aria-hidden="true"></span></div><article class="future-letter ' + (isOpen ? "is-open" : "is-locked") + '"><span>' + (isOpen ? "TO FUTURE YOU" : "SEALED UNTIL") + '</span><strong>' + escapeHtml(isOpen ? "写给未来的你" : dateCopy) + '</strong><p>' + escapeHtml(isOpen ? (letter || "愿未来的每一天，也都有人认真为你庆祝。") : "先把这份温柔留在这里，等时间替你拆开。") + '</p></article></section>';
  }

  function renderDailyLuckModule() {
    return '<section id="module-dailyLuck" class="content-section module-section luck-section"><div class="section-heading"><div><p class="section-kicker">A LITTLE LUCK TODAY</p><h2>今日好运</h2><p>今天的星象和小福气，想安静地陪在你身边。</p></div><span class="module-doodle doodle-star" aria-hidden="true"></span></div><div id="dailyLuckContent" class="daily-luck-content"><p>正在为 TA 收集今天的小幸运…</p></div></section>';
  }

  function renderSurpriseBox(template) {
    return '<section id="module-surpriseBox" class="content-section module-section surprise-section variant-' + escapeHtml(template.moduleVariants.surpriseBox || "gift-stage") + '"><div class="section-heading"><div><p class="section-kicker">ONE MORE THING</p><h2>还有一份没有告诉你的礼物</h2><p>轻轻摇一摇，再打开它。今天会有一件小事为你发光。</p></div></div><button type="button" class="gift-box-control" data-surprise aria-label="打开惊喜盲盒"><span class="gift-box-illustration" aria-hidden="true"><i></i><b></b><em></em></span><span><strong>打开礼盒</strong><small>收下今天的小惊喜</small></span></button></section>';
  }

  function renderShare() {
    return '<section class="content-section share-section" data-share-zone><p class="section-kicker">PASS THE WARMTH ON</p><h2>把这份生日惊喜送到 TA 手里</h2><p>愿今天被记住，也愿这份心意继续抵达更多人。</p><div class="share-actions"><button type="button" class="warm-action" data-share-page>分享这份惊喜</button><button type="button" class="share-copy-button" data-copy-link>复制链接</button></div><p class="share-feedback" data-share-feedback aria-live="polite"></p></section><footer class="birthday-footer"><span class="footer-spark" aria-hidden="true"></span><p>今天的快乐，有人认真地替你收好了。</p></footer>';
  }

  function handleShellClick(event, model) {
    if (event.target.closest("[data-open-gift]")) return openStory(model, { scroll: true, playMusic: true });
    if (event.target.closest("[data-wish-open]")) return openWishComposer(model);
    if (event.target.closest("[data-surprise]") && window.openSurpriseExperience) {
      window.openSurpriseExperience(Object.assign({}, model.modules.surpriseBox || {}, { pageKey: model.slug, recipientName: model.recipient.name }), {
        templateId: model.template.legacyId, templateAssetId: model.template.id, primaryColor: model.template.palette.primary,
        accentColor: model.template.palette.accent, backgroundColor: model.template.palette.background,
        inkColor: model.template.palette.ink, highlightColor: model.template.palette.highlight
      });
    }
  }

  function openStory(model, options) {
    var story = root.querySelector("#birthdayStory"), shell = root.querySelector(".birthday-shell");
    if (!story || !shell) return;
    story.hidden = false; shell.classList.add("is-story-open");
    if (!runtime.storyMounted) mountFeatureModules(model);
    if (options && options.playMusic && runtime.music) void runtime.music.play();
    if (options && options.scroll) window.setTimeout(function () { story.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }); }, 90);
  }

  function mountFeatureModules(model) {
    if (runtime.storyMounted) return;
    runtime.storyMounted = true;
    runtime.cleanup.push(startCountdown(model.recipient.birthday));
    if (model.modules.bgm && window.BirthdayMusic) {
      runtime.music = window.BirthdayMusic.mount({ root: root, enabled: true, trackUrl: "assets/music/i-love-you-so.mp3" });
      runtime.cleanup.push(function () { if (runtime.music) runtime.music.cleanup(); runtime.music = null; });
    }
    var galleryRoot = root.querySelector("[data-gallery-root]");
    if (galleryRoot && window.BirthdayGallery) runtime.cleanup.push(window.BirthdayGallery.mount({ root: galleryRoot }));
    var wallRoot = root.querySelector("#publicBlessingWall");
    if (wallRoot && window.BirthdayPublicWall) runtime.cleanup.push(window.BirthdayPublicWall.mount({ root: wallRoot, slug: model.slug }));
    if (model.modules.dailyLuck && window.BirthdayDailyLuck) void renderDailyLuck(model.recipient.birthday);
    renderSavedWishes();
    var shareRoot = root.querySelector("[data-share-zone]");
    if (shareRoot && window.BirthdayShare) runtime.cleanup.push(window.BirthdayShare.mount({ root: shareRoot, page: {
      publishedUrl: model.publishedUrl, shareTitle: model.content.shareTitle || ("给" + model.recipient.name + "的一份生日惊喜"),
      shareDescription: model.content.shareDescription || model.content.heroSubtitle,
      shareCoverUrl: model.content.shareCoverUrl || model.photos.cover && model.photos.cover.url || ""
    } }));
  }

  function startCountdown(birthday) {
    var output = root.querySelector("[data-countdown]");
    if (!output || !birthday) { if (output) output.innerHTML = '<span class="countdown-fallback">今天，刚好适合被认真庆祝。</span>'; return function () {}; }
    var timer = 0;
    function tick() {
      var distance = Math.max(0, nextBirthday(birthday).getTime() - Date.now());
      var units = [[Math.floor(distance / 86400000), "天"], [Math.floor(distance % 86400000 / 3600000), "时"], [Math.floor(distance % 3600000 / 60000), "分"], [Math.floor(distance % 60000 / 1000), "秒"]];
      output.innerHTML = units.map(function (unit) { return '<span><b>' + String(unit[0]).padStart(2, "0") + '</b><i>' + unit[1] + '</i></span>'; }).join("");
    }
    tick(); timer = window.setInterval(tick, 1000);
    return function () { window.clearInterval(timer); };
  }

  async function renderDailyLuck(birthday) {
    var target = root.querySelector("#dailyLuckContent");
    if (!target) return;
    try {
      var data = await window.BirthdayDailyLuck.getDailyLuck(birthday);
      if (!target.isConnected) return;
      var cards = [], horoscope = object(data.horoscope), almanac = object(data.almanac);
      if (Object.keys(horoscope).length) {
        var details = [];
        if (horoscope.type) details.push("运势类型：" + text(horoscope.type, 40));
        if (horoscope.luckyColor) details.push("幸运色：" + text(horoscope.luckyColor, 30));
        if (horoscope.luckyNumber) details.push("幸运数字：" + text(horoscope.luckyNumber, 20));
        cards.push('<article class="luck-card"><span>星象小提示</span><strong>' + escapeHtml(text(horoscope.summary, 240) || "今天的星象，正悄悄给你送来一份祝福。") + '</strong><small>' + escapeHtml(details.join(" · ") || "仅供轻松参考") + '</small></article>');
      }
      if (Object.keys(almanac).length) cards.push('<article class="luck-card"><span>今日小宜忌</span><strong>宜：' + escapeHtml(text(almanac.suitable, 100) || "把快乐收下") + '</strong><small>忌：' + escapeHtml(text(almanac.avoid, 100) || "对自己太不客气") + '</small></article>');
      target.innerHTML = cards.join("") || '<p class="luck-unavailable">今天的小好运正在路上，稍后再来看看也可以。</p>';
    } catch (error) {
      if (target.isConnected) target.innerHTML = '<p class="luck-unavailable">今天的小好运暂时在路上，稍后再来看看也可以。</p>';
      if (isDevelopment()) console.warn("Daily luck unavailable:", error && error.message || "unknown");
    }
  }
  function openWishComposer(model) {
    if (runtime.activeWishLayer) return;
    var previousFocus = document.activeElement;
    var layer = document.createElement("section");
    layer.className = "wish-composer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "写下一个小心愿");
    layer.innerHTML = '<form><button class="composer-close" type="button" data-wish-close aria-label="关闭">×</button><p class="section-kicker">A SMALL WISH</p><h3>把愿望装进瓶子里</h3><p class="composer-hint">它只保存在这台设备上，不会被公开。</p><textarea maxlength="120" required placeholder="今天想对自己说的一句话…"></textarea><p class="composer-error" aria-live="polite"></p><button class="warm-action" type="submit">好好收下这个愿望</button></form>';
    document.body.appendChild(layer); runtime.activeWishLayer = layer;
    var form = layer.querySelector("form");
    function close() {
      if (runtime.activeWishLayer !== layer) return;
      document.removeEventListener("keydown", onKey); layer.remove(); runtime.activeWishLayer = null; runtime.activeWishClose = null;
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    }
    function onKey(event) { if (event.key === "Escape") { event.preventDefault(); close(); } else if (event.key === "Tab") trapFocus(event, layer); }
    layer.addEventListener("click", function (event) { if (event.target === layer || event.target.closest("[data-wish-close]")) close(); });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = form.querySelector("textarea").value.trim(), error = form.querySelector(".composer-error");
      if (!value) { error.textContent = "写下一句愿望，再把它放进瓶子里吧。"; return; }
      saveWish(model.slug, value); renderSavedWishes();
      form.innerHTML = '<div class="wish-sent"><span aria-hidden="true">✦</span><h3>心愿已经收好了</h3><p>它会在合适的时候，慢慢向你靠近。</p><button class="warm-action" type="button" data-wish-close>知道啦</button></div>';
      form.querySelector("[data-wish-close]").addEventListener("click", close);
    });
    runtime.activeWishClose = close;
    document.addEventListener("keydown", onKey);
    var textarea = form.querySelector("textarea"); if (textarea) textarea.focus();
  }

  function savedWishes(slug) {
    try { var values = JSON.parse(window.localStorage.getItem("birthday-wishes:" + slug) || "[]"); return Array.isArray(values) ? values.slice(0, 3) : []; }
    catch (_) { return []; }
  }
  function saveWish(slug, value) {
    var values = savedWishes(slug); values.unshift({ text: text(value, 120), createdAt: Date.now() });
    try { window.localStorage.setItem("birthday-wishes:" + slug, JSON.stringify(values.slice(0, 3))); } catch (_) { console.warn("Wish could not be persisted locally."); }
  }
  function renderSavedWishes() {
    var output = root.querySelector("[data-wish-list]");
    if (!output || !runtime.model) return;
    var wishes = savedWishes(runtime.model.slug);
    output.innerHTML = wishes.length ? wishes.map(function (wish) { return '<p>“' + escapeHtml(wish.text) + '”</p>'; }).join("") : '<p>这里会轻轻收下今天许下的小愿望。</p>';
  }

  function renderDecorations(template) {
    return '<div class="template-decor" aria-hidden="true">' + (template.decorElements || []).map(function (element, index) { return '<span class="decor decor-' + escapeHtml(element) + ' decor-' + (index + 1) + '"></span>'; }).join("") + '</div>';
  }
  function applyThemeVariables(palette) {
    var fallback = fallbackAsset.palette;
    var values = { "--birthday-primary": palette.primary || fallback.primary, "--birthday-accent": palette.accent || fallback.accent, "--birthday-bg": palette.background || fallback.background, "--birthday-ink": palette.ink || fallback.ink, "--birthday-soft": palette.soft || fallback.soft, "--birthday-highlight": palette.highlight || fallback.highlight };
    Object.keys(values).forEach(function (key) { document.documentElement.style.setProperty(key, values[key]); });
  }
  function orderGallery(gallery) {
    return gallery.slice().sort(function (a, b) {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return a.isFeatured && b.isFeatured ? a.featuredSortOrder - b.featuredSortOrder : a.sortOrder - b.sortOrder;
    });
  }
  function nextBirthday(value) {
    var source = new Date(String(value) + "T12:00:00");
    if (Number.isNaN(source.getTime())) return new Date();
    var now = new Date(), target = new Date(now.getFullYear(), source.getMonth(), source.getDate(), 0, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setFullYear(target.getFullYear() + 1);
    return target;
  }
  function heroEyebrow(template, name) {
    var copy = { bright_warm: "给 " + name + " 的生日小宇宙", playful_loud: "今天必须为 " + name + " 热热闹闹", midnight_romance: "为 " + name + " 藏起的一晚星光", letter_like: "一封写给 " + name + " 的生日信" };
    return copy[template.copyTone] || "今天的主角，就是 " + name;
  }
  function signatureFor(sender, content) {
    if (sender && sender.anonymous) return "一份悄悄送达的心意";
    var signature = text(content.senderSignature || content.sender_signature || content.signature, 80);
    if (signature) return signature;
    var name = text(sender && sender.name, 40); return name ? "From " + name : "";
  }
  function defaultHeadline(name) { return "愿" + name + "每天都闪闪发光"; }
  function defaultMessage(name) { return "今天的偏爱、祝福和好多好多快乐，都想认真地送给" + name + "。"; }
  function cleanSlug(value) { var slug = String(value || "").trim(); return /^[a-zA-Z0-9_-]{12,64}$/.test(slug) ? slug : ""; }
  function withTimeout(promise, duration) {
    return new Promise(function (resolve, reject) {
      var timer = window.setTimeout(function () { reject(pageError("network-error", "网络开了一会儿小差，请检查网络后重试。")); }, duration);
      Promise.resolve(promise).then(function (value) { window.clearTimeout(timer); resolve(value); }, function (error) { window.clearTimeout(timer); reject(error); });
    });
  }
  async function functionError(error, fallback) {
    var response = error && error.context;
    if (response && typeof response.clone === "function") {
      try {
        var data = await response.clone().json();
        if (data && data.error) {
          var knownStates = ["not-found", "unpublished", "render-error", "network-error"];
          var state = knownStates.indexOf(String(data.code || "")) >= 0
            ? String(data.code)
            : classifyError(new Error(String(data.error))).state;
          return pageError(state, String(data.error));
        }
      } catch (_) {}
    }
    return pageError("network-error", error && error.message || fallback);
  }
  function classifyError(error) {
    if (error && error.state) return { state: error.state, title: titleForState(error.state), message: error.message };
    var message = String(error && error.message || "暂时无法打开这份生日惊喜。 ");
    if (/不存在|无效|not found/i.test(message)) return { state: "not-found", title: titleForState("not-found"), message: message };
    if (/尚未发布|未发布|unpublished/i.test(message)) return { state: "unpublished", title: titleForState("unpublished"), message: message };
    return { state: "network-error", title: titleForState("network-error"), message: message };
  }
  function titleForState(state) { return { empty: "这份生日惊喜还没有完整链接", "not-found": "没有找到这份生日惊喜", unpublished: "这份生日惊喜还在准备中", "network-error": "网络开了一会儿小差", "render-error": "这份生日惊喜暂时没有准备好" }[state] || "暂时无法打开"; }
  function renderLoading() {
    root.dataset.pageState = "loading";
    root.innerHTML = '<section class="birthday-loading"><div class="loading-gift" aria-hidden="true"></div><p>有一份为你准备的生日惊喜，正在送达…</p><span>请稍等一小会儿</span></section>';
  }
  function renderStatus(state, title, message) {
    cleanupMountedFeatures(); runtime.state = state; root.dataset.pageState = state;
    root.innerHTML = '<section class="birthday-error birthday-error-' + escapeHtml(state) + '"><span aria-hidden="true">✦</span><strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(message || "请稍后再试。") + '</p><button type="button" class="warm-action" data-retry-page>再试一次</button></section>';
    root.querySelector("[data-retry-page]").addEventListener("click", function () { var env = parseSlugAndEnvironment(); if (env.slug) void loadBirthdayPage(env); });
  }
  function cleanupMountedFeatures() {
    while (runtime.cleanup.length) { var cleanup = runtime.cleanup.pop(); try { if (typeof cleanup === "function") cleanup(); } catch (_) {} }
    if (runtime.activeWishClose) runtime.activeWishClose();
    else if (runtime.activeWishLayer) { runtime.activeWishLayer.remove(); runtime.activeWishLayer = null; }
    if (window.closeActiveSurpriseExperience) window.closeActiveSurpriseExperience();
    runtime.storyMounted = false;
  }
  function pageError(state, message) { var error = new Error(message); error.state = state; return error; }
  function reportReadyOrError(state, payload) {
    if (state === "ready") return reportReady(payload);
    return reportFailure(state, payload);
  }
  function reportReady(model) { if (isDevelopment()) console.info("Birthday page ready", { slug: model.slug, template: model.template.id, version: model.template.version }); }
  function reportFailure(state, error) { if (isDevelopment()) console.warn("Birthday page failed", { state: state, message: error && error.message }); }
  function isDevelopment() { return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname); }
  function reducedMotion() { return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function formatDate(value) { var date = new Date(value + "T12:00:00"); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" }); }
  function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  function text(value, limit) { return String(value == null ? "" : value).replace(/[<>]/g, "").trim().slice(0, limit == null ? 500 : limit); }
  function number(value, fallback) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function trapFocus(event, dialog) {
    var items = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (item) { return item.offsetParent !== null; });
    if (!items.length) { event.preventDefault(); return; }
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function escapeHtml(value) { var element = document.createElement("div"); element.textContent = String(value == null ? "" : value); return element.innerHTML; }

  window.bootstrapBirthdayPage = bootstrapBirthdayPage;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrapBirthdayPage, { once: true });
  else bootstrapBirthdayPage();
})();