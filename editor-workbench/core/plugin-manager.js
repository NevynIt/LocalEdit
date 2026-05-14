(function (global) {
  "use strict";

  function normalizeKnownPlugin(config) {
    return {
      id: config.id || undefined,
      path: config.path,
      known: true,
      autoLoad: Boolean(config.autoLoad),
      lastStatus: config.lastStatus || "unloaded",
      lastError: config.lastError || ""
    };
  }

  class PluginManager {
    constructor(host, storage, loader, registry) {
      this.host = host;
      this.storage = storage;
      this.loader = loader;
      this.registry = registry;
      this.knownPlugins = [];
      this.changeHandlers = [];
    }

    onChange(handler) {
      this.changeHandlers.push(handler);
    }

    emitChange() {
      this.changeHandlers.forEach(function (handler) {
        handler();
      });
    }

    async loadKnownPlugins() {
      var stored = await this.storage.get("knownPlugins");
      var defaults = this.host.getDefaultKnownPlugins();
      var byPath = new Map();

      defaults.forEach(function (config) {
        if (config && config.path) {
          byPath.set(config.path, normalizeKnownPlugin(config));
        }
      });

      if (Array.isArray(stored)) {
        stored.forEach(function (config) {
          if (config && config.path) {
            byPath.set(config.path, normalizeKnownPlugin(config));
          }
        });
      }

      this.knownPlugins = Array.from(byPath.values());
      await this.saveKnownPlugins(this.knownPlugins);
      this.emitChange();
      return this.listKnownPlugins();
    }

    async saveKnownPlugins(configs) {
      this.knownPlugins = (configs || []).map(normalizeKnownPlugin);
      await this.storage.set("knownPlugins", this.knownPlugins);
      this.emitChange();
    }

    async loadStartupPlugins() {
      var configs = this.knownPlugins.filter(function (config) {
        return config.autoLoad;
      });

      for (var index = 0; index < configs.length; index += 1) {
        await this.loadPlugin(configs[index].id || configs[index].path);
      }
    }

    async loadPlugin(pluginId) {
      var config = this.findKnownPlugin(pluginId);
      if (!config) {
        throw new Error("Known plugin was not found.");
      }

      var result = await this.loader.load(config.path);
      if (result.status === "loaded") {
        config.id = result.pluginId || config.id;
        config.lastStatus = "loaded";
        config.lastError = "";
      } else {
        config.lastStatus = "failed";
        config.lastError = result.error || "Plugin load failed.";
      }

      await this.saveKnownPlugins(this.knownPlugins);
      return result;
    }

    disablePlugin(pluginId) {
      this.registry.deactivatePlugin(pluginId);
      var config = this.findKnownPlugin(pluginId);
      if (config) {
        config.lastStatus = "unloaded";
        this.saveKnownPlugins(this.knownPlugins);
      }
      this.emitChange();
    }

    async setAutoLoad(pluginId, autoLoad) {
      var config = this.findKnownPlugin(pluginId);
      if (!config) {
        throw new Error("Known plugin was not found.");
      }

      config.autoLoad = Boolean(autoLoad);
      await this.saveKnownPlugins(this.knownPlugins);
    }

    async addKnownPlugin(path) {
      if (!this.host.canAddPluginPath()) {
        throw new Error("Adding plugin paths is disabled for this host.");
      }

      if (!this.host.validatePluginPath(path)) {
        throw new Error("Plugin path must be a local plugins/*.js path.");
      }

      var existing = this.findKnownPlugin(path);
      if (existing) {
        return existing;
      }

      var config = normalizeKnownPlugin({
        path: path,
        autoLoad: false
      });
      this.knownPlugins.push(config);
      await this.saveKnownPlugins(this.knownPlugins);
      return config;
    }

    async removeKnownPlugin(pluginId) {
      var config = this.findKnownPlugin(pluginId);
      if (!config) {
        return;
      }

      if (config.id) {
        this.registry.deactivatePlugin(config.id);
      }

      this.knownPlugins = this.knownPlugins.filter(function (item) {
        return item !== config;
      });
      await this.saveKnownPlugins(this.knownPlugins);
    }

    listKnownPlugins() {
      return this.knownPlugins.map(function (config) {
        return Object.assign({}, config);
      });
    }

    getPanelItems() {
      var registry = this.registry;
      return this.knownPlugins.map(function (config) {
        var registered = config.id ? registry.getPlugin(config.id) : undefined;
        return {
          config: Object.assign({}, config),
          registered: registered || undefined
        };
      });
    }

    findKnownPlugin(pluginId) {
      return this.knownPlugins.find(function (config) {
        return config.id === pluginId || config.path === pluginId;
      });
    }
  }

  global.PluginManager = PluginManager;
})(window);

