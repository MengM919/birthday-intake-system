(function () {
  "use strict";

  var allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  function extension(file) {
    return ((file && file.name || "").split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  }

  window.BirthdayStorage = {
    allowedImageTypes: allowedImageTypes,
    makeStoragePath: function (orderId, userId, category, file) {
      var safeExtension = extension(file);
      var id = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random().toString(16).slice(2));
      return "orders/" + orderId + "/" + userId + "/" + category + "/" + id + "." + safeExtension;
    },
    validateFile: function (file, type) {
      var isImage = type === "image" || type === "cover";
      if (isImage && !allowedImageTypes.includes((file.type || "").toLowerCase())) {
        throw new Error("\u4ec5\u652f\u6301 JPG\u3001PNG\u3001WEBP\u3001HEIC \u6216 HEIF \u56fe\u7247\u3002");
      }
      var limit = type === "cover" ? 15 : type === "audio" ? 30 : 10;
      if (file.size > limit * 1024 * 1024) throw new Error((file.name || "\u6587\u4ef6") + " \u8d85\u8fc7 " + limit + "MB\u3002");
    },
    getPrivateFileUrl: async function (storagePath, expiresIn, bucketName) {
      var client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) throw new Error("Supabase is not configured.");
      var bucket = bucketName || window.BD_SUPABASE_CONFIG.privateBucket || "birthday-order-private";
      var result = await client.storage.from(bucket).createSignedUrl(storagePath, expiresIn || 600);
      if (result.error) throw result.error;
      return result.data.signedUrl;
    }
  };
})();