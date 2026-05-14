(function (global) {
  "use strict";

  class RenderSession {
    constructor(windowRef, rendererId, pluginPaths) {
      this.windowRef = windowRef;
      this.rendererId = rendererId;
      this.pluginPaths = Array.isArray(pluginPaths) ? pluginPaths.slice() : [];
    }

    send(documentModel) {
      var message = {
        type: "render",
        rendererId: this.rendererId,
        document: documentModel,
        pluginPaths: this.pluginPaths
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
  }

  global.RenderSession = RenderSession;
})(window);

