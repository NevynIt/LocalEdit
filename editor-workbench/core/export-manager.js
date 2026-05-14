(function (global) {
  "use strict";

  class ExportManager {
    constructor(registry, runtime) {
      this.registry = registry;
      this.runtime = runtime;
    }

    list(languageId) {
      return this.registry.getExporters(languageId);
    }

    async export(exporterId, input) {
      var documentModel = input && input.sourceDocument;
      var languageId = documentModel ? documentModel.languageId : "plain-text";
      var exporter = this.registry.getExporter(exporterId, languageId);
      if (!exporter) {
        throw new Error("Exporter was not found.");
      }

      return exporter.export(input, {
        suggestedFileName: documentModel && documentModel.fileName,
        runtime: this.runtime
      });
    }
  }

  global.ExportManager = ExportManager;
})(window);
