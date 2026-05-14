(function (global) {
  "use strict";

  class TransformManager {
    constructor(registry) {
      this.registry = registry;
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
        languageId: documentModel.languageId
      });
    }
  }

  global.TransformManager = TransformManager;
})(window);

