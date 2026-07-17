(function () {
  "use strict";

  var imageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  var mimeByExtension = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

  function id() {
    return (crypto.randomUUID && crypto.randomUUID()) || (Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  function fileMime(file) {
    if (file.type) return file.type.toLowerCase();
    var extension = (file.name.split(".").pop() || "").toLowerCase();
    return mimeByExtension[extension] || "";
  }

  function validate(file, kind) {
    if (!file) throw new Error("\u8bf7\u5148\u9009\u62e9\u4e00\u5f20\u7167\u7247\u3002");
    var type = fileMime(file);
    if (!imageTypes.includes(type)) {
      throw new Error("\u4ec5\u652f\u6301 JPG\u3001PNG\u3001WEBP\u3001HEIC \u6216 HEIF \u7167\u7247\u3002");
    }
    var maxMb = kind === "cover" ? 15 : 10;
    if (file.size > maxMb * 1024 * 1024) {
      throw new Error(file.name + " \u8d85\u8fc7 " + maxMb + "MB\uff0c\u8bf7\u538b\u7f29\u6216\u66ff\u6362\u540e\u91cd\u8bd5\u3002");
    }
  }

  function imageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("\u8fd9\u5f20\u7167\u7247\u6682\u65f6\u65e0\u6cd5\u89e3\u6790\u3002")); };
      image.src = url;
    });
  }

  async function decode(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file); } catch (_) { /* Fall through to Image. */ }
    }
    return imageFromFile(file);
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("\u7167\u7247\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u6216\u66ff\u6362\u7167\u7247\u3002"));
      }, type, quality);
    });
  }

  async function prepare(file, kind) {
    validate(file, kind);
    var sourceType = fileMime(file);
    var source;
    try {
      source = await decode(file);
    } catch (error) {
      if (sourceType === "image/heic" || sourceType === "image/heif") {
        throw new Error("\u5f53\u524d\u6d4f\u89c8\u5668\u6682\u4e0d\u80fd\u5904\u7406 HEIC\uff0c\u8bf7\u5728 iPhone \u76f8\u518c\u4e2d\u5206\u4eab\u4e3a JPEG \u540e\u91cd\u8bd5\uff0c\u6216\u6362\u7528 Safari \u6253\u5f00\u8fd9\u4e2a\u9875\u9762\u3002");
      }
      throw error;
    }
    var width = source.width || source.naturalWidth;
    var height = source.height || source.naturalHeight;
    var maxSide = kind === "cover" ? 3000 : 2560;
    var ratio = Math.min(1, maxSide / Math.max(width, height));
    var targetWidth = Math.max(1, Math.round(width * ratio));
    var targetHeight = Math.max(1, Math.round(height * ratio));
    var canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    var context = canvas.getContext("2d", { alpha: false });
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    if (typeof source.close === "function") source.close();
    var blob = await canvasBlob(canvas, "image/jpeg", 0.88);
    var safeName = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
    var output = new File([blob], safeName, { type: "image/jpeg", lastModified: Date.now() });
    return {
      id: id(),
      sourceFile: file,
      file: output,
      originalName: file.name || safeName,
      previewUrl: URL.createObjectURL(output),
      width: targetWidth,
      height: targetHeight,
      status: "ready",
      error: "",
      isFeatured: false,
      featuredSortOrder: null,
      focalX: 0.5,
      focalY: 0.5,
      cropData: { focalX: 0.5, focalY: 0.5, sourceWidth: width, sourceHeight: height }
    };
  }

  function revoke(photo) {
    if (photo && photo.previewUrl && photo.previewUrl.indexOf("blob:") === 0) URL.revokeObjectURL(photo.previewUrl);
  }

  function setFocal(photo, x, y) {
    photo.focalX = x;
    photo.focalY = y;
    photo.cropData = Object.assign({}, photo.cropData || {}, { focalX: x, focalY: y });
    return photo;
  }

  function reorder(items, sourceId, targetId) {
    var from = items.findIndex(function (item) { return item.id === sourceId; });
    var to = items.findIndex(function (item) { return item.id === targetId; });
    if (from < 0 || to < 0 || from === to) return items;
    var next = items.slice();
    var moved = next.splice(from, 1)[0];
    next.splice(to, 0, moved);
    return next;
  }

  function bytes(size) {
    if (!Number.isFinite(size)) return "";
    if (size < 1024 * 1024) return Math.max(1, Math.round(size / 1024)) + " KB";
    return (size / 1024 / 1024).toFixed(1) + " MB";
  }

  window.BirthdayPhotoManager = {
    imageTypes: imageTypes,
    validate: validate,
    prepare: prepare,
    revoke: revoke,
    setFocal: setFocal,
    reorder: reorder,
    bytes: bytes
  };
})();