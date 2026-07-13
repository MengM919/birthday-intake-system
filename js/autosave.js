(function () {
  "use strict";

  window.BirthdayAutosave = {
    timer: null,
    status: "local-only",
    schedule(callback, delay = 1000) {
      window.clearTimeout(this.timer);
      this.status = navigator.onLine ? "saving" : "offline";
      this.timer = window.setTimeout(async () => {
        try {
          await callback();
          this.status = "saved";
        } catch (error) {
          console.error("Autosave failed:", error);
          this.status = navigator.onLine ? "failed" : "offline";
        }
      }, delay);
    }
  };
})();
