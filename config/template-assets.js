(function () {
  "use strict";

  var commonModules = ["gallery", "messageWall", "countdown", "wishBottle", "futureMailbox", "dailyLuck", "surpriseBox", "bgm"];
  var assets = [
    {
      templateId: "line_bloom_white", legacyId: "T01", code: "T01", name: "\u6674\u65e5\u624b\u7ed8", category: "line_art", version: "1.0.0", status: "active",
      description: "\u767d\u5e95\u660e\u4eae\u7ebf\u6761\uff0c\u50cf\u4e00\u5f20\u4e3a TA \u8ba4\u771f\u753b\u597d\u7684\u751f\u65e5\u8d3a\u5361\u3002", suitableFor: "\u95fa\u871c\u3001\u540c\u5b66\u3001\u6e29\u67d4\u6e05\u65b0\u7684\u795d\u798f\u3002",
      palette: { primary: "#ef6f95", accent: "#2f8be8", background: "#fffdf7", ink: "#27221f", soft: "#fff5eb", highlight: "#f7c948" },
      typography: { display: "handwritten", body: "clean", accent: "script" }, coverStyle: "freeform_frame", iconStyle: "line_sticker", layoutRule: "airy_split", buttonStyle: "sketch_pill", moduleCardStyle: "outlined_paper", decorElements: ["sparkle", "bloom", "ribbon"], supportedModules: commonModules, copyTone: "bright_warm", previewCoverImage: "assets/templates/T01/preview.png", previewThumbImage: "assets/templates/T01/preview.webp", isPremiumTemplate: false
    },
    {
      templateId: "collage_pop_redblue", legacyId: "T02", code: "T02", name: "Cherry Pop", category: "collage", version: "1.0.0", status: "active",
      description: "\u7ea2\u84dd\u9ec4\u6495\u7eb8\u62fc\u8d34\uff0c\u70ed\u95f9\u4f46\u4e0d\u5931\u7cbe\u81f4\u7684\u751f\u65e5\u6d77\u62a5\u3002", suitableFor: "\u597d\u670b\u53cb\u3001\u5b66\u751f\u3001\u559c\u6b22\u8d85\u6709\u6c14\u6c1b\u611f\u7684 TA\u3002",
      palette: { primary: "#d94f3e", accent: "#1f6fb2", background: "#fff0d8", ink: "#302019", soft: "#fff8ea", highlight: "#f5bb3c" },
      typography: { display: "poster", body: "clean", accent: "marker" }, coverStyle: "taped_polaroid", iconStyle: "paper_cut", layoutRule: "collage_left", buttonStyle: "ticket", moduleCardStyle: "torn_paper", decorElements: ["tape", "cherry", "paper_edge"], supportedModules: commonModules, copyTone: "playful_loud", previewCoverImage: "assets/templates/T02/preview.png", previewThumbImage: "assets/templates/T02/preview.webp", isPremiumTemplate: false
    },
    {
      templateId: "collage_love_pastel", legacyId: "T03", code: "T03", name: "Love Letter", category: "collage", version: "1.0.0", status: "active",
      description: "\u84dd\u7c89\u6a58\u624b\u5de5\u62fc\u8d34\uff0c\u50cf\u4e00\u5c01\u88c5\u6ee1\u5fc3\u610f\u7684\u751f\u65e5\u4fe1\u3002", suitableFor: "\u95fa\u871c\u3001\u604b\u4eba\u3001\u60f3\u9001\u4e00\u4efd\u6709\u7eaa\u5ff5\u611f\u7684\u4eba\u3002",
      palette: { primary: "#e4685a", accent: "#287cc1", background: "#fff4df", ink: "#372620", soft: "#fffaf0", highlight: "#f7c96d" },
      typography: { display: "marker", body: "clean", accent: "script" }, coverStyle: "letter_frame", iconStyle: "postcard", layoutRule: "collage_right", buttonStyle: "tape_label", moduleCardStyle: "postcard", decorElements: ["envelope", "heart", "tape"], supportedModules: commonModules, copyTone: "letter_like", previewCoverImage: "assets/templates/T03/preview.png", previewThumbImage: "assets/templates/T03/preview.webp", isPremiumTemplate: false
    },
    {
      templateId: "cute_party_blue", legacyId: "T04", code: "T04", name: "Blue Birthday Club", category: "cute_party", version: "1.0.0", status: "active",
      description: "\u6df1\u84dd\u6d3e\u5bf9\u591c\u8272\uff0c\u53ef\u7231\u63d2\u753b\u4e0e\u9ad8\u5bf9\u6bd4\u751f\u65e5\u60ca\u559c\u3002", suitableFor: "\u559c\u6b22\u751f\u65e5\u4eea\u5f0f\u611f\u3001\u53ef\u7231\u4f46\u6709\u6001\u5ea6\u7684 TA\u3002",
      palette: { primary: "#ff7bad", accent: "#f6c84d", background: "#103d8e", ink: "#fffdf2", soft: "#173f86", highlight: "#77d6ff" },
      typography: { display: "chunky", body: "clean", accent: "marker" }, coverStyle: "cloud_frame", iconStyle: "party_doodle", layoutRule: "party_center", buttonStyle: "bubble", moduleCardStyle: "dark_ticket", decorElements: ["confetti", "cake", "streamer"], supportedModules: commonModules, copyTone: "cheery_party", previewCoverImage: "assets/templates/T04/preview.png", previewThumbImage: "assets/templates/T04/preview.webp", isPremiumTemplate: true
    },
    {
      templateId: "soft_portrait_pink", legacyId: "T05", code: "T05", name: "Today\u2019s Star", category: "portrait_party", version: "1.0.0", status: "active",
      description: "\u67d4\u7c89\u771f\u5b9e\u4eba\u50cf\u6d3e\u5bf9\uff0c\u8ba9 TA \u6210\u4e3a\u8fd9\u4e00\u5929\u6700\u95ea\u8000\u7684\u4e3b\u89d2\u3002", suitableFor: "\u604b\u4eba\u3001\u95fa\u871c\u3001\u60f3\u7a81\u51fa\u5c01\u9762\u4eba\u50cf\u7684\u751f\u65e5\u793c\u7269\u3002",
      palette: { primary: "#f26394", accent: "#9a77e9", background: "#fff6f8", ink: "#3e2931", soft: "#fff0f4", highlight: "#f5c46b" },
      typography: { display: "soft_serif", body: "clean", accent: "script" }, coverStyle: "portrait_arc", iconStyle: "soft_3d", layoutRule: "portrait_center", buttonStyle: "glossy_pill", moduleCardStyle: "soft_card", decorElements: ["balloon", "ribbon", "sparkle"], supportedModules: commonModules, copyTone: "adoring_soft", previewCoverImage: "assets/templates/T05/preview.png", previewThumbImage: "assets/templates/T05/preview.webp", isPremiumTemplate: true
    },
    {
      templateId: "pink_dark_gothic", legacyId: "T06", code: "T06", name: "Pink Midnight", category: "dark_romantic", version: "1.0.0", status: "active",
      description: "\u9ed1\u7c89\u591c\u8272\u6c34\u7c89\uff0c\u6d6a\u6f2b\u91cc\u5e26\u4e00\u70b9\u751c\u9177\u7684\u504f\u7231\u3002", suitableFor: "\u604b\u4eba\u3001\u7279\u522b\u597d\u670b\u53cb\u3001\u559c\u6b22\u6697\u8272\u6c1b\u56f4\u7684 TA\u3002",
      palette: { primary: "#ee7ca2", accent: "#e8bac9", background: "#171115", ink: "#fff6f8", soft: "#24161e", highlight: "#bb446d" },
      typography: { display: "editorial", body: "clean", accent: "script" }, coverStyle: "brush_oval", iconStyle: "moonlight", layoutRule: "dramatic_split", buttonStyle: "brush_stroke", moduleCardStyle: "ink_card", decorElements: ["moon", "rose", "starlight"], supportedModules: commonModules, copyTone: "midnight_romance", previewCoverImage: "assets/templates/T06/preview.png", previewThumbImage: "assets/templates/T06/preview.webp", isPremiumTemplate: true
    },
    {
      templateId: "california_summer", legacyId: "T07", code: "T07", name: "California Daydream", category: "summer_travel", version: "1.0.0", status: "active",
      description: "\u590d\u53e4\u516c\u8def\u6d77\u62a5\u548c\u6d77\u6ee9\u9633\u5149\uff0c\u6765\u4e00\u6b21\u7ed9 TA \u7684\u5047\u65e5\u751f\u65e5\u3002", suitableFor: "\u559c\u6b22\u65c5\u884c\u3001\u590f\u5929\u3001\u677e\u5f1b\u611f\u7684\u53cb\u53cb\u4eec\u3002",
      palette: { primary: "#e67e59", accent: "#4f928d", background: "#fff1d9", ink: "#3b3129", soft: "#fff7e9", highlight: "#f3bf58" },
      typography: { display: "travel", body: "clean", accent: "script" }, coverStyle: "postcard", iconStyle: "travel_stamp", layoutRule: "travel_story", buttonStyle: "sunset_pill", moduleCardStyle: "postcard", decorElements: ["sun", "orange", "palm"], supportedModules: commonModules, copyTone: "sunny_free", previewCoverImage: "assets/templates/T07/preview.png", previewThumbImage: "assets/templates/T07/preview.webp", isPremiumTemplate: false
    },
    {
      templateId: "scrapbook_pink_lace", legacyId: "T08", code: "T08", name: "Dear You", category: "scrapbook", version: "1.0.0", status: "active",
      description: "\u7c89\u8272\u624b\u8d26\u3001\u857e\u4e1d\u4e0e\u4e1d\u5e26\uff0c\u628a\u4f60\u4eec\u7684\u5fc3\u610f\u597d\u597d\u5e16\u8d77\u6765\u3002", suitableFor: "\u95fa\u871c\u3001\u604b\u4eba\u3001\u504f\u7231\u6d6a\u6f2b\u7eaa\u5ff5\u611f\u7684 TA\u3002",
      palette: { primary: "#da7f9e", accent: "#a88dca", background: "#fff0f3", ink: "#4c353c", soft: "#fff7f8", highlight: "#edb9c7" },
      typography: { display: "handwritten_serif", body: "clean", accent: "script" }, coverStyle: "lace_frame", iconStyle: "lace_sticker", layoutRule: "scrapbook_stack", buttonStyle: "ribbon", moduleCardStyle: "stitched_paper", decorElements: ["bow", "rose", "lace"], supportedModules: commonModules, copyTone: "tender_romance", previewCoverImage: "assets/templates/T08/preview.png", previewThumbImage: "assets/templates/T08/preview.webp", isPremiumTemplate: true
    },
    {
      templateId: "aegean_summer_blue", legacyId: "T09", code: "T09", name: "Summer Blue", category: "seaside", version: "1.0.0", status: "active",
      description: "\u84dd\u767d\u6d77\u6ee8\u6c34\u5f69\uff0c\u6e05\u723d\u3001\u660e\u4eae\uff0c\u50cf\u4e00\u9635\u6d77\u98ce\u6b63\u597d\u5439\u6765\u3002", suitableFor: "\u590f\u65e5\u751f\u65e5\u3001\u559c\u6b22\u6d77\u4e0e\u4eae\u8272\u7684 TA\u3002",
      palette: { primary: "#2f78bd", accent: "#79bada", background: "#eff9ff", ink: "#244263", soft: "#f8fdff", highlight: "#e5c56c" },
      typography: { display: "watercolor", body: "clean", accent: "script" }, coverStyle: "wave_oval", iconStyle: "watercolor", layoutRule: "breezy_split", buttonStyle: "sea_pill", moduleCardStyle: "sea_glass", decorElements: ["wave", "shell", "flower"], supportedModules: commonModules, copyTone: "fresh_healing", previewCoverImage: "assets/templates/T09/preview.png", previewThumbImage: "assets/templates/T09/preview.webp", isPremiumTemplate: false
    },
    {
      templateId: "gift_cloud_cute3d", legacyId: "T10", code: "T10", name: "Birthday Rush", category: "cute_3d", version: "1.0.0", status: "active",
      description: "\u793c\u7269\u3001\u6c14\u7403\u548c\u67d4\u8f6f\u4e91\u6735\uff0c\u662f\u4e00\u79cd\u88ab\u8ba4\u771f\u51c6\u5907\u7684\u751f\u65e5\u60ca\u559c\u3002", suitableFor: "\u559c\u6b22\u53ef\u7231\u3001\u660e\u4eae\u3001\u6ee1\u6ee1\u4eea\u5f0f\u611f\u7684 TA\u3002",
      palette: { primary: "#f64f90", accent: "#7950f3", background: "#fff4fa", ink: "#39283d", soft: "#fff9fc", highlight: "#ffc845" },
      typography: { display: "bubble", body: "clean", accent: "marker" }, coverStyle: "soft_window", iconStyle: "soft_3d", layoutRule: "gift_center", buttonStyle: "glossy_pill", moduleCardStyle: "soft_card", decorElements: ["gift", "cloud", "confetti"], supportedModules: commonModules, copyTone: "sweet_surprise", previewCoverImage: "assets/templates/T10/preview.png", previewThumbImage: "assets/templates/T10/preview.webp", isPremiumTemplate: true
    },
    {
      templateId: "graffiti_birthday", legacyId: "T11", code: "T11", name: "Love Graffiti", category: "graffiti", version: "1.0.0", status: "active",
      description: "\u624b\u5199\u5b57\u3001\u6d82\u9e26\u3001\u9c9c\u4eae\u8272\u5757\uff0c\u5c06\u795d\u798f\u5199\u6210\u4e00\u5f20\u6709\u6001\u5ea6\u7684\u6d77\u62a5\u3002", suitableFor: "\u540c\u5b66\u3001\u597d\u53cb\u3001\u559c\u6b22\u6f6e\u6d41\u548c\u4e2a\u6027\u611f\u7684 TA\u3002",
      palette: { primary: "#ef3886", accent: "#236ce0", background: "#fff9eb", ink: "#251f20", soft: "#fffdf4", highlight: "#ffd23f" },
      typography: { display: "graffiti", body: "clean", accent: "marker" }, coverStyle: "scribble_frame", iconStyle: "graffiti", layoutRule: "poster_punch", buttonStyle: "paint_stroke", moduleCardStyle: "outline_poster", decorElements: ["paint", "star", "tape"], supportedModules: commonModules, copyTone: "young_confident", previewCoverImage: "assets/templates/T11/preview.png", previewThumbImage: "assets/templates/T11/preview.webp", isPremiumTemplate: false
    }
  ];

  window.BD_TEMPLATE_ASSETS = assets;
  window.BD_TEMPLATE_ASSET_BY_ID = function (value) {
    return assets.find(function (asset) {
      return asset.templateId === value || asset.legacyId === value || asset.code === value;
    }) || null;
  };
})();