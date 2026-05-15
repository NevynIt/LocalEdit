(function (global) {
  "use strict";

  function el(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  class DocumentTabs {
    constructor(layout, app) {
      this.layout = layout;
      this.app = app;
    }

    render(state) {
      var root = this.layout.documentTabs;
      if (!root) {
        return;
      }

      root.textContent = "";
      var records = state && Array.isArray(state.records) ? state.records : [];
      records.forEach((record) => {
        var tab = el("button", "document-tab", "");
        tab.type = "button";
        tab.classList.toggle("is-active", record.id === state.activeDocumentId);
        tab.title = [record.id, record.document.languageId, "v" + record.version].join(" | ");
        tab.addEventListener("click", () => {
          this.app.switchDocument(record.id);
        });

        var title = el("span", "document-tab-title", record.displayName || record.document.fileName || "untitled.txt");
        title.addEventListener("dblclick", (event) => {
          event.stopPropagation();
          this.app.renameDocument(record.id);
        });
        var close = el("span", "document-tab-close", "x");
        close.setAttribute("role", "button");
        close.setAttribute("aria-label", "Close document");
        close.addEventListener("click", (event) => {
          event.stopPropagation();
          this.app.closeDocument(record.id);
        });

        tab.appendChild(title);
        tab.appendChild(close);
        root.appendChild(tab);
      });
    }
  }

  global.DocumentTabs = DocumentTabs;
})(window);
