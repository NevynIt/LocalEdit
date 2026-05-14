(function (global) {
  "use strict";

  class RenderSession {
    constructor(windowRef, rendererId, pluginPaths, pluginLoadSpecs) {
      this.windowRef = windowRef;
      this.rendererId = rendererId;
      this.pluginPaths = Array.isArray(pluginPaths) ? pluginPaths.slice() : [];
      this.pluginLoadSpecs = Array.isArray(pluginLoadSpecs) ? pluginLoadSpecs.slice() : [];
    }

    send(documentModel) {
      var message = {
        type: "render",
        rendererId: this.rendererId,
        document: documentModel,
        pluginPaths: this.pluginPaths,
        pluginLoadSpecs: this.pluginLoadSpecs
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
