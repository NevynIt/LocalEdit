(function (global) {
  "use strict";

  class RuntimeLoader {
    constructor(host) {
      this.host = host;
      this.loaded = new Set();
      this.pending = new Map();
    }

    async ensureScripts(paths) {
      var list = Array.isArray(paths) ? paths : [paths];
      for (var index = 0; index < list.length; index += 1) {
        if (list[index]) {
          await this.ensureScript(list[index]);
        }
      }
    }

    ensureScript(path) {
      if (this.loaded.has(path)) {
        return Promise.resolve(path);
      }

      if (this.pending.has(path)) {
        return this.pending.get(path);
      }

      if (!this.host.validateRuntimePath(path)) {
        return Promise.reject(new Error("Runtime path is not allowed."));
      }

      var promise = this.injectScript(path)
        .then(() => {
          this.loaded.add(path);
          this.pending.delete(path);
          return path;
        })
        .catch((error) => {
          this.pending.delete(path);
          throw error;
        });

      this.pending.set(path, promise);
      return promise;
    }

    injectScript(path) {
      var host = this.host;
      return new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = host.resolveAppUrl(path);
        script.async = false;
        script.dataset.runtimePath = path;
        script.onload = function () {
          resolve();
        };
        script.onerror = function () {
          reject(new Error("Unable to load runtime script: " + path));
        };
        document.head.appendChild(script);
      });
    }
  }

  global.RuntimeLoader = RuntimeLoader;
})(window);
