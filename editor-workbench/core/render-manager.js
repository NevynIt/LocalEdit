(function (global) {
  "use strict";

  class RenderManager {
    constructor(registry, host) {
      this.registry = registry;
      this.host = host;
    }

    list(languageId) {
      return this.registry.getRenderers(languageId);
    }

    open(rendererId, documentModel, params, metadata) {
      var renderer = this.registry.getContribution("renderer", rendererId);
      if (!renderer) {
        throw new Error("Renderer was not found.");
      }
      return this.openContribution(renderer, documentModel, params, metadata);
    }

    openContribution(renderer, documentModel, params, metadata) {
      var windowRef = global.open(this.host.resolveAppUrl("render-shell.html"), "_blank");
      if (!windowRef) {
        throw new Error("Render window could not be opened.");
      }

      var resolvedParams = global.ParameterSchema
        ? global.ParameterSchema.applyDefaults(renderer.parameters, params || {}, renderer.id)
        : Object.assign({}, params || {});

      var session = new RenderSession(
        windowRef,
        renderer.id,
        this.registry.getActivePluginPaths(),
        this.registry.getActivePluginLoadSpecs(),
        resolvedParams,
        metadata || {}
      );
      session.send(documentModel);
      return session;
    }
  }

  global.RenderManager = RenderManager;
})(window);
