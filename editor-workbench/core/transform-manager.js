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

    async run(transformerId, documentModel) {
      var transformer = this.registry.getTransformer(transformerId, documentModel.languageId);
      if (!transformer) {
        throw new Error("Transformer was not found.");
      }

      return transformer.transform(documentModel, {
        languageId: documentModel.languageId,
        runtime: this.runtime
      });
    }
  }

  global.TransformManager = TransformManager;
})(window);
