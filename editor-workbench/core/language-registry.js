(function (global) {
  "use strict";

  class LanguageRegistry {
    constructor() {
      this.languages = new Map();
    }

    register(language) {
      if (!language || !language.id || !language.name) {
        throw new Error("Language definitions require id and name.");
      }

      this.languages.set(language.id, {
        id: language.id,
        name: language.name,
        fileExtensions: Array.isArray(language.fileExtensions) ? language.fileExtensions.slice() : [],
        mediaType: language.mediaType || "",
        description: language.description || ""
      });
    }

    get(languageId) {
      return this.languages.get(languageId);
    }

    list() {
      return Array.from(this.languages.values()).sort(function (a, b) {
        return a.name.localeCompare(b.name);
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
