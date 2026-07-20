(function () {
  "use strict";

  function mount(options) {
    var root = options && options.root;
    if (!root) return function () {};
    var track = root.querySelector("[data-gallery-track]");
    var cards = Array.prototype.slice.call(root.querySelectorAll("[data-gallery-open]"));
    if (!track || !cards.length) return function () {};

    var currentIndex = 0;
    var scrollTimer = 0;
    var destroyed = false;
    var lightbox = null;
    var previousFocus = null;
    var touchStart = null;

    function setProgress(index) {
      currentIndex = Math.max(0, Math.min(cards.length - 1, index));
      var output = root.querySelector("[data-gallery-progress]");
      if (output) output.textContent = (currentIndex + 1) + " / " + cards.length;
      cards.forEach(function (card, cardIndex) {
        card.classList.toggle("is-current", cardIndex === currentIndex);
      });
    }

    function indexFromScroll() {
      var card = cards[0];
      var width = card ? card.getBoundingClientRect().width + 14 : track.clientWidth;
      return Math.round(track.scrollLeft / Math.max(1, width));
    }

    function onScroll() {
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(function () { setProgress(indexFromScroll()); }, 70);
    }

    function move(delta) {
      var next = Math.max(0, Math.min(cards.length - 1, currentIndex + delta));
      var target = cards[next];
      if (target) target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      setProgress(next);
    }

    function onClick(event) {
      var next = event.target.closest("[data-gallery-next]");
      var previous = event.target.closest("[data-gallery-prev]");
      var open = event.target.closest("[data-gallery-open]");
      if (next) { move(1); return; }
      if (previous) { move(-1); return; }
      if (open) openLightbox(Number(open.dataset.galleryOpen || 0), open);
    }

    function onTouchStart(event) {
      if (event.touches && event.touches.length === 1) touchStart = event.touches[0].clientX;
    }

    function onTouchEnd(event) {
      if (touchStart == null || !event.changedTouches || !event.changedTouches[0]) return;
      var distance = event.changedTouches[0].clientX - touchStart;
      touchStart = null;
      if (Math.abs(distance) > 48) move(distance > 0 ? -1 : 1);
    }

    function onKey(event) {
      if (!lightbox) return;
      if (event.key === "Escape") { event.preventDefault(); closeLightbox(); return; }
      if (event.key === "ArrowLeft") { event.preventDefault(); showLightbox(currentIndex - 1); return; }
      if (event.key === "ArrowRight") { event.preventDefault(); showLightbox(currentIndex + 1); return; }
      if (event.key === "Tab") trapFocus(event, lightbox);
    }

    function openLightbox(index, trigger) {
      if (lightbox) closeLightbox();
      previousFocus = trigger || document.activeElement;
      lightbox = document.createElement("section");
      lightbox.className = "gallery-lightbox";
      lightbox.setAttribute("role", "dialog");
      lightbox.setAttribute("aria-modal", "true");
      lightbox.setAttribute("aria-label", "查看回忆照片");
      document.body.appendChild(lightbox);
      document.body.classList.add("gallery-lightbox-open");
      lightbox.addEventListener("click", function (event) {
        if (event.target === lightbox || event.target.closest("[data-gallery-close]")) closeLightbox();
        if (event.target.closest("[data-lightbox-prev]")) showLightbox(currentIndex - 1);
        if (event.target.closest("[data-lightbox-next]")) showLightbox(currentIndex + 1);
      });
      lightbox.addEventListener("touchstart", onLightboxTouchStart, { passive: true });
      lightbox.addEventListener("touchmove", onLightboxTouchMove, { passive: false });
      lightbox.addEventListener("touchend", onLightboxTouchEnd, { passive: true });
      showLightbox(index);
      document.addEventListener("keydown", onKey);
      var close = lightbox.querySelector("[data-gallery-close]");
      if (close) close.focus();
    }

    var pinch = null;
    var zoom = 1;
    function distance(touches) {
      var dx = touches[0].clientX - touches[1].clientX;
      var dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function onLightboxTouchStart(event) {
      if (event.touches.length === 2) pinch = distance(event.touches);
    }
    function onLightboxTouchMove(event) {
      if (!pinch || event.touches.length !== 2) return;
      var next = Math.max(1, Math.min(3, zoom * distance(event.touches) / pinch));
      var image = lightbox && lightbox.querySelector(".gallery-lightbox-image");
      if (image) image.style.transform = "scale(" + next.toFixed(2) + ")";
      event.preventDefault();
    }
    function onLightboxTouchEnd(event) {
      if (pinch && event.touches.length < 2) {
        var image = lightbox && lightbox.querySelector(".gallery-lightbox-image");
        var transform = image && image.style.transform;
        var match = transform && transform.match(/scale\(([^)]+)\)/);
        zoom = match ? Number(match[1]) || 1 : 1;
        pinch = null;
      }
    }

    function showLightbox(index) {
      if (!lightbox) return;
      currentIndex = (index + cards.length) % cards.length;
      var source = cards[currentIndex];
      var image = source.querySelector("img");
      var caption = source.dataset.caption || "回忆照片";
      zoom = 1;
      lightbox.innerHTML =
        '<button class="gallery-lightbox-close" type="button" data-gallery-close aria-label="关闭照片">关闭</button>' +
        '<button class="gallery-lightbox-arrow gallery-lightbox-prev" type="button" data-lightbox-prev aria-label="上一张">上一张</button>' +
        '<figure class="gallery-lightbox-frame"><img class="gallery-lightbox-image" src="' + escapeHtml(image.currentSrc || image.src) + '" alt="' + escapeHtml(image.alt || caption) + '"><figcaption>' + escapeHtml(caption) + '<span>' + (currentIndex + 1) + " / " + cards.length + '</span></figcaption></figure>' +
        '<button class="gallery-lightbox-arrow gallery-lightbox-next" type="button" data-lightbox-next aria-label="下一张">下一张</button>';
      setProgress(currentIndex);
      var active = document.activeElement;
      var selector = active && lightbox.contains(active) && active.matches("[data-lightbox-prev], [data-lightbox-next], [data-gallery-close]")
        ? (active.hasAttribute("data-lightbox-prev") ? "[data-lightbox-prev]" : active.hasAttribute("data-lightbox-next") ? "[data-lightbox-next]" : "[data-gallery-close]")
        : "[data-gallery-close]";
      var focusTarget = lightbox.querySelector(selector) || lightbox.querySelector("[data-gallery-close]");
      if (focusTarget) focusTarget.focus();
    }

    function closeLightbox() {
      if (!lightbox) return;
      lightbox.remove();
      lightbox = null;
      document.body.classList.remove("gallery-lightbox-open");
      document.removeEventListener("keydown", onKey);
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      previousFocus = null;
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("click", onClick);
    setProgress(0);

    return function cleanup() {
      if (destroyed) return;
      destroyed = true;
      window.clearTimeout(scrollTimer);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("click", onClick);
      closeLightbox();
    };
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

  window.BirthdayGallery = { mount: mount };
})();