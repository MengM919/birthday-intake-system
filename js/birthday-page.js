(function () {
  "use strict";

  var root = document.querySelector("#birthdayPage");
  var slug = new URLSearchParams(location.search).get("slug");
  var timer = 0;
  var themes = {
    T01: { className:"sunny-sketch", primary:"#f06292", accent:"#2e88e7", bg:"#fffdf7", ink:"#262220", decor:["✦","🌸","✎"] },
    T02: { className:"cherry-collage", primary:"#d94e3f", accent:"#1764a5", bg:"#fff0d8", ink:"#33201a", decor:["🍒","✦","♡"] },
    T03: { className:"love-letter", primary:"#df6259", accent:"#2177be", bg:"#fff4df", ink:"#35251f", decor:["✉","♡","✦"] },
    T04: { className:"blue-club", primary:"#ff76ad", accent:"#f5c347", bg:"#103d8d", ink:"#fffaf0", decor:["★","🎁","✦"] },
    T05: { className:"today-star", primary:"#ed6e96", accent:"#9674e6", bg:"#fff6f8", ink:"#3b2930", decor:["🎈","✦","🎂"] },
    T06: { className:"pink-midnight", primary:"#ea7b9e", accent:"#e7bdcb", bg:"#171115", ink:"#fff5f7", decor:["☾","✦","♡"] },
    T07: { className:"california", primary:"#e67c5b", accent:"#4e908d", bg:"#fff1d9", ink:"#3b3128", decor:["☀","🌺","〰"] },
    T08: { className:"dear-you", primary:"#d87d99", accent:"#9c89c4", bg:"#fff0f3", ink:"#4b343a", decor:["🎀","♡","🌷"] },
    T09: { className:"summer-blue", primary:"#2878bc", accent:"#75b9d5", bg:"#eff9ff", ink:"#234263", decor:["⚓","✦","🐚"] },
    T10: { className:"birthday-rush", primary:"#f44e8d", accent:"#784ef3", bg:"#fff4fa", ink:"#33263c", decor:["🎉","🎈","✦"] },
    T11: { className:"love-graffiti", primary:"#ed3281", accent:"#1b67dc", bg:"#fff9eb", ink:"#251f20", decor:["✦","♡","★"] }
  };
  var labels = {
    gallery:"回忆相册", messageWall:"祝福墙", wishBottle:"许愿瓶", futureMailbox:"未来信箱",
    dailyLuck:"今日好运", surpriseBox:"惊喜盲盒", bgm:"背景音乐", countdown:"生日倒计时"
  };
  var icons = { gallery:"▣", messageWall:"✎", wishBottle:"✦", futureMailbox:"✉", dailyLuck:"☀", surpriseBox:"🎁", bgm:"♫", countdown:"🎂" };

  if (!slug) return fail("这份生日惊喜链接无效。");
  load();

  async function load() {
    try {
      var client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) throw new Error("生日页服务暂时不可用。");
      var response = await client.functions.invoke("get-published-page", { body: { slug: slug } });
      if (response.error) throw response.error;
      if (!response.data || !response.data.ok || !response.data.page) throw new Error(response.data && response.data.error || "暂时无法打开这份生日惊喜。");
      draw(response.data.page);
    } catch (error) {
      console.error("Published birthday page load failed:", error);
      fail(error.message || "暂时无法打开这份生日惊喜。");
    }
  }

  function draw(page) {
    var templateId = page.templateId || "T01";
    var theme = Object.assign({}, themes[templateId] || themes.T01, page.palette || {});
    var recipient = page.recipient || {};
    var sender = page.sender || {};
    var content = page.content || {};
    var modules = page.modules || {};
    var gallery = Array.isArray(page.photos && page.photos.gallery) ? page.photos.gallery.slice() : [];
    var featured = gallery.filter(function (photo) { return photo.isFeatured; }).sort(compareFeatured);
    var fallback = gallery.filter(function (photo) { return !photo.isFeatured; });
    featured = featured.concat(fallback).slice(0, 8);
    var shownUrls = new Set(featured.map(function (photo) { return photo.url; }));
    var remaining = gallery.filter(function (photo) { return !shownUrls.has(photo.url); });
    var name = recipient.name || "TA";
    var headline = cleanHeadline(content.headline || "愿" + name + "的新一岁闪闪发光");
    document.title = name + " 的生日惊喜";
    document.documentElement.style.setProperty("--birthday-primary", theme.primary);
    document.documentElement.style.setProperty("--birthday-accent", theme.accent);
    document.documentElement.style.setProperty("--birthday-bg", theme.bg);
    document.documentElement.style.setProperty("--birthday-ink", theme.ink);
    root.innerHTML = '<main class="birthday-shell theme-' + escapeHtml(templateId) + ' ' + theme.className + '">' +
      decoration(theme) +
      '<section class="hero-section" id="top">' +
        '<nav class="top-feature-dock" aria-label="生日页面功能">' + featureButtons(modules, gallery.length > 0) + '</nav>' +
        '<div class="hero-layout">' +
          '<div class="hero-copy">' +
            '<p class="hero-note">FOR ' + escapeHtml(name).toUpperCase() + ' · TODAY IS YOUR DAY</p>' +
            '<h1 class="hero-headline">' + escapeHtml(headline) + '</h1>' +
            '<p class="hero-message">' + escapeHtml(content.message || "今天的偏爱、祝福和好多好多快乐，都想认真地送给你。") + '</p>' +
            (sender.anonymous ? '<p class="hero-signature">一份悄悄送达的心意</p>' : '<p class="hero-signature">From ' + escapeHtml(content.signature || sender.name || "一位爱你的人") + '</p>') +
          '</div>' + coverMarkup(page.photos && page.photos.cover, name) +
        '</div>' +
      '</section>' +
      '<section id="countdown" class="countdown-section"><div class="countdown-label"><span>🎂</span><p>距离下一次生日还有</p><span>✦</span></div><div id="birthdayCountdown" class="countdown-grid"></div></section>' +
      '<div class="page-sections">' +
        (gallery.length ? albumMarkup(featured, remaining) : "") +
        (modules.messageWall ? wallMarkup() : "") +
        (modules.wishBottle ? wishMarkup(modules.wishBottle) : "") +
        (modules.futureMailbox ? futureMarkup(modules.futureMailbox) : "") +
        (modules.dailyLuck ? luckMarkup() : "") +
        (modules.surpriseBox ? surpriseMarkup(modules.surpriseBox) : "") +
        (modules.bgm ? musicMarkup() : "") +
      '</div>' +
      '<footer class="birthday-footer"><span>✦</span> 今天的快乐已经妥善收藏 <span>♡</span></footer>' +
    '</main>';
    bindPageEvents(page, theme, name);
    startCountdown(recipient.birthday);
    if (modules.messageWall && window.BirthdayPublicWall) void window.BirthdayPublicWall.mount({ slug: slug, root: document.querySelector("#publicBlessingWall") });
    if (modules.dailyLuck && window.BirthdayDailyLuck) void renderDailyLuck(recipient.birthday);
  }

  function decoration(theme) {
    return '<div class="page-stickers" aria-hidden="true">' + theme.decor.map(function (item, index) { return '<span class="sticker sticker-' + (index + 1) + '">' + item + '</span>'; }).join("") + '</div>';
  }

  function featureButtons(modules, hasGallery) {
    var entries = ["countdown"];
    if (hasGallery) entries.push("gallery");
    ["messageWall", "wishBottle", "futureMailbox", "dailyLuck", "surpriseBox", "bgm"].forEach(function (key) { if (modules[key]) entries.push(key); });
    return entries.map(function (key) {
      var target = key === "gallery" ? "#gallery" : key === "countdown" ? "#countdown" : "#module-" + key;
      return '<button type="button" data-scroll="' + target + '"><span>' + icons[key] + '</span>' + labels[key] + '</button>';
    }).join("");
  }
  function coverMarkup(photo, name) {
    if (!photo || !photo.url) return '<div class="hero-photo placeholder-photo"><span>♡</span><p>今天的主角</p></div>';
    var x = Math.max(0, Math.min(1, Number(photo.focalX == null ? .5 : photo.focalX))) * 100;
    var y = Math.max(0, Math.min(1, Number(photo.focalY == null ? .5 : photo.focalY))) * 100;
    return '<figure class="hero-photo" style="--focal-x:' + x + '%;--focal-y:' + y + '%"><img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(name) + ' 的封面照" referrerpolicy="no-referrer"><figcaption><span>birthday star</span>' + escapeHtml(name) + '</figcaption></figure>';
  }

  function albumMarkup(featured, remaining) {
    var allPhotos = featured.concat(remaining);
    var pages = [];
    for (var start = 0; start < allPhotos.length; start += 8) {
      pages.push(allPhotos.slice(start, start + 8));
    }
    if (!pages.length) pages.push([]);

    return '<section id="gallery" class="content-section album-section"><div class="section-heading"><div><p class="section-kicker">MEMORY ALBUM</p><h2>回忆相册</h2><p>有些瞬间，值得被好好装进这一页。</p></div><span class="section-stamp">KEEP<br>SMILING</span></div><div class="gallery-pages">' +
      pages.map(function (photos, pageIndex) {
        return '<div class="polaroid-gallery gallery-page" data-gallery-page="' + pageIndex + '"' + (pageIndex ? ' hidden' : '') + '>' +
          photos.map(function (photo, index) { return photoCard(photo, pageIndex * 8 + index); }).join("") +
        '</div>';
      }).join("") +
      '</div>' +
      (pages.length > 1 ? '<div class="gallery-pagination"><button type="button" class="gallery-page-button" data-gallery-prev disabled>上一组</button><span data-gallery-page-status>第 1 / ' + pages.length + ' 组</span><button type="button" class="gallery-page-button" data-gallery-next>下一组</button></div>' : "") +
    '</section>';
  }

  function photoCard(photo, index) {
    var caption = photo.caption || ["这一天很亮", "我们在一起", "留住小小快乐", "生日快乐呀"][index % 4];
    return '<figure class="polaroid polaroid-' + (index % 5) + '"><img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(caption) + '" loading="lazy" referrerpolicy="no-referrer"><figcaption>' + escapeHtml(caption) + '</figcaption></figure>';
  }

  function wallMarkup() {
    return '<section id="module-messageWall" class="content-section wall-section"><div id="publicBlessingWall"></div></section>';
  }

  function wishMarkup(config) {
    return '<section id="module-wishBottle" class="content-section module-section wish-section"><div class="section-heading"><div><p class="section-kicker">MAKE A WISH</p><h2>' + escapeHtml(config.title || "许愿瓶") + '</h2><p>' + escapeHtml(config.prompt || "把一个小小愿望放进瓶子里，慢慢等它发光。") + '</p></div><span class="module-sticker">✦</span></div><button type="button" class="warm-action" data-wish>许下一个心愿</button></section>';
  }

  function futureMarkup(config) {
    return '<section id="module-futureMailbox" class="content-section module-section future-section"><div class="section-heading"><div><p class="section-kicker">LETTER FOR LATER</p><h2>未来信箱</h2><p>有一封信，留给未来的你慢慢打开。</p></div><span class="module-sticker">✉</span></div><div class="future-letter" data-future-letter data-open-date="' + escapeHtml(config.openDate || "") + '" data-letter="' + escapeHtml(config.content || "") + '"></div></section>';
  }

  function luckMarkup() {
    return '<section id="module-dailyLuck" class="content-section module-section luck-section"><div class="section-heading"><div><p class="section-kicker">TODAY IS LUCKY</p><h2>今日好运</h2><p>今天的星象和宜忌，会安静地陪在你身边。</p></div><span class="module-sticker">☀</span></div><div id="dailyLuckContent" class="daily-luck-content"><p>正在为 TA 查找今天的小幸运…</p></div></section>';
  }

  function surpriseMarkup(config) {
    return '<section id="module-surpriseBox" class="content-section module-section surprise-section"><div class="section-heading"><div><p class="section-kicker">A LITTLE SURPRISE</p><h2>' + escapeHtml(config.surpriseTitle || "给你藏了一份小惊喜") + '</h2><p>' + escapeHtml(config.surpriseMessage || "今天的所有温柔，都想围过来陪你过生日。") + '</p></div><span class="module-sticker">🎁</span></div><button type="button" class="warm-action" data-surprise>打开惊喜盲盒</button></section>';
  }

  function musicMarkup() {
    return '<section id="module-bgm" class="content-section music-section"><span>♫</span><div><p class="section-kicker">A SONG FOR YOU</p><h2>背景音乐已为你准备好</h2><p>轻触页面后，温柔的旋律会慢慢响起。</p></div></section>';
  }

  function bindPageEvents(page, theme, name) {
    root.addEventListener("click", function (event) {
      var scroll = event.target.closest("[data-scroll]");
      if (scroll) { var target = document.querySelector(scroll.dataset.scroll); if (target) target.scrollIntoView({ behavior:"smooth", block:"start" }); }
      var pageControl = event.target.closest("[data-gallery-prev], [data-gallery-next]");
      if (pageControl) switchGalleryPage(pageControl.matches("[data-gallery-next]") ? 1 : -1);
      if (event.target.closest("[data-wish]")) openWishComposer();
      if (event.target.closest("[data-surprise]") && window.openSurpriseExperience) {
        window.openSurpriseExperience(page.modules.surpriseBox || {}, { templateId: page.templateId, primaryColor: theme.primary, accentColor: theme.accent, backgroundColor: theme.bg });
      }
    });
    var future = root.querySelector("[data-future-letter]");
    if (future) renderFutureLetter(future);
  }

  function switchGalleryPage(direction) {
    var pages = Array.prototype.slice.call(root.querySelectorAll("[data-gallery-page]"));
    if (!pages.length) return;
    var current = pages.findIndex(function (page) { return !page.hidden; });
    var next = Math.max(0, Math.min(pages.length - 1, current + direction));
    if (next === current) return;
    pages.forEach(function (page, index) { page.hidden = index !== next; });
    var status = root.querySelector("[data-gallery-page-status]");
    var previous = root.querySelector("[data-gallery-prev]");
    var following = root.querySelector("[data-gallery-next]");
    if (status) status.textContent = "第 " + (next + 1) + " / " + pages.length + " 组";
    if (previous) previous.disabled = next === 0;
    if (following) following.disabled = next === pages.length - 1;
  }

  function openWishComposer() {
    var layer = document.createElement("section");
    layer.className = "wish-composer";
    layer.innerHTML = '<form><button class="composer-close" type="button" aria-label="关闭">×</button><p class="section-kicker">ONE SMALL WISH</p><h3>把心愿装进瓶子里</h3><textarea maxlength="120" required placeholder="希望明年的今天，也有好多值得开心的事。"></textarea><p class="composer-error"></p><button class="warm-action" type="submit">好好收下这个愿望</button></form>';
    document.body.appendChild(layer);
    layer.querySelector(".composer-close").onclick = function () { layer.remove(); };
    layer.addEventListener("click", function (event) { if (event.target === layer) layer.remove(); });
    layer.querySelector("form").onsubmit = function (event) {
      event.preventDefault();
      var text = layer.querySelector("textarea").value.trim();
      var error = layer.querySelector(".composer-error");
      if (!text) { error.textContent = "写下一句心愿，再把它放进瓶子里吧。"; return; }
      layer.querySelector("form").innerHTML = '<div class="wish-sent"><span>✦</span><h3>愿望已经好好收下</h3><p>它会在适合的时候，慢慢向你靠近。</p><button class="warm-action" type="button">知道啦</button></div>';
      layer.querySelector("button").onclick = function () { layer.remove(); };
    };
  }

  function renderFutureLetter(element) {
    var openDate = element.dataset.openDate;
    var letter = element.dataset.letter || "";
    if (!openDate || new Date(openDate + "T23:59:59").getTime() <= Date.now()) {
      element.innerHTML = '<p class="future-open-label">TO FUTURE YOU</p><p>' + escapeHtml(letter || "愿未来的每一天，也都有人认真为你庆祝。") + '</p>';
      return;
    }
    var date = new Date(openDate + "T12:00:00");
    element.innerHTML = '<p class="future-open-label">SEALED UNTIL</p><strong>' + date.toLocaleDateString("zh-CN", { year:"numeric", month:"long", day:"numeric" }) + '</strong><p>这封信会在那一天，再轻轻打开。</p>';
  }

  async function renderDailyLuck(birthday) {
    var rootNode = document.querySelector("#dailyLuckContent");
    if (!rootNode) return;
    try {
      var data = await window.BirthdayDailyLuck.getDailyLuck(birthday);
      var horoscope = data.horoscope;
      var almanac = data.almanac;
      var cards = [];

      if (horoscope) {
        var horoscopeDetails = [
          horoscope.love ? "爱情：" + horoscope.love : "",
          horoscope.work ? "工作：" + horoscope.work : ""
        ].filter(Boolean).join(" · ");
        cards.push('<div class="luck-card"><span>星座 · ' + escapeHtml(horoscope.astro || data.zodiac || "") + '</span><strong>' +
          escapeHtml(horoscope.summary || "今日星座数据已更新，详情暂未提供。") + '</strong><small>幸运色：' +
          escapeHtml(horoscope.luckyColor || "暂无") + ' · 幸运数字：' + escapeHtml(horoscope.luckyNumber || "暂无") +
          (horoscopeDetails ? '<br>' + escapeHtml(horoscopeDetails) : "") + '</small></div>');
      } else {
        cards.push('<div class="luck-card luck-partial"><span>星座运势</span><strong>暂时无法读取</strong><small>服务恢复后再来看看也可以。</small></div>');
      }

      if (almanac) {
        cards.push('<div class="luck-card"><span>今日宜忌</span><strong>宜：' + escapeHtml(almanac.suitable || "暂无") + '</strong><small>忌：' + escapeHtml(almanac.avoid || "暂无") + '</small></div>');
      } else {
        cards.push('<div class="luck-card luck-partial"><span>今日宜忌</span><strong>暂时无法读取</strong><small>服务恢复后再来看看也可以。</small></div>');
      }

      rootNode.innerHTML = cards.join("") + '<p class="luck-meta">数据更新：' +
        escapeHtml(formatLuckTime(data.updatedAt)) + ' · ' + escapeHtml(data.disclaimer || "仅供娱乐参考") + '</p>';
    } catch (error) {
      rootNode.innerHTML = '<p class="luck-unavailable">今日好运暂时在路上，请稍后再来看看。</p>';
      console.warn("Daily luck unavailable:", error);
    }
  }

  function formatLuckTime(value) {
    var date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "以服务返回为准";
    return date.toLocaleString("zh-CN", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" });
  }
  function startCountdown(birthday) {
    window.clearInterval(timer);
    var output = document.querySelector("#birthdayCountdown");
    function tick() {
      if (!output || !birthday) return;
      var target = nextBirthday(birthday);
      var distance = Math.max(0, target.getTime() - Date.now());
      var units = [
        [Math.floor(distance / 86400000), "天"],
        [Math.floor(distance % 86400000 / 3600000), "时"],
        [Math.floor(distance % 3600000 / 60000), "分"],
        [Math.floor(distance % 60000 / 1000), "秒"]
      ];
      output.innerHTML = units.map(function (unit) { return '<div><b>' + String(unit[0]).padStart(2, "0") + '</b><span>' + unit[1] + '</span></div>'; }).join("");
    }
    tick(); timer = window.setInterval(tick, 1000);
  }

  function nextBirthday(value) {
    var parsed = new Date(String(value) + "T12:00:00");
    var now = new Date();
    var target = new Date(now.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setFullYear(target.getFullYear() + 1);
    return target;
  }

  function compareFeatured(a, b) { return Number(a.featuredSortOrder || 999) - Number(b.featuredSortOrder || 999); }
  function cleanHeadline(value) { return Array.from(String(value || "").replace(/[<>]/g, "").trim()).slice(0, 15).join("") || "生日快乐"; }
  function escapeHtml(value) { var element = document.createElement("div"); element.textContent = String(value == null ? "" : value); return element.innerHTML; }
  function fail(message) { root.innerHTML = '<section class="birthday-error"><span>♡</span><strong>暂时无法打开</strong><p>' + escapeHtml(message || "请稍后再试。") + '</p></section>'; }
})();
