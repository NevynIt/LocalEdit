(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function matchesLanguage(provider, languageId, fieldName) {
    var languages = list(provider[fieldName]);
    return languages.length === 0 || languages.indexOf(languageId) !== -1;
  }

  class PluginRegistry {
    constructor() {
      this.plugins = new Map();
    }

    registerPlugin(plugin, metadata) {
      if (!plugin || !plugin.id || !plugin.name || !plugin.version) {
        throw new Error("Plugin metadata requires id, name, and version.");
      }

      var existing = this.plugins.get(plugin.id);
      var active = existing ? existing.active : true;
      this.plugins.set(plugin.id, {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description || "",
        path: metadata && metadata.path ? metadata.path : existing && existing.path,
        languages: list(plugin.languages),
        active: active,
        status: active ? "loaded" : "inactive",
        error: "",
        plugin: Object.assign({}, plugin, {
          highlighters: list(plugin.highlighters),
          linters: list(plugin.linters),
          transformers: list(plugin.transformers),
          renderers: list(plugin.renderers),
          exporters: list(plugin.exporters)
        })
      });
    }

    listPlugins() {
      return Array.from(this.plugins.values()).sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    }

    getPlugin(pluginId) {
      return this.plugins.get(pluginId);
    }

    activatePlugin(pluginId) {
      var plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.active = true;
        plugin.status = "loaded";
      }
    }

    deactivatePlugin(pluginId) {
      var plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.active = false;
        plugin.status = "inactive";
      }
    }

    getHighlighters(languageId) {
      return this.getProviders("highlighters", languageId, "languages");
    }

    getLinters(languageId) {
      return this.getProviders("linters", languageId, "languages");
    }

    getTransformers(languageId) {
      return this.getProviders("transformers", languageId, "inputLanguages");
    }

    getRenderers(languageId) {
      return this.getProviders("renderers", languageId, "inputLanguages");
    }

    getExporters(languageId) {
      return this.getProviders("exporters", languageId, "languages");
    }

    getTransformer(transformerId, languageId) {
      return this.findProvider("transformers", transformerId, languageId, "inputLanguages");
    }

    getRenderer(rendererId, languageId) {
      return this.findProvider("renderers", rendererId, languageId, "inputLanguages");
    }

    getExporter(exporterId, languageId) {
      return this.findProvider("exporters", exporterId, languageId, "languages");
    }

    getActivePluginPaths() {
      return this.listPlugins()
        .filter(function (entry) {
          return entry.active && entry.path;
        })
        .map(function (entry) {
          return entry.path;
        });
    }

    getProviders(kind, languageId, languageField) {
      var providers = [];
      this.plugins.forEach(function (entry) {
        if (!entry.active) {
          return;
        }

        list(entry.plugin[kind]).forEach(function (provider) {
          if (matchesLanguage(provider, languageId, languageField)) {
            providers.push(provider);
          }
        });
      });
      return providers;
    }

    findProvider(kind, providerId, languageId, languageField) {
      var providers = this.getProviders(kind, languageId, languageField);
      return providers.find(function (provider) {
        return provider.id === providerId;
      });
    }
  }

  global.PluginRegistry = PluginRegistry;
})(window);

