(function (global) {
  "use strict";

  function isSafeLocalScriptPath(path) {
    return (
      typeof path === "string" &&
      path.endsWith(".js") &&
      !path.includes("://") &&
      !path.startsWith("//") &&
      !path.includes("..") &&
      !path.includes("\\")
    );
  }

  function isAllowedPluginPath(path) {
    return (
      isSafeLocalScriptPath(path) &&
      path.startsWith("plugins/")
    );
  }

  function isAllowedRuntimePath(path) {
    return (
      isSafeLocalScriptPath(path) &&
      (path.startsWith("plugins/") || path === "libs/codemirror/editor.bundle.js")
    );
  }

  function getPackagedPlugins() {
    return [
      {
        path: "plugins/markdown/markdown.plugin.js",
        known: true,
        autoLoad: true
      },
      {
        path: "plugins/mermaid/mermaid.plugin.js",
        known: true,
        autoLoad: true
      },
      {
        path: "plugins/graphviz/graphviz.plugin.js",
        known: true,
        autoLoad: true
      },
      {
        path: "plugins/svg/svg.plugin.js",
        known: true,
        autoLoad: true
      }
    ];
  }

  class LocalHostAdapter {
    constructor() {
      this.mode = "local";
    }

    resolveAppUrl(path) {
      return path;
    }

    getDefaultKnownPlugins() {
      return getPackagedPlugins();
    }

    canAddPluginPath() {
      return true;
    }

    canUploadPluginFile() {
      return true;
    }

    validatePluginFile(file) {
      return Boolean(file && file.name && file.name.endsWith(".js"));
    }

    validatePluginPath(path) {
      return isAllowedPluginPath(path);
    }

    validateRuntimePath(path) {
      return isAllowedRuntimePath(path);
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
      return getPackagedPlugins();
    }

    canAddPluginPath() {
      return false;
    }

    canUploadPluginFile() {
      return false;
    }

    validatePluginFile(file) {
      return Boolean(file && file.name && file.name.endsWith(".js"));
    }

    validatePluginPath(path) {
      return isAllowedPluginPath(path);
    }

    validateRuntimePath(path) {
      return isAllowedRuntimePath(path);
    }
  }

  global.isSafeLocalScriptPath = isSafeLocalScriptPath;
  global.isAllowedPluginPath = isAllowedPluginPath;
  global.isAllowedRuntimePath = isAllowedRuntimePath;
  global.LocalHostAdapter = LocalHostAdapter;
  global.ExtensionHostAdapter = ExtensionHostAdapter;
})(window);
