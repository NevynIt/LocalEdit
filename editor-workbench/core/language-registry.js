(function (global) {
  "use strict";

  class LanguageRegistry {
    constructor() {
      this.languages = new Map();
    }

    register(language) {
      if (!language || !language.id || !language.label) {
        throw new Error("Language definitions require id and label.");
      }

      this.languages.set(language.id, {
        id: language.id,
        label: language.label,
        extensions: Array.isArray(language.extensions) ? language.extensions.slice() : [],
        mimeTypes: Array.isArray(language.mimeTypes) ? language.mimeTypes.slice() : []
      });
    }

    get(languageId) {
      return this.languages.get(languageId);
    }

    list() {
      return Array.from(this.languages.values()).sort(function (a, b) {
        return a.label.localeCompare(b.label);
      });
    }

    inferFromFileName(fileName) {
      if (!fileName || !fileName.includes(".")) {
        return undefined;
      }

      var lowerName = fileName.toLowerCase();
      var found;
      var foundLength = 0;
      this.languages.forEach(function (language) {
        language.extensions.forEach(function (extension) {
          var normalized = String(extension || "").toLowerCase();
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
