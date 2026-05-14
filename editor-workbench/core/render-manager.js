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

    open(rendererId, documentModel) {
      var renderer = this.registry.getRenderer(rendererId, documentModel.languageId);
      if (!renderer) {
        throw new Error("Renderer was not found.");
      }

      var windowRef = global.open(this.host.resolveAppUrl("render-shell.html"), "_blank");
      if (!windowRef) {
        throw new Error("Render window could not be opened.");
      }

      var session = new RenderSession(
        windowRef,
        rendererId,
        this.registry.getActivePluginPaths(),
        this.registry.getActivePluginLoadSpecs()
      );
      session.send(documentModel);
      return session;
    }
  }

  global.RenderManager = RenderManager;
})(window);
