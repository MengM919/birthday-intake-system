(() => {
  "use strict";
  const expand = () => {
    const grid = document.querySelector(".mosaic");
    if (!grid || grid.dataset.limited) return;
    const photos = [...grid.children];
    if (photos.length <= 8) return;
    grid.dataset.limited = "true";
    photos.slice(8).forEach((item) => item.hidden = true);
    const button = document.createElement("button");
    button.className = "gallery-more";
    button.type = "button";
    button.textContent = "???? " + (photos.length - 8) + " ???";
    button.addEventListener("click", () => {
      photos.slice(8).forEach((item) => item.hidden = false);
      button.remove();
    });
    grid.after(button);
  };
  const watch = setInterval(() => {
    expand();
    if (document.querySelector(".mosaic") || document.querySelector(".birthday-error")) clearInterval(watch);
  }, 250);
})();