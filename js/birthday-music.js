(() => {
  "use strict";
  const init = () => {
    const module = document.querySelector("#module-bgm");
    if (!module || document.querySelector("#birthdayBgm")) return;
    const audio = document.createElement("audio");
    audio.id = "birthdayBgm";
    audio.src = "assets/music/i-love-you-so.mp3";
    audio.loop = true;
    audio.preload = "metadata";
    audio.autoplay = true;
    audio.play().catch(() => {
      document.addEventListener("pointerdown", () => audio.play().catch(() => {}), { once: true });
    });
    document.body.appendChild(audio);
  };
  const watch = setInterval(() => {
    init();
    if (document.querySelector("#birthdayBgm") || document.querySelector(".birthday-error")) clearInterval(watch);
  }, 250);
})();