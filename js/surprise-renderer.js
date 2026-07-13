(function () {
  "use strict";

  const active = new Set();

  function openSurpriseExperience(config = {}, themeContext = {}) {
    const imageryCode = config.imageryCode || "kitten";
    const duration = clamp(Number(config.durationSeconds || 6), 4, 10);
    const palette = buildPalette(themeContext, imageryCode);
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const overlay = document.createElement("section");
    overlay.className = `surprise-experience surprise-${imageryCode}`;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.setProperty("--surprise-primary", palette.primary);
    overlay.style.setProperty("--surprise-accent", palette.accent);
    overlay.style.setProperty("--surprise-bg", palette.background);
    overlay.style.setProperty("--surprise-soft", palette.soft);

    overlay.innerHTML = `
      <div class="surprise-backdrop"></div>
      <canvas class="surprise-canvas" width="780" height="1200" aria-hidden="true"></canvas>
      <div class="surprise-layer" aria-hidden="true"></div>
      <button class="surprise-close" type="button" aria-label="关闭惊喜">关闭惊喜</button>
      <div class="surprise-message-card">
        <span>${escapeHTML(getImageryName(imageryCode))}</span>
        <h2>${escapeHTML(config.surpriseTitle || "给你藏了一份小惊喜")}</h2>
        <p>${escapeHTML(config.surpriseMessage || "今天所有美好的意象，都想向你靠近一点。")}</p>
        ${config.signature ? `<small>${escapeHTML(config.signature)}</small>` : ""}
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add("surprise-open");
    active.add(overlay);

    const canvas = overlay.querySelector("canvas");
    const layer = overlay.querySelector(".surprise-layer");
    const cleanupCallbacks = [];
    let rafId = 0;
    let closed = false;

    requestAnimationFrame(() => overlay.classList.add("is-visible"));

    if (config.soundEnabled) playSoftChime();
    buildDecorations(layer, imageryCode, palette, reducedMotion);
    if (!reducedMotion) {
      rafId = startCanvas(canvas, imageryCode, palette);
    }

    const pauseOnHidden = () => overlay.classList.toggle("is-paused", document.hidden);
    document.addEventListener("visibilitychange", pauseOnHidden);
    cleanupCallbacks.push(() => document.removeEventListener("visibilitychange", pauseOnHidden));

    const close = () => {
      if (closed) return;
      closed = true;
      overlay.classList.remove("is-visible");
      window.cancelAnimationFrame(rafId);
      cleanupCallbacks.forEach((callback) => callback());
      window.setTimeout(() => {
        overlay.remove();
        active.delete(overlay);
        if (!active.size) document.body.classList.remove("surprise-open");
      }, 260);
    };

    overlay.querySelector(".surprise-close").addEventListener("click", close, { once: true });
    cleanupCallbacks.push(() => overlay.querySelector(".surprise-close").removeEventListener("click", close));
    window.setTimeout(close, reducedMotion ? Math.min(duration, 4) * 1000 : duration * 1000);
    return { close };
  }

  function buildPalette(themeContext, imageryCode) {
    const primary = themeContext.primaryColor || "#e56f78";
    const accent = themeContext.accentColor || "#76b7a6";
    const background = themeContext.backgroundColor || "#fff8f0";
    const darkTemplates = ["T04", "T06"];
    const isDark = darkTemplates.includes(themeContext.templateId) || isDarkColor(background);
    const flowerMap = {
      T06: { primary: "#9f314c", accent: "#f0aac1", soft: "rgba(255, 207, 221, 0.18)", background: "#110b10" },
      T09: { primary: "#2f72c4", accent: "#9ed8e8", soft: "rgba(219, 247, 255, 0.7)", background: "#eef8ff" },
      T07: { primary: "#e57c55", accent: "#f5c45f", soft: "rgba(255, 232, 183, 0.72)", background: "#fff2dc" },
      T08: { primary: "#d87991", accent: "#f0b7c7", soft: "rgba(255, 228, 237, 0.78)", background: "#ffe4ec" }
    };
    if (imageryCode === "flowers" && flowerMap[themeContext.templateId]) return flowerMap[themeContext.templateId];
    return {
      primary,
      accent,
      background: isDark ? "#0e0b10" : background,
      soft: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.72)"
    };
  }

  function buildDecorations(layer, code, palette, reducedMotion) {
    const countMap = {
      kitten: 7,
      fireworks: 16,
      flowers: 22,
      stars: 34,
      butterflies: 9,
      balloons: 11,
      ocean: 18,
      petals: 30
    };
    const count = reducedMotion ? Math.ceil((countMap[code] || 12) / 3) : countMap[code] || 12;
    if (code === "ocean") addOcean(layer);
    for (let index = 0; index < count; index += 1) {
      const node = document.createElement("span");
      node.className = `surprise-piece piece-${code}`;
      node.style.setProperty("--x", `${Math.round(4 + Math.random() * 92)}vw`);
      node.style.setProperty("--y", `${Math.round(5 + Math.random() * 88)}vh`);
      node.style.setProperty("--delay", `${(Math.random() * 1.8).toFixed(2)}s`);
      node.style.setProperty("--speed", `${(5 + Math.random() * 5).toFixed(2)}s`);
      node.style.setProperty("--size", `${Math.round(22 + Math.random() * 48)}px`);
      node.style.setProperty("--piece-primary", palette.primary);
      node.style.setProperty("--piece-accent", palette.accent);
      if (code === "kitten") node.innerHTML = "<i></i><b></b>";
      if (code === "butterflies") node.innerHTML = "<i></i><b></b>";
      if (code === "balloons") node.innerHTML = "<i></i>";
      if (code === "flowers") node.innerHTML = "<i></i><b></b>";
      layer.appendChild(node);
    }
  }

  function addOcean(layer) {
    const wave = document.createElement("div");
    wave.className = "surprise-ocean-wave";
    layer.appendChild(wave);
  }

  function startCanvas(canvas, code, palette) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const particles = Array.from({ length: code === "fireworks" ? 42 : 26 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * 0.72,
      vx: (Math.random() - 0.5) * 0.42,
      vy: (Math.random() - 0.35) * 0.36,
      r: 1 + Math.random() * 2.8,
      life: Math.random(),
      color: Math.random() > 0.5 ? palette.primary : palette.accent
    }));

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach((p) => {
        p.life += 0.012;
        if (p.life > 1) {
          p.life = 0;
          p.x = Math.random() * window.innerWidth;
          p.y = Math.random() * window.innerHeight * 0.7;
        }
        p.x += p.vx;
        p.y += p.vy;
        const alpha = Math.sin(p.life * Math.PI);
        ctx.globalAlpha = Math.max(0.08, alpha * 0.76);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + alpha * 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    canvas._surpriseCleanup = () => window.removeEventListener("resize", resize);
    return raf;
  }

  function playSoftChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      gain.connect(ctx.destination);
      [523.25, 659.25, 783.99].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(ctx.currentTime + index * 0.08);
        osc.stop(ctx.currentTime + 0.55 + index * 0.08);
      });
      window.setTimeout(() => ctx.close(), 1100);
    } catch (error) {
      console.warn("Surprise sound skipped:", error);
    }
  }

  function getImageryName(code) {
    const map = {
      kitten: "小猫",
      fireworks: "烟花",
      flowers: "鲜花",
      stars: "星星",
      butterflies: "蝴蝶",
      balloons: "生日气球",
      ocean: "海浪",
      petals: "花瓣雨"
    };
    return map[code] || "惊喜盲盒";
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  function isDarkColor(color) {
    const hex = String(color || "").replace("#", "");
    if (hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 96;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split("\"").join("&quot;")
      .split("'").join("&#039;");
  }

  window.openSurpriseExperience = openSurpriseExperience;
})();
