(function () {
  "use strict";

  window.BD_BLINDBOX_SCENES = [
    { id: "kitten_companion", name: "\u5c0f\u732b\u966a\u4f34", title: "\u4f60\u503c\u5f97\u88ab\u6e29\u67d4\u62b1\u4f4f", message: "\u4eca\u5929\u6709\u51e0\u4f4d\u6bdb\u8338\u8338\u7684\u5c0f\u670b\u53cb\uff0c\u60f3\u60c5\u4e0d\u81ea\u7981\u5730\u6765\u966a\u4f60\u8fc7\u751f\u65e5\u3002", palette: "warm", pieces: ["cat", "yarn", "cloud"], duration: 6 },
    { id: "firework_night", name: "\u70df\u82b1\u591c\u7a7a", title: "\u4f60\u7684\u8fd9\u4e00\u5c81\u8981\u95ea\u95ea\u53d1\u5149", message: "\u8fd9\u4e00\u523b\uff0c\u628a\u4e00\u70b9\u6d69\u5927\u7684\u795d\u798f\uff0c\u90fd\u653e\u8fdb\u4f60\u7684\u591c\u7a7a\u3002", palette: "night", pieces: ["spark", "burst", "trail"], duration: 7 },
    { id: "flower_bouquet", name: "\u9c9c\u82b1\u82b1\u675f", title: "\u4eca\u5929\u7684\u82b1\u90fd\u66ff\u6211\u628a\u559c\u6b22\u9001\u7ed9\u4f60", message: "\u613f\u6bcf\u4e00\u6735\u817e\u8d77\u7684\u82b1\uff0c\u90fd\u662f\u4e00\u4efd\u6b63\u5728\u8d70\u5411\u4f60\u7684\u504f\u7231\u3002", palette: "floral", pieces: ["bloom", "leaf", "petal"], duration: 7 },
    { id: "dessert_garden", name: "\u751c\u54c1\u4e50\u56ed", title: "\u628a\u751c\u751c\u7684\u60ca\u559c\u90fd\u7559\u7ed9\u4eca\u5929\u7684\u4f60", message: "\u751f\u65e5\u5c31\u8be5\u6709\u4e00\u70b9\u8f6f\u4e4e\u4e4e\u7684\u5feb\u4e50\uff0c\u8fd8\u6709\u6570\u4e0d\u5c3d\u7684\u7cd6\u971c\u548c\u597d\u5fc3\u60c5\u3002", palette: "dessert", pieces: ["cherry", "cream", "sparkle"], duration: 6 },
    { id: "seaside_summer", name: "\u6d77\u8fb9\u590f\u65e5", title: "\u613f\u5feb\u4e50\u50cf\u6d77\u98ce\u4e00\u6837\u56f4\u7740\u4f60", message: "\u4eca\u5929\u7684\u5149\uff0c\u6d77\u6d6a\uff0c\u548c\u8f7b\u8f7b\u5439\u8fc7\u6765\u7684\u98ce\uff0c\u90fd\u60f3\u5bf9\u4f60\u8bf4\u751f\u65e5\u5feb\u4e50\u3002", palette: "ocean", pieces: ["wave", "shell", "sun"], duration: 7 },
    { id: "starlight_wish", name: "\u661f\u5149\u613f\u671b", title: "\u8fd9\u4e00\u9875\u4f1a\u66ff\u4f60\u628a\u613f\u671b\u8f7b\u8f7b\u6536\u597d", message: "\u4eca\u665a\u5c31\u5148\u628a\u661f\u5149\u501f\u7ed9\u4f60\uff0c\u613f\u4f60\u5bf9\u660e\u5929\u7684\u671f\u5f85\uff0c\u90fd\u80fd\u6162\u6162\u4eae\u8d77\u6765\u3002", palette: "starlight", pieces: ["star", "orbit", "trail"], duration: 7 },
    { id: "party_balloons", name: "\u6d3e\u5bf9\u6c14\u7403", title: "\u4eca\u5929\u6240\u6709\u70ed\u95f9\u90fd\u56f4\u7ed5\u4f60\u53d1\u751f", message: "\u6536\u4e0b\u8fd9\u4e00\u5c4b\u5b50\u7684\u6c14\u7403\u548c\u795d\u798f\uff0c\u4f60\u5c31\u8d1f\u8d23\u5f00\u5fc3\u5730\u8fc7\u597d\u4eca\u5929\u3002", palette: "party", pieces: ["balloon", "ribbon", "confetti"], duration: 6 },
    { id: "fairytale_gift_house", name: "\u7ae5\u8bdd\u793c\u7269\u5c4b", title: "\u62c6\u5f00\u7684\u4e0d\u53ea\u662f\u793c\u7269", message: "\u8fd8\u6709\u4e00\u4efd\u88ab\u8ba4\u771f\u51c6\u5907\u7684\u7231\uff0c\u6b63\u8f7b\u8f7b\u5730\u843d\u5728\u4f60\u8fd9\u4e00\u5929\u3002", palette: "storybook", pieces: ["gift", "window", "light"], duration: 7 }
  ];

  window.BD_BLINDBOX_SCENE_BY_ID = function (sceneId) {
    return window.BD_BLINDBOX_SCENES.find(function (scene) { return scene.id === sceneId; }) || null;
  };
})();