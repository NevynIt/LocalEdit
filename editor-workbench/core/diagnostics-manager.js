(function (global) {
  "use strict";

  class DiagnosticsManager {
    constructor(registry) {
      this.registry = registry;
      this.diagnostics = [];
    }

    async run(documentModel) {
      var linters = this.registry.getLinters(documentModel.languageId);
      var diagnostics = [];

      for (var index = 0; index < linters.length; index += 1) {
        var linter = linters[index];
        try {
          var result = await linter.lint(documentModel, {
            languageId: documentModel.languageId
          });
          if (Array.isArray(result)) {
            diagnostics = diagnostics.concat(result);
          }
        } catch (error) {
          diagnostics.push({
            from: 0,
            to: 0,
            severity: "warning",
            message: error && error.message ? error.message : String(error),
            source: linter.name || linter.id
          });
        }
      }

      this.diagnostics = diagnostics;
      return diagnostics;
    }

    clear() {
      this.diagnostics = [];
    }
  }

  global.DiagnosticsManager = DiagnosticsManager;
})(window);

