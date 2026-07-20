(function () {
  "use strict";

  var defaultComposition = {
    heroVariant: "classic",
    contentFlow: "memory-blessing-wish-surprise-share",
    galleryVariant: "polaroid-scroll",
    sectionDivider: "soft-line",
    footerVariant: "warm-note"
  };

  var defaultVisual = {
    texture: "paper",
    iconSet: "gentle-line",
    motionPreset: "soft-rise",
    decorDensity: "light"
  };

  var defaultCopy = {
    openCta: "拆开给你的生日惊喜",
    storyLead: "有一些认真准备好的小心意，正在等你慢慢打开。"
  };

  var templateV2 = {
    line_bloom_white: {
      version: "2.0.0",
      composition: {
        heroVariant: "line-bloom",
        contentFlow: "memory-blessing-wish-surprise-share",
        galleryVariant: "line-grid",
        sectionDivider: "drawn-line",
        footerVariant: "garden-note"
      },
      visual: { texture: "white-paper", iconSet: "drawn-bloom", motionPreset: "quick-gentle", decorDensity: "light" },
      copy: { openCta: "拆开给你的生日惊喜", storyLead: "今天的花、线条和小小心意，都在为你留出位置。" },
      moduleVariants: { gallery: "line-grid", messageWall: "notes-on-paper", wishBottle: "glass-bottle", futureMailbox: "folded-letter", surpriseBox: "garden-gift" }
    },
    collage_pop_redblue: {
      version: "2.0.0",
      composition: {
        heroVariant: "collage-poster",
        contentFlow: "memory-blessing-wish-surprise-share",
        galleryVariant: "collage-wall",
        sectionDivider: "torn-paper",
        footerVariant: "ticket-signoff"
      },
      visual: { texture: "grid-paper", iconSet: "paper-cut", motionPreset: "paper-slide", decorDensity: "medium" },
      copy: { openCta: "拆开今天的大惊喜", storyLead: "把好心情贴满这一页，今天就要为你热热闹闹。" },
      moduleVariants: { gallery: "collage-wall", messageWall: "postcard-board", wishBottle: "label-jar", futureMailbox: "red-envelope", surpriseBox: "poster-gift" }
    },
    pink_dark_gothic: {
      version: "2.0.0",
      composition: {
        heroVariant: "cinematic-portrait",
        contentFlow: "memory-blessing-wish-surprise-share",
        galleryVariant: "film-strip",
        sectionDivider: "rose-fade",
        footerVariant: "sealed-letter"
      },
      visual: { texture: "midnight-grain", iconSet: "romantic-line", motionPreset: "slow-cinematic", decorDensity: "restrained" },
      copy: { openCta: "打开今晚只属于你的偏爱", storyLead: "把灯光调暗一点，今晚的温柔都写给你。" },
      moduleVariants: { gallery: "film-strip", messageWall: "sealed-notes", wishBottle: "night-bottle", futureMailbox: "wax-letter", surpriseBox: "night-gift-stage" }
    }
  };

  function object(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function resolveBase(asset) {
    var requested = object(asset);
    var id = String(requested.templateId || requested.legacyId || "");
    var finder = window.BD_TEMPLATE_ASSET_BY_ID;
    var base = typeof finder === "function" ? finder(id) : null;
    if (!base && Array.isArray(window.BD_TEMPLATE_ASSETS)) {
      base = window.BD_TEMPLATE_ASSETS.find(function (item) {
        return item.templateId === id || item.legacyId === id || item.code === id;
      }) || null;
    }
    return object(base);
  }

  function resolve(asset) {
    var snapshot = object(asset);
    var base = resolveBase(snapshot);
    var templateId = String(snapshot.templateId || base.templateId || snapshot.legacyId || base.legacyId || "line_bloom_white");
    var snapshotVersion = String(snapshot.version || base.version || "1.0.0");
    var v2 = templateV2[templateId];
    var isV2 = Boolean(v2 && /^2(?:\.|$)/.test(snapshotVersion));
    var storedLayout = object(snapshot.layout);
    var storedVisual = object(snapshot.visual);
    var storedCopy = object(snapshot.copy);
    var storedVariants = object(snapshot.moduleVariants);

    return {
      id: templateId,
      legacyId: String(snapshot.legacyId || base.legacyId || base.code || "T01"),
      name: String(snapshot.name || base.name || "生日惊喜"),
      version: snapshotVersion,
      palette: Object.assign({}, object(base.palette), object(snapshot.palette)),
      typography: Object.assign({}, object(base.typography), object(snapshot.typography)),
      coverStyle: String(snapshot.coverStyle || base.coverStyle || "freeform_frame"),
      copyTone: String(snapshot.copyTone || base.copyTone || "bright_warm"),
      decorElements: Array.isArray(snapshot.decorElements) ? snapshot.decorElements : (Array.isArray(base.decorElements) ? base.decorElements : []),
      composition: Object.assign({}, defaultComposition, isV2 ? v2.composition : {}, storedLayout),
      visual: Object.assign({}, defaultVisual, isV2 ? v2.visual : {}, storedVisual),
      copy: Object.assign({}, defaultCopy, isV2 ? v2.copy : {}, storedCopy),
      moduleVariants: Object.assign({}, isV2 ? v2.moduleVariants : {}, storedVariants),
      isV2: isV2
    };
  }

  function manifestFor(templateId) {
    var definition = templateV2[templateId];
    if (!definition) return null;
    return {
      version: definition.version,
      layout: definition.composition,
      visual: definition.visual,
      copy: definition.copy,
      moduleVariants: definition.moduleVariants
    };
  }

  window.BirthdayTemplateRegistry = {
    resolve: resolve,
    manifestFor: manifestFor,
    v2Templates: Object.keys(templateV2)
  };
})();