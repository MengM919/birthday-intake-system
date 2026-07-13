(function () {
  "use strict";

  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  window.BirthdayStorage = {
    allowedImageTypes,
    makeStoragePath(orderId, userId, category, file) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return `orders/${orderId}/${userId}/${category}/${id}.${ext}`;
    },
    validateFile(file, type) {
      if ((type === "image" || type === "cover") && !allowedImageTypes.includes(file.type)) throw new Error("仅支持 JPG、PNG、WEBP、HEIC、HEIF 图片。");
      const limit = type === "cover" ? 15 : type === "audio" ? 30 : 10;
      if (file.size > limit * 1024 * 1024) throw new Error(`${file.name} 超过 ${limit}MB。`);
    },
    async getPrivateFileUrl(storagePath, expiresIn = 600) {
      const client = window.BirthdaySupabase && window.BirthdaySupabase.getClient();
      if (!client) throw new Error("Supabase 未启用，无法生成私有文件链接。");
      const bucket = window.BD_SUPABASE_CONFIG.privateBucket || "birthday-order-private";
      const { data, error } = await client.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
      if (error) throw error;
      return data.signedUrl;
    }
  };
})();
