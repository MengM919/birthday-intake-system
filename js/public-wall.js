(function () {
  "use strict";

  var emojis = ["🎂", "🎈", "✨", "🎁", "🌷", "💌", "⭐", "🫶"];

  function client() {
    var value = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
    if (!value) throw new Error("祝福墙暂时不可用，请稍后再试。 ");
    return value;
  }

  async function invoke(payload) {
    var result = await client().functions.invoke("post-public-blessing", { body: payload });
    if (result.error) throw new Error(result.error.message || "祝福墙暂时不可用，请稍后再试。 ");
    if (!result.data || result.data.ok === false) throw new Error(result.data && result.data.error || "祝福墙暂时不可用，请稍后再试。 ");
    return result.data;
  }

  function mount(options) {
    var root = options && options.root;
    var slug = options && options.slug;
    if (!root || !slug) return function () {};

    var disposed = false;
    var requestToken = 0;
    var nextOffset = 0;
    var composer = null;
    var closeComposer = null;
    root.innerHTML =
      '<div class="wall-heading"><div><p class="section-kicker">BIRTHDAY NOTES</p><h2>祝福墙</h2><p>所有拿到这份生日页链接的人，都可以匿名留下一句话。每一份心意都会在这里轻轻出现。</p></div>' +
      '<div class="wall-heading-actions"><button class="wall-refresh-button" type="button" data-wall-refresh>刷新</button><button class="wall-open-button" type="button" data-wall-open>写一句祝福</button></div></div>' +
      '<div class="public-wall-list" aria-live="polite"></div><div class="wall-pager"></div>';

    var list = root.querySelector(".public-wall-list");
    var pager = root.querySelector(".wall-pager");

    async function load(offset, append) {
      var token = ++requestToken;
      if (!append && list) list.innerHTML = '<p class="wall-loading">正在收集大家的心意…</p>';
      try {
        var data = await invoke({ action: "list", slug: slug, offset: offset, limit: 12 });
        if (disposed || token !== requestToken || !list || !pager) return;
        nextOffset = Number(data.nextOffset || 0);
        var markup = (data.messages || []).map(card).join("");
        if (append) list.insertAdjacentHTML("beforeend", markup);
        else list.innerHTML = markup || '<p class="wall-empty">第一份祝福的位置，先留给最早来到这里的你。</p>';
        pager.innerHTML = data.hasMore ? '<button class="wall-more-button" type="button" data-wall-more>再看看更多祝福</button>' : "";
      } catch (error) {
        if (disposed || token !== requestToken || !list || !pager) return;
        if (!append) list.innerHTML = '<p class="wall-empty">祝福墙暂时没连上，稍后再来写也没关系。</p>';
        pager.innerHTML = !append ? '<button class="wall-more-button" type="button" data-wall-retry>重新试试</button>' : "";
        if (isDevelopment()) console.warn("Public blessing wall request failed:", error && error.message || "unknown");
      }
    }

    function onRootClick(event) {
      if (event.target.closest("[data-wall-open]")) {
        openComposer();
        return;
      }
      if (event.target.closest("[data-wall-refresh]")) {
        void load(0, false);
        return;
      }
      if (event.target.closest("[data-wall-more]")) {
        void load(nextOffset, true);
        return;
      }
      if (event.target.closest("[data-wall-retry]")) void load(0, false);
    }

    function openComposer() {
      if (composer || disposed) return;
      var previousFocus = document.activeElement;
      composer = document.createElement("section");
      composer.className = "wall-composer";
      composer.setAttribute("role", "dialog");
      composer.setAttribute("aria-modal", "true");
      composer.setAttribute("aria-label", "写一句生日祝福");
      composer.innerHTML =
        '<form class="wall-composer-card"><button class="composer-close" type="button" data-composer-close aria-label="关闭">×</button>' +
        '<p class="section-kicker">A LITTLE NOTE</p><h3>留下一句生日祝福</h3><p class="composer-hint">愿每一份真心，都能被 TA 看见。</p>' +
        '<label>你的昵称 <span>可留空</span><input name="nickname" maxlength="20" placeholder="例如：老朋友"></label>' +
        '<label class="anonymous-row"><input name="anonymous" type="checkbox"> 匿名送出这份心意</label>' +
        '<div class="emoji-row" aria-label="选择一个小表情">' + emojis.map(function (emoji, index) { return '<button type="button" class="emoji-choice ' + (index === 2 ? "selected" : "") + '" data-emoji="' + emoji + '" aria-label="选择 ' + emoji + '">' + emoji + '</button>'; }).join("") + '</div>' +
        '<label>想对 TA 说的话<textarea name="message" maxlength="200" required placeholder="生日快乐呀，愿你一直被爱和好运围绕。"></textarea></label>' +
        '<input class="honeypot" name="website" tabindex="-1" autocomplete="off"><p class="composer-error" aria-live="polite"></p><button class="wall-submit-button" type="submit">送出这份祝福</button></form>';
      document.body.appendChild(composer);
      var form = composer.querySelector("form");
      var selectedEmoji = "✨";
      var isSubmitting = false;

      function close() {
        if (!composer) return;
        document.removeEventListener("keydown", onKeydown);
        composer.remove();
        composer = null;
        closeComposer = null;
        if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      }
      closeComposer = close;
      function onKeydown(event) { if (event.key === "Escape") { event.preventDefault(); close(); } else if (event.key === "Tab") trapFocus(event, composer); }
      function onClick(event) {
        if (event.target === composer || event.target.closest("[data-composer-close]")) close();
        var emoji = event.target.closest("[data-emoji]");
        if (!emoji) return;
        selectedEmoji = emoji.dataset.emoji || "✨";
        composer.querySelectorAll("[data-emoji]").forEach(function (item) { item.classList.toggle("selected", item === emoji); });
      }
      async function onSubmit(event) {
        event.preventDefault();
        if (isSubmitting) return;
        var fields = new FormData(form);
        var message = cleanText(fields.get("message"), 200);
        var errorBox = form.querySelector(".composer-error");
        if (!message) {
          errorBox.textContent = "写下一句真诚的祝福，再把它送给 TA 吧。";
          return;
        }
        isSubmitting = true;
        var submit = form.querySelector("[type=submit]");
        submit.disabled = true;
        submit.textContent = "正在送出…";
        errorBox.textContent = "";
        try {
          var data = await invoke({ action: "create", slug: slug, nickname: cleanText(fields.get("nickname"), 20), anonymous: fields.get("anonymous") === "on", message: message, emoji: selectedEmoji, website: fields.get("website") });
          if (!disposed && data.message && data.message.id !== "ignored" && list) {
            var empty = list.querySelector(".wall-empty");
            if (empty) empty.remove();
            list.insertAdjacentHTML("afterbegin", card(data.message));
          }
          close();
        } catch (error) {
          errorBox.textContent = error && error.message || "暂时没能收下这份祝福，请稍后再试。";
          submit.disabled = false;
          submit.textContent = "送出这份祝福";
          isSubmitting = false;
        }
      }

      composer.addEventListener("click", onClick);
      form.addEventListener("submit", onSubmit);
      document.addEventListener("keydown", onKeydown);
      var textarea = form.querySelector("textarea");
      if (textarea) textarea.focus();
    }

    root.addEventListener("click", onRootClick);
    void load(0, false);

    return function cleanup() {
      if (disposed) return;
      disposed = true;
      requestToken += 1;
      root.removeEventListener("click", onRootClick);
      if (closeComposer) closeComposer();
      else if (composer) composer.remove();
      composer = null;
      closeComposer = null;
    };
  }

  function card(message) {
    return '<article class="public-wall-card"><span class="wall-emoji" aria-hidden="true">' + escapeHtml(message.emoji || "✨") + '</span><p>' + escapeHtml(message.message || "") + '</p><small>— ' + escapeHtml(message.nickname || "匿名朋友") + '</small></article>';
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function trapFocus(event, dialog) {
    var items = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (item) { return item.offsetParent !== null; });
    if (!items.length) { event.preventDefault(); return; }
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function escapeHtml(value) {
    var element = document.createElement("div");
    element.textContent = String(value == null ? "" : value);
    return element.innerHTML;
  }

  window.BirthdayPublicWall = { mount: mount };
  function isDevelopment() { return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname); }

})();