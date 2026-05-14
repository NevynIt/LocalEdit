(function (global) {
  "use strict";

  function isAllowedPluginPath(path) {
    return (
      typeof path === "string" &&
      path.startsWith("plugins/") &&
      path.endsWith(".js") &&
      !path.includes("://") &&
      !path.startsWith("//") &&
      !path.includes("..")
    );
  }

  class LocalHostAdapter {
    constructor() {
      this.mode = "local";
    }

    resolveAppUrl(path) {
      return path;
    }

    getDefaultKnownPlugins() {
      return [];
    }

    canAddPluginPath() {
      return true;
    }

    validatePluginPath(path) {
      return isAllowedPluginPath(path);
    }
  }

  class ExtensionHostAdapter {
    constructor() {
      this.mode = "extension";
    }

    resolveAppUrl(path) {
      if (global.chrome && global.chrome.runtime && global.chrome.runtime.getURL) {
        return global.chrome.runtime.getURL(path);
      }

      return path;
    }

    getDefaultKnownPlugins() {
      return [];
    }

    canAddPluginPath() {
      return false;
    }

    validatePluginPath(path) {
      return isAllowedPluginPath(path);
    }
  }

  global.isAllowedPluginPath = isAllowedPluginPath;
  global.LocalHostAdapter = LocalHostAdapter;
  global.ExtensionHostAdapter = ExtensionHostAdapter;
})(window);

