(function (global) {
  "use strict";

  class PluginLoader {
    constructor(host, registry) {
      this.host = host;
      this.registry = registry;
    }

    registerSanitizerAllowedAttributeUrls(plugin) {
      if (!plugin || !Array.isArray(plugin.allowedAttributeUrls) || plugin.allowedAttributeUrls.length === 0) {
        return;
      }

      var tools = global.EditorWorkbenchSanitize;
      if (tools && typeof tools.registerAllowedAttributeUrls === "function") {
        tools.registerAllowedAttributeUrls(plugin.allowedAttributeUrls);
        return;
      }

      global.EditorWorkbenchSanitizeAllowedAttributeUrls = global.EditorWorkbenchSanitizeAllowedAttributeUrls || [];
      for (var index = 0; index < plugin.allowedAttributeUrls.length; index += 1) {
        var url = plugin.allowedAttributeUrls[index];
        if (typeof url === "string" && url) {
          global.EditorWorkbenchSanitizeAllowedAttributeUrls.push(url);
        }
      }
    }

    async load(path) {
      if (!this.host.validatePluginPath(path)) {
        return {
          path: path,
          status: "failed",
          error: "Plugin path is not allowed."
        };
      }

      global.EditorPlugins = global.EditorPlugins || [];
      var beforeLength = global.EditorPlugins.length;

      try {
        await this.injectScript(path);
        var newPlugins = global.EditorPlugins.slice(beforeLength);

        if (newPlugins.length === 0) {
          return {
            path: path,
            status: "failed",
            error: "Plugin did not register itself."
          };
        }

        var firstPluginId;
        for (var index = 0; index < newPlugins.length; index += 1) {
          var plugin = newPlugins[index];
          this.registerSanitizerAllowedAttributeUrls(plugin);
          this.registry.registerPlugin(plugin, { path: path });
          if (!firstPluginId) {
            firstPluginId = plugin.id;
          }
        }

        return {
          path: path,
          status: "loaded",
          pluginId: firstPluginId
        };
      } catch (error) {
        return {
          path: path,
          status: "failed",
          error: error && error.message ? error.message : String(error)
        };
      }
    }

    async loadSource(fileName, sourceText) {
      if (!fileName || !fileName.endsWith(".js")) {
        return {
          path: fileName || "",
          status: "failed",
          error: "Uploaded plugin must be a .js file."
        };
      }

      global.EditorPlugins = global.EditorPlugins || [];
      var beforeLength = global.EditorPlugins.length;
      var blob = new Blob([sourceText || ""], { type: "text/javascript" });
      var url = global.URL.createObjectURL(blob);

      try {
        await this.injectScriptUrl(url);
        var newPlugins = global.EditorPlugins.slice(beforeLength);

        if (newPlugins.length === 0) {
          return {
            path: fileName,
            status: "failed",
            error: "Uploaded plugin did not register itself."
          };
        }

        var firstPluginId;
        for (var index = 0; index < newPlugins.length; index += 1) {
          var plugin = newPlugins[index];
          this.registerSanitizerAllowedAttributeUrls(plugin);
          this.registry.registerPlugin(plugin, {
            path: "uploaded:" + fileName,
            sourceType: "uploaded",
            fileName: fileName,
            sourceText: sourceText || ""
          });
          if (!firstPluginId) {
            firstPluginId = plugin.id;
          }
        }

        return {
          path: fileName,
          status: "loaded",
          pluginId: firstPluginId
        };
      } catch (error) {
        return {
          path: fileName,
          status: "failed",
          error: error && error.message ? error.message : String(error)
        };
      } finally {
        global.URL.revokeObjectURL(url);
      }
    }

    injectScript(path) {
      var host = this.host;
      return new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = host.resolveAppUrl(path);
        script.async = false;
        script.onload = function () {
          resolve();
        };
        script.onerror = function () {
          reject(new Error("Unable to load plugin script."));
        };
        document.head.appendChild(script);
      });
    }

    injectScriptUrl(url) {
      return new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = url;
        script.async = false;
        script.onload = function () {
          resolve();
        };
        script.onerror = function () {
          reject(new Error("Unable to load plugin script."));
        };
        document.head.appendChild(script);
      });
    }
  }

  global.PluginLoader = PluginLoader;
})(window);
