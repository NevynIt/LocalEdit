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

    async export(exporterId, input, params) {
      var documentModel = input && input.sourceDocument;
      var languageId = documentModel ? documentModel.languageId : "plain-text";
      var exporter = this.registry.getContribution("exporter", exporterId);
      if (!exporter) {
        throw new Error("Exporter was not found.");
      }

      var resolvedParams = global.ParameterSchema
        ? global.ParameterSchema.applyDefaults(exporter.parameters, params || {}, exporter.id)
        : Object.assign({}, params || {});

      return exporter.export({
        text: documentModel ? documentModel.text || "" : "",
        languageId: languageId,
        params: resolvedParams,
        document: documentModel,
        renderedResult: input && input.renderedResult,
        context: {
          suggestedFileName: documentModel && documentModel.fileName,
          runtime: this.runtime
        }
      });
    }
  }

  global.ExportManager = ExportManager;
})(window);
