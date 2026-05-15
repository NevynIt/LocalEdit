(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeExtension(extension) {
    var value = String(extension || "").trim().toLowerCase();
    if (!value) {
      return "";
    }
    return value.charAt(0) === "." ? value : "." + value;
  }

  function compareLanguages(a, b) {
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  }

  class LanguageRegistry {
    constructor() {
      this.languages = new Map();
      this.aliases = new Map();
    }

    normalizeLanguage(language) {
      if (!language || !language.id || !language.name) {
        throw new Error("Language definitions require id and name.");
      }

      var id = String(language.id);
      var parentLanguageId = language.parentLanguageId;
      if (id === "text") {
        parentLanguageId = null;
      } else if (parentLanguageId === undefined) {
        parentLanguageId = "text";
      }

      return {
        id: id,
        name: language.name,
        parentLanguageId: parentLanguageId || null,
        aliases: list(language.aliases),
        fileExtensions: list(language.fileExtensions).map(normalizeExtension).filter(Boolean),
        mediaType: language.mediaType || list(language.mediaTypes)[0] || "",
        mediaTypes: list(language.mediaTypes).length ? list(language.mediaTypes).slice() : (language.mediaType ? [language.mediaType] : []),
        description: language.description || "",
        category: language.category || "",
        menuPath: language.menuPath || undefined
      };
    }

    register(language) {
      var normalized = this.normalizeLanguage(language);
      this.languages.set(normalized.id, normalized);
      this.aliases.delete(normalized.id);
      normalized.aliases.forEach((alias) => {
        if (alias) {
          this.aliases.set(alias, normalized.id);
        }
      });
      return normalized;
    }

    getCanonicalId(languageId) {
      if (!languageId) {
        return undefined;
      }
      var id = String(languageId);
      if (this.languages.has(id)) {
        return id;
      }
      return this.aliases.get(id);
    }

    get(languageId) {
      var canonicalId = this.getCanonicalId(languageId);
      return canonicalId ? this.languages.get(canonicalId) : undefined;
    }

    list() {
      var self = this;
      var grouped = new Map();
      this.languages.forEach(function (language) {
        var parentId = language.parentLanguageId || "";
        if (!grouped.has(parentId)) {
          grouped.set(parentId, []);
        }
        grouped.get(parentId).push(language);
      });

      grouped.forEach(function (items) {
        items.sort(compareLanguages);
      });

      var ordered = [];
      var seen = new Set();

      function visit(language, depth) {
        if (!language || seen.has(language.id)) {
          return;
        }
        seen.add(language.id);
        ordered.push(Object.assign({}, language, {
          depth: depth,
          displayName: (depth > 0 ? new Array(depth + 1).join("  ") : "") + language.name
        }));
        (grouped.get(language.id) || []).forEach(function (child) {
          visit(child, depth + 1);
        });
      }

      (grouped.get("") || []).forEach(function (language) {
        visit(language, 0);
      });

      this.languages.forEach(function (language) {
        if (!seen.has(language.id)) {
          visit(language, 0);
        }
      });

      return ordered;
    }

    getAncestors(languageId) {
      var result = [];
      var seen = new Set();
      var current = this.get(languageId);
      while (current && current.parentLanguageId) {
        var parentId = this.getCanonicalId(current.parentLanguageId) || current.parentLanguageId;
        if (!parentId || seen.has(parentId)) {
          break;
        }
        seen.add(parentId);
        result.push(parentId);
        current = this.get(parentId);
      }
      return result;
    }

    isSameOrDescendantOf(languageId, candidateParentId) {
      var canonicalId = this.getCanonicalId(languageId);
      var canonicalParentId = this.getCanonicalId(candidateParentId);
      if (!canonicalId || !canonicalParentId) {
        return false;
      }
      return canonicalId === canonicalParentId || this.getAncestors(canonicalId).indexOf(canonicalParentId) !== -1;
    }

    getSpecificityDistance(languageId, candidateParentId) {
      var canonicalId = this.getCanonicalId(languageId);
      var canonicalParentId = this.getCanonicalId(candidateParentId);
      if (!canonicalId || !canonicalParentId) {
        return -1;
      }
      if (canonicalId === canonicalParentId) {
        return 0;
      }
      return this.getAncestors(canonicalId).indexOf(canonicalParentId) + 1;
    }

    listApplicableLanguages(languageId) {
      var canonicalId = this.getCanonicalId(languageId);
      if (!canonicalId) {
        return [];
      }
      return [canonicalId].concat(this.getAncestors(canonicalId));
    }

    inferFromFileName(fileName) {
      if (!fileName || !fileName.includes(".")) {
        return undefined;
      }

      var lowerName = fileName.toLowerCase();
      var found;
      var foundLength = 0;
      this.languages.forEach(function (language) {
        language.fileExtensions.forEach(function (extension) {
          var normalized = String(extension || "").toLowerCase();
          if (normalized.charAt(0) === ".") {
            normalized = normalized.slice(1);
          }
          if (normalized && lowerName.endsWith("." + normalized) && normalized.length > foundLength) {
            found = language.id;
            foundLength = normalized.length;
          }
        });
      });
      return found;
    }
  }

  global.LanguageRegistry = LanguageRegistry;
})(window);
