(function (global) {
  "use strict";

  class RenderSession {
    constructor(windowRef, rendererId, pluginPaths, pluginLoadSpecs, params, metadata) {
      this.windowRef = windowRef;
      this.rendererId = rendererId;
      this.pluginPaths = Array.isArray(pluginPaths) ? pluginPaths.slice() : [];
      this.pluginLoadSpecs = Array.isArray(pluginLoadSpecs) ? pluginLoadSpecs.slice() : [];
      this.params = Object.assign({}, params || {});
      this.metadata = Object.assign({}, metadata || {});
    }

    updateMetadata(metadata) {
      this.metadata = Object.assign({}, this.metadata || {}, metadata || {});
    }

    send(documentModel) {
      var message = {
        type: "render",
        rendererId: this.rendererId,
        document: documentModel,
        pluginPaths: this.pluginPaths,
        pluginLoadSpecs: this.pluginLoadSpecs,
        params: this.params,
        metadata: this.metadata
      };

      global.setTimeout(() => {
        if (this.windowRef && !this.windowRef.closed) {
          this.windowRef.postMessage(message, "*");
        }
      }, 250);
    }

    refresh(documentModel) {
      this.send(documentModel);
    }

    close() {
      if (this.windowRef && !this.windowRef.closed) {
        this.windowRef.close();
      }
    }

    isOpen() {
      return Boolean(this.windowRef && !this.windowRef.closed);
    }
  }

  global.RenderSession = RenderSession;
})(window);
