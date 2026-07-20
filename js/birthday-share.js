(function () {
  "use strict";

  function mount(options) {
    var root = options && options.root;
    var page = options && options.page || {};
    if (!root) return function () {};
    var url = String(page.publishedUrl || window.location.href);
    var title = String(page.shareTitle || document.title || "生日惊喜");
    var text = String(page.shareDescription || "有一份认真准备的生日惊喜，想邀请你一起打开。 ");

    updateMeta({ title: title, description: text, url: url, image: page.shareCoverUrl || "" });

    function message(value) {
      var output = root.querySelector("[data-share-feedback]");
      if (output) output.textContent = value;
    }

    async function copy() {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(url);
        else {
          var input = document.createElement("textarea");
          input.value = url;
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          input.remove();
        }
        message("链接已经复制好啦，快把这份惊喜送出去。 ");
      } catch (error) {
        message("复制没有成功，你可以长按地址栏里的链接分享。 ");
      }
    }

    async function onClick(event) {
      var share = event.target.closest("[data-share-page]");
      var copyButton = event.target.closest("[data-copy-link]");
      if (copyButton) { await copy(); return; }
      if (!share) return;
      if (/micromessenger/i.test(navigator.userAgent || "")) {
        message("微信里请点击右上角的“…”把这份惊喜分享给朋友。 ");
        return;
      }
      if (navigator.share) {
        try {
          await navigator.share({ title: title, text: text, url: url });
          message("谢谢你把这份心意继续送出去。 ");
          return;
        } catch (error) {
          if (error && error.name === "AbortError") return;
        }
      }
      await copy();
    }

    root.addEventListener("click", onClick);
    return function cleanup() { root.removeEventListener("click", onClick); };
  }

  function updateMeta(data) {
    document.title = data.title || document.title;
    setMeta("name", "description", data.description);
    setMeta("property", "og:title", data.title);
    setMeta("property", "og:description", data.description);
    setMeta("property", "og:url", data.url);
    if (data.image) setMeta("property", "og:image", data.image);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = data.url;
  }

  function setMeta(kind, name, content) {
    if (!content) return;
    var selector = 'meta[' + kind + '="' + name + '"]';
    var node = document.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      node.setAttribute(kind, name);
      document.head.appendChild(node);
    }
    node.content = content;
  }

  window.BirthdayShare = { mount: mount, updateMeta: updateMeta };
})();