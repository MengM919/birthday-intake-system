(function () {
  "use strict";

  var emojis = ["🎂", "🎈", "✨", "🎁", "🌷", "💌", "⭐", "🫶"];

  function client() {
    var value = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
    if (!value) throw new Error("祝福墙暂时不可用，请稍后再试。");
    return value;
  }

  async function invoke(payload) {
    var result = await client().functions.invoke("post-public-blessing", { body: payload });
    if (result.error) throw new Error(result.error.message || "祝福墙暂时不可用，请稍后再试。");
    if (!result.data || result.data.ok === false) {
      throw new Error(result.data && result.data.error || "祝福墙暂时不可用，请稍后再试。");
    }
    return result.data;
  }

  async function mount(options) {
    var root = options && options.root;
    var slug = options && options.slug;
    if (!root || !slug) return;

    root.innerHTML =
      '<div class="wall-heading"><div><p class="section-kicker">BIRTHDAY NOTES</p><h2>祝福墙</h2><p>所有拿到这份生日页链接的人，都可以匿名留下祝福；每一条都会即时展示。</p></div>' +
      '<div class="wall-heading-actions"><button class="wall-refresh-button" type="button">刷新</button><button class="wall-open-button" type="button">写一句祝福</button></div></div>' +
      '<div class="public-wall-list" aria-live="polite"></div><div class="wall-pager"></div>';

    var list = root.querySelector(".public-wall-list");
    var pager = root.querySelector(".wall-pager");
    var nextOffset = 0;

    async function load(offset, append) {
      if (!append) list.innerHTML = '<p class="wall-loading">正在收集大家的心意…</p>';
      try {
        var data = await invoke({ action: "list", slug: slug, offset: offset, limit: 12 });
        nextOffset = Number(data.nextOffset || 0);
        var markup = (data.messages || []).map(card).join("");
        if (append) list.insertAdjacentHTML("beforeend", markup);
        else list.innerHTML = markup || '<p class="wall-empty">第一份祝福的位置，先留给最早来到这里的你。</p>';
        pager.innerHTML = data.hasMore ? '<button class="wall-more-button" type="button">再看看更多祝福</button>' : "";
      } catch (error) {
        if (!append) list.innerHTML = '<p class="wall-empty">祝福墙暂时不可用，稍后再来写也没关系。</p>';
        pager.innerHTML = "";
        console.warn("Public blessing wall load failed:", error);
      }
    }

    root.querySelector(".wall-open-button").addEventListener("click", function () {
      openComposer(root, slug, list);
    });
    root.querySelector(".wall-refresh-button").addEventListener("click", function () {
      void load(0, false);
    });
    pager.addEventListener("click", function (event) {
      if (event.target.closest(".wall-more-button")) void load(nextOffset, true);
    });

    await load(0, false);
  }

  function openComposer(root, slug, list) {
    if (document.querySelector(".wall-composer")) return;
    var layer = document.createElement("section");
    layer.className = "wall-composer";
    layer.innerHTML = '<form class="wall-composer-card"><button class="composer-close" type="button" aria-label="关闭">×</button><p class="section-kicker">A LITTLE NOTE</p><h3>留下一句生日祝福</h3><label>你的昵称 <span>可留空</span><input name="nickname" maxlength="20" placeholder="例如：老朋友"></label><label class="anonymous-row"><input name="anonymous" type="checkbox"> 匿名送出这份心意</label><div class="emoji-row">' + emojis.map(function (emoji, index) { return '<button type="button" class="emoji-choice ' + (index === 2 ? "selected" : "") + '" data-emoji="' + emoji + '">' + emoji + '</button>'; }).join("") + '</div><label>想对 TA 说的话<textarea name="message" maxlength="200" required placeholder="生日快乐呀，愿你一直被爱和好运围绕。"></textarea></label><input class="honeypot" name="website" tabindex="-1" autocomplete="off"><p class="composer-error" aria-live="polite"></p><button class="wall-submit-button" type="submit">送出这份祝福</button></form>';
    document.body.appendChild(layer);

    var form = layer.querySelector("form");
    var selectedEmoji = "✨";
    layer.querySelector(".composer-close").addEventListener("click", function () { layer.remove(); });
    layer.addEventListener("click", function (event) { if (event.target === layer) layer.remove(); });
    layer.querySelector(".emoji-row").addEventListener("click", function (event) {
      var button = event.target.closest("[data-emoji]");
      if (!button) return;
      selectedEmoji = button.dataset.emoji;
      layer.querySelectorAll("[data-emoji]").forEach(function (item) {
        item.classList.toggle("selected", item === button);
      });
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var submit = form.querySelector("[type=submit]");
      var errorBox = form.querySelector(".composer-error");
      var fields = new FormData(form);
      submit.disabled = true;
      submit.textContent = "正在送出…";
      errorBox.textContent = "";
      try {
        var data = await invoke({
          action: "create",
          slug: slug,
          nickname: fields.get("nickname"),
          anonymous: fields.get("anonymous") === "on",
          message: fields.get("message"),
          emoji: selectedEmoji,
          website: fields.get("website")
        });
        if (data.message && data.message.id !== "ignored") {
          var empty = list.querySelector(".wall-empty");
          if (empty) empty.remove();
          list.insertAdjacentHTML("afterbegin", card(data.message));
        }
        layer.remove();
      } catch (error) {
        errorBox.textContent = error.message || "暂时没能收下这份祝福，请稍后再试。";
        submit.disabled = false;
        submit.textContent = "送出这份祝福";
      }
    });
  }

  function card(message) {
    return '<article class="public-wall-card"><span class="wall-emoji">' + escapeHtml(message.emoji || "✨") + '</span><p>' + escapeHtml(message.message || "") + '</p><small>— ' + escapeHtml(message.nickname || "匿名朋友") + '</small></article>';
  }

  function escapeHtml(value) {
    var element = document.createElement("div");
    element.textContent = String(value == null ? "" : value);
    return element.innerHTML;
  }

  window.BirthdayPublicWall = { mount: mount };
})();