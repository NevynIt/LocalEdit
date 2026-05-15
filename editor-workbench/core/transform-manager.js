(function (global) {
  "use strict";

  class TransformManager {
    constructor(registry, runtime) {
      this.registry = registry;
      this.runtime = runtime;
    }

    list(languageId) {
      return this.registry.getTransformers(languageId);
    }

    async run(transformerId, documentModel, params) {
      var transformer = this.registry.getContribution("transformer", transformerId);
      if (!transformer) {
        throw new Error("Transformer was not found.");
      }

      var resolvedParams = global.ParameterSchema
        ? global.ParameterSchema.applyDefaults(transformer.parameters, params || {}, transformer.id)
        : Object.assign({}, params || {});

      return transformer.transform({
        text: documentModel.text || "",
        languageId: documentModel.languageId,
        params: resolvedParams,
        document: documentModel,
        context: {
          languageId: documentModel.languageId,
          runtime: this.runtime
        }
      });
    }
  }

  global.TransformManager = TransformManager;
})(window);
