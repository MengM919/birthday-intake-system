(function () {
  "use strict";

  var activeOverlay = null;
  var fallbackScenes = [
    { id: "kitten_companion", name: "\u5c0f\u732b\u966a\u4f34", title: "\u4f60\u503c\u5f97\u88ab\u6e29\u67d4\u62b1\u4f4f", message: "\u4eca\u5929\u6709\u51e0\u4f4d\u6bdb\u8338\u8338\u7684\u5c0f\u670b\u53cb\uff0c\u60f3\u60c5\u4e0d\u81ea\u7981\u5730\u6765\u966a\u4f60\u8fc7\u751f\u65e5\u3002", pieces: ["cat", "yarn", "cloud"], duration: 6 },
    { id: "firework_night", name: "\u70df\u82b1\u591c\u7a7a", title: "\u4f60\u7684\u8fd9\u4e00\u5c81\u8981\u95ea\u95ea\u53d1\u5149", message: "\u628a\u4e00\u70b9\u6d69\u5927\u7684\u795d\u798f\uff0c\u90fd\u653e\u8fdb\u4f60\u7684\u591c\u7a7a\u3002", pieces: ["spark", "burst", "trail"], duration: 7 },
    { id: "flower_bouquet", name: "\u9c9c\u82b1\u82b1\u675f", title: "\u4eca\u5929\u7684\u82b1\u90fd\u66ff\u6211\u628a\u559c\u6b22\u9001\u7ed9\u4f60", message: "\u613f\u6bcf\u4e00\u6735\u817e\u8d77\u7684\u82b1\uff0c\u90fd\u662f\u4e00\u4efd\u6b63\u5728\u8d70\u5411\u4f60\u7684\u504f\u7231\u3002", pieces: ["bloom", "leaf", "petal"], duration: 7 },
    { id: "dessert_garden", name: "\u751c\u54c1\u4e50\u56ed", title: "\u628a\u751c\u751c\u7684\u60ca\u559c\u90fd\u7559\u7ed9\u4eca\u5929\u7684\u4f60", message: "\u751f\u65e5\u5c31\u8be5\u6709\u4e00\u70b9\u8f6f\u4e4e\u4e4e\u7684\u5feb\u4e50\u3002", pieces: ["cherry", "cream", "sparkle"], duration: 6 },
    { id: "seaside_summer", name: "\u6d77\u8fb9\u590f\u65e5", title: "\u613f\u5feb\u4e50\u50cf\u6d77\u98ce\u4e00\u6837\u56f4\u7740\u4f60", message: "\u4eca\u5929\u7684\u5149\u3001\u6d77\u6d6a\u548c\u8f7b\u98ce\uff0c\u90fd\u60f3\u5bf9\u4f60\u8bf4\u751f\u65e5\u5feb\u4e50\u3002", pieces: ["wave", "shell", "sun"], duration: 7 },
    { id: "starlight_wish", name: "\u661f\u5149\u613f\u671b", title: "\u8fd9\u4e00\u9875\u4f1a\u66ff\u4f60\u628a\u613f\u671b\u8f7b\u8f7b\u6536\u597d", message: "\u4eca\u665a\u5c31\u5148\u628a\u661f\u5149\u501f\u7ed9\u4f60\u3002", pieces: ["star", "orbit", "trail"], duration: 7 },
    { id: "party_balloons", name: "\u6d3e\u5bf9\u6c14\u7403", title: "\u4eca\u5929\u6240\u6709\u70ed\u95f9\u90fd\u56f4\u7ed5\u4f60\u53d1\u751f", message: "\u6536\u4e0b\u8fd9\u4e00\u5c4b\u5b50\u7684\u6c14\u7403\u548c\u795d\u798f\u3002", pieces: ["balloon", "ribbon", "confetti"], duration: 6 },
    { id: "fairytale_gift_house", name: "\u7ae5\u8bdd\u793c\u7269\u5c4b", title: "\u62c6\u5f00\u7684\u4e0d\u53ea\u662f\u793c\u7269", message: "\u8fd8\u6709\u4e00\u4efd\u88ab\u8ba4\u771f\u51c6\u5907\u7684\u7231\u3002", pieces: ["gift", "window", "light"], duration: 7 }
  ];

  function openSurpriseExperience(config, themeContext) {
    if (activeOverlay && typeof activeOverlay.close === "function") activeOverlay.close();

    var scene = selectScene(config || {});
    var palette = buildPalette(themeContext || {}, scene);
    var reduced = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var overlay = document.createElement("section");
    var card;
    var canvasController = null;
    var revealTimer = 0;
    var autoTimer = 0;
    var remaining = Math.max(4000, Math.min(10000, Number(scene.duration || 6) * 1000));
    var lastStarted = 0;
var closed = false;
    var previousFocus = document.activeElement;
    var historyToken = "birthday-surprise-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    var historyPushed = false;

    overlay.className = "surprise-experience scene-" + scene.id;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "\u751f\u65e5\u60ca\u559c");
    applyPalette(overlay, palette);
    overlay.innerHTML =
      '<div class="surprise-backdrop"></div>' +
      '<canvas class="surprise-canvas" aria-hidden="true"></canvas>' +
      '<div class="surprise-layer" aria-hidden="true"></div>' +
      '<div class="surprise-gift-stage"><span class="gift-base"></span><span class="gift-lid"></span><span class="gift-ribbon"></span></div>' +
      '<button class="surprise-close" type="button">\u5173\u95ed\u60ca\u559c</button>' +
      '<div class="surprise-message-card"><span>' + escapeHtml(scene.name) + '</span><h2>' + escapeHtml(scene.title) + '</h2><p>' + escapeHtml(scene.message) + '</p></div>';

    document.body.appendChild(overlay);
    document.body.classList.add("surprise-open");
    card = overlay.querySelector(".surprise-message-card");
    card.style.opacity = "0";
    card.style.transform = "translateY(10px) scale(.97)";
    card.style.transition = "opacity 260ms ease, transform 260ms ease";

    var layer = overlay.querySelector(".surprise-layer");
    var stage = overlay.querySelector(".surprise-gift-stage");
    var closeButton = overlay.querySelector(".surprise-close");
    var canvas = overlay.querySelector(".surprise-canvas");

    function reveal() {
      if (closed) return;
      stage.classList.add("is-opening");
      buildSceneDecorations(layer, scene, palette, reduced);
      if (!reduced) canvasController = createCanvasScene(canvas, scene, palette);
      card.style.opacity = "1";
      card.style.transform = "translateY(0) scale(1)";
      startAutoClose();
    }

    function startAutoClose() {
      clearTimeout(autoTimer);
      lastStarted = Date.now();
      autoTimer = window.setTimeout(close, remaining);
    }

    function pauseForHidden() {
      if (closed) return;
      if (document.hidden) {
        if (lastStarted) remaining = Math.max(800, remaining - (Date.now() - lastStarted));
        clearTimeout(autoTimer);
        overlay.classList.add("is-paused");
        if (canvasController) canvasController.pause();
      } else {
        overlay.classList.remove("is-paused");
        if (canvasController) canvasController.resume();
        if (lastStarted) startAutoClose();
      }
    }

function onPopState() {
      close({ fromHistory: true });
    }

    function onKeydown(event) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      else if (event.key === "Tab") trapFocus(event, overlay);
    }

    function close(options) {
      if (closed) return;
      closed = true;
      clearTimeout(revealTimer);
      clearTimeout(autoTimer);
      document.removeEventListener("visibilitychange", pauseForHidden);
      document.removeEventListener("keydown", onKeydown);
      window.removeEventListener("popstate", onPopState);
      if (canvasController) canvasController.destroy();
overlay.classList.remove("is-visible");
      if (historyPushed && !(options && options.fromHistory)) {
        try {
          if (window.history.state && window.history.state.birthdaySurprise === historyToken) window.history.back();
        } catch (error) {}
      }
      window.setTimeout(function () {
        overlay.remove();
        if (activeOverlay && activeOverlay.element === overlay) activeOverlay = null;
        if (!document.querySelector(".surprise-experience")) document.body.classList.remove("surprise-open");
        if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      }, 230);
    }

    closeButton.addEventListener("click", close, { once: true });
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay.querySelector(".surprise-backdrop")) close();
    });
    document.addEventListener("visibilitychange", pauseForHidden);
    document.addEventListener("keydown", onKeydown);
    if (closeButton) closeButton.focus();

    window.requestAnimationFrame(function () { overlay.classList.add("is-visible"); });
    revealTimer = window.setTimeout(reveal, reduced ? 70 : 310);
    activeOverlay = { element: overlay, close: close };
    return activeOverlay;
  }

  function selectScene(config) {
    var scenes = Array.isArray(window.BD_BLINDBOX_SCENES) && window.BD_BLINDBOX_SCENES.length ? window.BD_BLINDBOX_SCENES : fallbackScenes;
    var ids = scenes.map(function (scene) { return scene.id; });
    var key = "birthday-blindbox-cycle:" + String(config.pageKey || window.location.pathname || "page");
    var stored = readCycle(key);
    var queue = (stored.queue || []).filter(function (id) { return ids.indexOf(id) !== -1; });
    var lastId = stored.lastId && ids.indexOf(stored.lastId) !== -1 ? stored.lastId : null;

    if (!queue.length) {
      queue = shuffle(ids.slice());
      if (queue.length > 1 && queue[0] === lastId) {
        var swapIndex = 1 + Math.floor(Math.random() * (queue.length - 1));
        var saved = queue[0];
        queue[0] = queue[swapIndex];
        queue[swapIndex] = saved;
      }
    }

    var selectedId = queue.shift();
    writeCycle(key, { queue: queue, lastId: selectedId });
    return scenes.find(function (scene) { return scene.id === selectedId; }) || scenes[0];
  }

  function readCycle(key) {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeCycle(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (error) { if (isDevelopment()) console.warn("Blindbox cycle was not persisted.", error && error.message || "unknown"); }
  }

  function shuffle(values) {
    for (var index = values.length - 1; index > 0; index -= 1) {
      var swap = Math.floor(Math.random() * (index + 1));
      var value = values[index];
      values[index] = values[swap];
      values[swap] = value;
    }
    return values;
  }

  function buildPalette(context, scene) {
    var primary = context.primaryColor || "#ef6f95";
    var accent = context.accentColor || "#2f8be8";
    var background = context.backgroundColor || "#fffdf7";
    var highlight = context.highlightColor || "#f7c948";
    var dark = scene.id === "firework_night" || scene.id === "starlight_wish" || context.templateId === "T06";
    var palette = { primary: primary, accent: accent, background: background, highlight: highlight, ink: context.inkColor || "#27221f", soft: "rgba(255,255,255,.82)" };

    if (scene.id === "firework_night") return { primary: "#f39ab8", accent: "#f4ce72", background: "#0a0915", highlight: "#fff0a3", ink: "#fff8fb", soft: "rgba(35,22,43,.84)" };
    if (scene.id === "starlight_wish") return { primary: "#e9c87a", accent: "#a899ed", background: "#0a0b1a", highlight: "#fff9c7", ink: "#fff8fb", soft: "rgba(25,28,58,.84)" };
    if (scene.id === "seaside_summer") return { primary: "#4d98bc", accent: "#9bd3dd", background: "#e9f8ff", highlight: "#f2d27d", ink: "#274260", soft: "rgba(249,254,255,.86)" };
    if (scene.id === "flower_bouquet" && context.templateId === "T06") return { primary: "#a03e56", accent: "#e9a4ba", background: "#191116", highlight: "#f1d4dc", ink: "#fff6f8", soft: "rgba(36,20,29,.86)" };
    if (scene.id === "flower_bouquet" && context.templateId === "T07") return { primary: "#e47d55", accent: "#f3c55e", background: "#fff0d7", highlight: "#fff1b8", ink: "#3b3129", soft: "rgba(255,249,235,.86)" };
    if (scene.id === "flower_bouquet" && context.templateId === "T09") return { primary: "#4d91bd", accent: "#9ed6b2", background: "#effaff", highlight: "#fffef5", ink: "#244263", soft: "rgba(248,253,255,.86)" };
    if (scene.id === "dessert_garden") return { primary: "#e86d96", accent: "#c69bdb", background: "#fff0f4", highlight: "#ffd56e", ink: "#4a2f3a", soft: "rgba(255,250,252,.88)" };
    if (scene.id === "party_balloons") return { primary: primary, accent: accent, background: background, highlight: highlight, ink: palette.ink, soft: "rgba(255,255,255,.84)" };
    if (dark) { palette.background = "#171116"; palette.ink = "#fff6f8"; palette.soft = "rgba(36,22,30,.86)"; }
    return palette;
  }

  function applyPalette(element, palette) {
    element.style.setProperty("--surprise-primary", palette.primary);
    element.style.setProperty("--surprise-accent", palette.accent);
    element.style.setProperty("--surprise-bg", palette.background);
    element.style.setProperty("--surprise-highlight", palette.highlight);
    element.style.setProperty("--surprise-ink", palette.ink);
    element.style.setProperty("--surprise-soft", palette.soft);
  }

  function buildSceneDecorations(layer, scene, palette, reduced) {
    var map = { spark: "star", burst: "star", sparkle: "star", orbit: "star", ribbon: "trail" };
    var count = countsFor(scene.id, reduced);
    var pieces = Array.isArray(scene.pieces) && scene.pieces.length ? scene.pieces : ["star"];
    var index;

    if (scene.id === "seaside_summer") {
      var wave = document.createElement("div");
      wave.className = "surprise-ocean-wave";
      layer.appendChild(wave);
    }
    if (scene.id === "firework_night") {
      for (index = 0; index < 3; index += 1) {
        var burst = document.createElement("span");
        burst.className = "surprise-firework";
        burst.style.left = (18 + index * 31) + "%";
        burst.style.top = (16 + (index % 2) * 23) + "%";
        burst.style.animationDelay = (index * .28) + "s";
        layer.appendChild(burst);
      }
    }

    for (index = 0; index < count; index += 1) {
      var raw = pieces[index % pieces.length];
      var type = map[raw] || raw;
      var node = document.createElement("span");
      node.className = "surprise-piece piece-" + type;
      node.style.setProperty("--x", (4 + Math.round(Math.random() * 91)) + "vw");
      node.style.setProperty("--y", (6 + Math.round(Math.random() * 82)) + "vh");
      node.style.setProperty("--delay", (Math.random() * 1.5).toFixed(2) + "s");
      node.style.setProperty("--speed", (4.8 + Math.random() * 4).toFixed(2) + "s");
      node.style.setProperty("--size", (18 + Math.round(Math.random() * 34)) + "px");
      node.style.setProperty("--piece-primary", palette.primary);
      node.style.setProperty("--piece-accent", palette.accent);
      node.style.setProperty("--piece-highlight", palette.highlight);
      layer.appendChild(node);
    }
  }

  function countsFor(id, reduced) {
    var count = {
      kitten_companion: 10,
      firework_night: 13,
      flower_bouquet: 20,
      dessert_garden: 14,
      seaside_summer: 15,
      starlight_wish: 22,
      party_balloons: 13,
      fairytale_gift_house: 12
    }[id] || 12;
    return reduced ? Math.max(4, Math.ceil(count / 3)) : count;
  }

  function createCanvasScene(canvas, scene, palette) {
    var context = canvas.getContext("2d");
    if (!context) return { pause: function () {}, resume: function () {}, destroy: function () {} };

    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var running = false;
    var raf = 0;
    var particles = Array.from({ length: scene.id === "firework_night" ? 34 : 20 }, function () {
      return resetParticle({}, true);
    });

    function resize() {
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function resetParticle(particle, initial) {
      particle.x = Math.random() * window.innerWidth;
      particle.y = initial ? Math.random() * window.innerHeight : window.innerHeight + 10;
      particle.vx = (Math.random() - .5) * (scene.id === "firework_night" ? 1.4 : .42);
      particle.vy = scene.id === "firework_night" ? (Math.random() - .7) * 1.2 : -.15 - Math.random() * .32;
      particle.radius = .8 + Math.random() * 2.2;
      particle.life = Math.random();
      particle.color = Math.random() > .5 ? palette.primary : palette.highlight;
      return particle;
    }

    function tick() {
      if (!running) return;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach(function (particle) {
        particle.life += .012;
        if (particle.life > 1 || particle.y < -30) resetParticle(particle, false);
        particle.x += particle.vx;
        particle.y += particle.vy;
        var alpha = Math.max(.05, Math.sin(particle.life * Math.PI) * .72);
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius + alpha * 1.4, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
      raf = window.requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    running = true;
    tick();

    return {
      pause: function () { running = false; window.cancelAnimationFrame(raf); },
      resume: function () { if (!running) { running = true; tick(); } },
      destroy: function () { running = false; window.cancelAnimationFrame(raf); window.removeEventListener("resize", resize); context.clearRect(0, 0, canvas.width, canvas.height); }
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
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.openSurpriseExperience = openSurpriseExperience;
  window.closeActiveSurpriseExperience = function () {
    if (activeOverlay && typeof activeOverlay.close === "function") activeOverlay.close();
  };
  function isDevelopment() { return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname); }

})();
