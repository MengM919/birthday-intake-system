(function () {
  "use strict";

  function mount(options) {
    var root = options && options.root;
    var enabled = Boolean(options && options.enabled);
    if (!root || !enabled) return { play: function () { return Promise.resolve(false); }, cleanup: function () {} };

    var audio = new Audio(options.trackUrl || "assets/music/i-love-you-so.mp3");
    audio.loop = true;
    audio.preload = "metadata";
    var userStarted = false;
    var pausedForHidden = false;
    var destroyed = false;

    function controls() { return Array.prototype.slice.call(root.querySelectorAll("[data-music-toggle]")); }
    function status() { return Array.prototype.slice.call(root.querySelectorAll("[data-music-status]")); }
    function sync(message) {
      var playing = !audio.paused && !audio.ended;
      controls().forEach(function (button) {
        button.setAttribute("aria-pressed", String(playing));
        button.textContent = playing ? "暂停这首歌" : "播放这首歌";
      });
      status().forEach(function (node) { node.textContent = message || (playing ? "正在陪你播放" : "准备好后，轻轻点一下就能听见。"); });
    }

    async function play() {
      if (destroyed) return false;
      try {
        await audio.play();
        userStarted = true;
        sync();
        return true;
      } catch (error) {
        sync("浏览器暂未允许播放，轻轻点一下“播放这首歌”试试。");
        return false;
      }
    }

    function pause() {
      audio.pause();
      sync();
    }

    function onClick(event) {
      if (!event.target.closest("[data-music-toggle]")) return;
      if (audio.paused) void play();
      else pause();
    }

    function onVisibility() {
      if (document.hidden && !audio.paused) {
        pausedForHidden = true;
        audio.pause();
        sync("页面先替你把旋律按下暂停。");
      } else if (!document.hidden && pausedForHidden && userStarted) {
        pausedForHidden = false;
        void play();
      }
    }

    root.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onVisibility);
    audio.addEventListener("play", function () { sync(); });
    audio.addEventListener("pause", function () { sync(); });
    audio.addEventListener("error", function () { sync("这首歌暂时没有连上，页面里的惊喜仍在继续。 "); });
    sync();

    return {
      play: play,
      pause: pause,
      cleanup: function () {
        if (destroyed) return;
        destroyed = true;
        root.removeEventListener("click", onClick);
        document.removeEventListener("visibilitychange", onVisibility);
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }

  window.BirthdayMusic = { mount: mount };
})();