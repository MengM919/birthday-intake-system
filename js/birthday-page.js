(function () {
  "use strict";

  const page = document.querySelector("#birthdayPage");
  const slug = new URLSearchParams(window.location.search).get("slug");

  if (!slug || !/^[a-zA-Z0-9_-]{12,64}$/.test(slug)) {
    showError("这份生日惊喜链接无效或已失效。");
    return;
  }

  loadPage();

  async function loadPage() {
    try {
      const client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) throw new Error("生日页服务暂未配置。");
      const { data, error } = await client.functions.invoke("get-published-page", {
        body: { slug }
      });
      if (error) throw error;
      if (!data || !data.page) throw new Error(data && data.error ? data.error : "未找到这份生日惊喜。");
      renderPage(data.page);
    } catch (error) {
      console.error("Could not load published birthday page:", error);
      showError(error.message || "这份生日惊喜暂时无法打开。");
    }
  }

  function renderPage(config) {
    const palette = normalizePalette(config.palette, config.templateId);
    document.documentElement.style.setProperty("--page-bg", palette.background);
    document.documentElement.style.setProperty("--page-primary", palette.primary);
    document.documentElement.style.setProperty("--page-accent", palette.accent);
    document.title = (config.recipient && config.recipient.name ? config.recipient.name + "的生日惊喜" : "生日惊喜");

    const recipient = config.recipient || {};
    const content = config.content || {};
    const photos = config.photos || {};
    const coverUrl = photos.cover && photos.cover.url ? photos.cover.url : "assets/templates/" + escapeAttr(config.templateId || "T01") + "/preview.png";
    const gallery = Array.isArray(photos.gallery) ? photos.gallery : [];
    const surprise = config.modules && config.modules.surpriseBox && config.modules.surpriseBox.enabled
      ? config.modules.surpriseBox
      : null;

    page.innerHTML = `
      <div class="birthday-shell">
        <div class="page-kicker"><span>Happy Birthday</span><span>${escapeHTML(config.templateName || config.templateId || "")}</span></div>
        <section class="hero">
          <img class="hero-media" src="${escapeAttr(coverUrl)}" alt="${escapeAttr(recipient.name || "生日封面")}" referrerpolicy="no-referrer">
          <div class="hero-shade"></div>
          <div class="hero-content">
            <h1>${escapeHTML(content.headline || "今天是属于你的特别一天")}</h1>
            <p>${escapeHTML(content.message || "愿今天所有的偏爱和祝福，都轻轻落在你身上。")}</p>
            ${content.signature ? `<p class="hero-signature">${escapeHTML(content.signature)}</p>` : ""}
          </div>
        </section>
        <section class="countdown" aria-label="生日倒计时" id="birthdayCountdown"></section>
        ${surprise ? `
          <section class="section">
            <div class="surprise-card">
              <h2>${escapeHTML(surprise.surpriseTitle || "给你藏了一份小惊喜")}</h2>
              <p>打开后，页面会短暂进入一段只属于你的生日时刻。</p>
              <button class="primary-action" id="openSurprise" type="button">打开惊喜盲盒</button>
            </div>
          </section>` : ""}
        ${gallery.length ? `
          <section class="section">
            <h2>回忆相册</h2>
            <p class="section-lead">把一起走过的闪光时刻，慢慢收进这一天。</p>
            <div class="gallery">${gallery.map((photo) => `<figure><img src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.caption || "回忆照片")}" loading="lazy" referrerpolicy="no-referrer"></figure>`).join("")}</div>
          </section>` : ""}
        <footer class="page-footer"><strong>For ${escapeHTML(recipient.name || "you")}</strong><br>这份页面仅通过专属链接访问</footer>
      </div>`;

    updateCountdown(recipient.birthday);
    window.setInterval(() => updateCountdown(recipient.birthday), 1000);

    const surpriseButton = document.querySelector("#openSurprise");
    if (surpriseButton) {
      surpriseButton.addEventListener("click", () => {
        if (!window.openSurpriseExperience) return;
        window.openSurpriseExperience(surprise, {
          templateId: config.templateId,
          primaryColor: palette.primary,
          accentColor: palette.accent,
          backgroundColor: palette.background
        });
      });
    }
  }

  function updateCountdown(birthday) {
    const target = nextBirthday(birthday);
    const output = document.querySelector("#birthdayCountdown");
    if (!output || !target) return;
    const diff = Math.max(0, target.getTime() - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff % 86400000 / 3600000);
    const minutes = Math.floor(diff % 3600000 / 60000);
    const seconds = Math.floor(diff % 60000 / 1000);
    output.innerHTML = [[days, "天"], [hours, "时"], [minutes, "分"], [seconds, "秒"]]
      .map(([value, label]) => `<div><strong>${String(value).padStart(2, "0")}</strong><span>${label}</span></div>`).join("");
  }

  function nextBirthday(value) {
    if (!value) return null;
    const date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) return null;
    const now = new Date();
    let target = new Date(now.getFullYear(), date.getMonth(), date.getDate());
    if (target.getTime() < now.getTime()) target = new Date(now.getFullYear() + 1, date.getMonth(), date.getDate());
    return target;
  }

  function normalizePalette(value, templateId) {
    const fallback = {
      T04: ["#154f9d", "#f4ca57", "#102c62"],
      T06: ["#e36d8d", "#d9b2c2", "#171217"],
      T07: ["#e97f5a", "#75a197", "#fff2dd"],
      T09: ["#2b78c4", "#85b9d6", "#eef8ff"]
    };
    const list = fallback[templateId] || ["#e9697c", "#67ae9b", "#fff8f2"];
    const source = value && typeof value === "object" ? value : {};
    return {
      primary: source.primary || source.primaryColor || list[0],
      accent: source.accent || source.accentColor || list[1],
      background: source.background || source.backgroundColor || list[2]
    };
  }

  function showError(message) {
    page.innerHTML = `<section class="birthday-error"><strong>暂时无法打开</strong><p>${escapeHTML(message)}</p></section>`;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }
  function escapeAttr(value) { return escapeHTML(value); }
})();
