(function () {
  "use strict";

  var scenes = Array.isArray(window.BD_BLINDBOX_SCENES) ? window.BD_BLINDBOX_SCENES : [];
  var legacyMap = {
    kitten: "kitten_companion",
    fireworks: "firework_night",
    flowers: "flower_bouquet",
    stars: "starlight_wish",
    butterflies: "flower_bouquet",
    balloons: "party_balloons",
    ocean: "seaside_summer",
    petals: "flower_bouquet"
  };

  window.BD_IMAGERY_COMPAT = legacyMap;
  window.BD_IMAGERY = scenes.map(function (scene) {
    return {
      id: scene.id,
      name: scene.name,
      short: scene.message,
      defaultDuration: scene.duration,
      renderer: "immersiveGiftBoxRenderer"
    };
  });
})();