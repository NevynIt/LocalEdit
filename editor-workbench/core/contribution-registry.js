(function (global) {
  "use strict";

  var CONTRIBUTION_COLLECTIONS = {
    languages: "language",
    editors: "editor",
    editorExtensions: "editor-extension",
    transformers: "transformer",
    renderers: "renderer",
    exporters: "exporter",
    linters: "linter",
    pipelines: "pipeline"
  };

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function contributionLanguages(contribution) {
    if (!contribution) {
      return [];
    }

    var kind = contribution.kind;
    if (kind === "pipeline") {
      return contribution.inputLanguage ? [contribution.inputLanguage] : [];
    }
    if (kind === "transformer") {
      return contribution.inputLanguage ? [contribution.inputLanguage] : list(contribution.inputLanguages);
    }
    if (kind === "editor-extension") {
      return list(contribution.languages || contribution.accepts);
    }

    return list(contribution.accepts || contribution.languages || contribution.inputLanguages);
  }

  function matchesLanguage(contribution, languageId, languageRegistry) {
    if (!languageId || !contribution) {
      return true;
    }

    var accepted = contributionLanguages(contribution);
    if (accepted.length === 0 || accepted.indexOf("*") !== -1) {
      return true;
    }

    if (!languageRegistry) {
      return accepted.indexOf(languageId) !== -1;
    }

    return accepted.some(function (supportedLanguageId) {
      return languageRegistry.isSameOrDescendantOf(languageId, supportedLanguageId);
    });
  }

  function languageSpecificity(contribution, languageId, languageRegistry) {
    var accepted = contributionLanguages(contribution);
    if (!languageId || accepted.length === 0 || accepted.indexOf("*") !== -1) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (!languageRegistry) {
      return accepted.indexOf(languageId) !== -1 ? 0 : Number.MAX_SAFE_INTEGER;
    }

    var distances = accepted.map(function (supportedLanguageId) {
      return languageRegistry.getSpecificityDistance(languageId, supportedLanguageId);
    }).filter(function (distance) {
      return distance >= 0;
    });
    if (!distances.length) {
      return Number.MAX_SAFE_INTEGER;
    }
    return Math.min.apply(Math, distances);
  }

  function cloneContribution(contribution, metadata) {
    var cloned = Object.assign({}, contribution);
    cloned.kind = metadata.kind;
    cloned.pluginId = metadata.pluginId;
    cloned.pluginName = metadata.pluginName;
    cloned.requires = list(cloned.requires);
    return cloned;
  }

  function hasDeclaredLanguage(contribution) {
    return Boolean(
      contribution
      && (
        contribution.inputLanguage
        || (Array.isArray(contribution.inputLanguages) && contribution.inputLanguages.length)
      )
    );
  }

  function validateContributionShape(kind, contribution, pluginId) {
    if (kind !== "transformer") {
      return;
    }
    if (!hasDeclaredLanguage(contribution)) {
      throw new Error("Transformer " + contribution.id + " in " + pluginId + " must declare an input language.");
    }
    if (!contribution.outputLanguage || typeof contribution.outputLanguage !== "string") {
      throw new Error("Transformer " + contribution.id + " in " + pluginId + " must declare outputLanguage.");
    }
  }

  class ContributionRegistry {
    constructor(languageRegistry) {
      this.languageRegistry = languageRegistry || null;
      this.plugins = new Map();
      this.contributions = new Map();
      this.disabledContributions = new Set();
      Object.keys(CONTRIBUTION_COLLECTIONS).forEach((collection) => {
        this.contributions.set(CONTRIBUTION_COLLECTIONS[collection], new Map());
      });
    }

    registerPlugin(plugin, metadata) {
      if (!plugin || !plugin.id || !plugin.name || !plugin.version) {
        throw new Error("Plugin metadata requires id, name, and version.");
      }
      if (!plugin.contributes || typeof plugin.contributes !== "object") {
        throw new Error("Plugin " + plugin.id + " must use the contributes API.");
      }

      this.unregisterPluginContributions(plugin.id);
      var existing = this.plugins.get(plugin.id);
      var active = existing ? existing.active : true;
      var entry = {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description || "",
        path: metadata && metadata.path ? metadata.path : existing && existing.path,
        sourceType: metadata && metadata.sourceType ? metadata.sourceType : existing && existing.sourceType || "path",
        fileName: metadata && metadata.fileName ? metadata.fileName : existing && existing.fileName,
        sourceText: metadata && metadata.sourceText ? metadata.sourceText : existing && existing.sourceText,
        active: active,
        status: active ? "loaded" : "inactive",
        error: "",
        plugin: plugin,
        languages: list(plugin.contributes.languages).map(function (language) {
          return language.id;
        }).filter(Boolean)
      };

      this.plugins.set(plugin.id, entry);
      this.registerContributions(plugin);
    }

    registerContributions(plugin) {
      Object.keys(CONTRIBUTION_COLLECTIONS).forEach((collection) => {
        var kind = CONTRIBUTION_COLLECTIONS[collection];
        list(plugin.contributes[collection]).forEach((contribution) => {
          if (!contribution || !contribution.id) {
            throw new Error("Contribution in " + plugin.id + " is missing an id.");
          }

          validateContributionShape(kind, contribution, plugin.id);

          var byKind = this.contributions.get(kind);
          if (byKind.has(contribution.id)) {
            throw new Error("Duplicate " + kind + " contribution id: " + contribution.id + ".");
          }
          if (global.ParameterSchema && contribution.parameters) {
            global.ParameterSchema.validateSchema(contribution.parameters, contribution.id);
          }

          byKind.set(contribution.id, cloneContribution(contribution, {
            kind: kind,
            pluginId: plugin.id,
            pluginName: plugin.name
          }));
        });
      });
    }

    unregisterPluginContributions(pluginId) {
      this.contributions.forEach(function (byKind) {
        Array.from(byKind.values()).forEach(function (contribution) {
          if (contribution.pluginId === pluginId) {
            byKind.delete(contribution.id);
          }
        });
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

    disableContribution(contributionId) {
      this.disabledContributions.add(contributionId);
    }

    enableContribution(contributionId) {
      this.disabledContributions.delete(contributionId);
    }

    getActivePluginLoadSpecs() {
      return this.listPlugins()
        .filter(function (entry) {
          return entry.active && (entry.path || entry.sourceText);
        })
        .map(function (entry) {
          if (entry.sourceType === "uploaded") {
            return {
              sourceType: "uploaded",
              fileName: entry.fileName || entry.id + ".js",
              sourceText: entry.sourceText || ""
            };
          }

          return {
            sourceType: "path",
            path: entry.path
          };
        });
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

    getContributions(kind, languageId) {
      var byKind = this.contributions.get(kind);
      if (!byKind) {
        return [];
      }

      var result = [];
      byKind.forEach((contribution) => {
        var plugin = this.plugins.get(contribution.pluginId);
        if (!plugin || !plugin.active) {
          return;
        }
        if (!matchesLanguage(contribution, languageId, this.languageRegistry)) {
          return;
        }
        if (this.getAvailability(contribution).state !== "available") {
          return;
        }
        result.push(contribution);
      });
      var languageRegistry = this.languageRegistry;
      return result.sort(function (a, b) {
        var specificityA = languageSpecificity(a, languageId, languageRegistry);
        var specificityB = languageSpecificity(b, languageId, languageRegistry);
        if (specificityA !== specificityB) {
          return specificityA - specificityB;
        }
        return (a.name || a.id).localeCompare(b.name || b.id);
      });
    }

    getContribution(kind, id) {
      var byKind = this.contributions.get(kind);
      return byKind ? byKind.get(id) : undefined;
    }

    findContribution(id) {
      var found;
      this.contributions.forEach(function (byKind) {
        if (!found && byKind.has(id)) {
          found = byKind.get(id);
        }
      });
      return found;
    }

    getAvailability(contribution) {
      if (!contribution) {
        return { state: "unavailable", reason: "Contribution was not found." };
      }
      if (this.disabledContributions.has(contribution.id)) {
        return { state: "disabled", reason: "Disabled by user." };
      }

      for (var index = 0; index < contribution.requires.length; index += 1) {
        var requirement = contribution.requires[index];
        if (!requirement || !requirement.kind || !requirement.id) {
          continue;
        }

        if (requirement.kind === "runtime") {
          continue;
        }

        if (!this.getContribution(requirement.kind, requirement.id)) {
          return {
            state: "unavailable",
            reason: "Missing " + requirement.kind + " dependency: " + requirement.id + "."
          };
        }
      }

      return { state: "available", reason: "" };
    }

    getLanguages() {
      return this.getContributions("language");
    }

    getEditors(languageId) {
      return this.getContributions("editor", languageId);
    }

    getEditorExtensions(editorId, languageId) {
      return this.getContributions("editor-extension", languageId).filter(function (extension) {
        return extension.editor === editorId;
      });
    }

    getLinters(languageId) {
      return this.getContributions("linter", languageId);
    }

    getTransformers(languageId) {
      return this.getContributions("transformer", languageId);
    }

    getRenderers(languageId) {
      return this.getContributions("renderer", languageId);
    }

    getExporters(languageId) {
      return this.getContributions("exporter", languageId);
    }

    getPipelines(languageId) {
      return this.getContributions("pipeline", languageId);
    }
  }

  global.ContributionRegistry = ContributionRegistry;
  global.PluginRegistry = ContributionRegistry;
})(window);
