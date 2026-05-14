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

  class DiagnosticsPanel {
    constructor(layout) {
      this.layout = layout;
      this.render([]);
    }

    render(diagnostics) {
      var root = this.layout.diagnosticsPanel;
      root.textContent = "";

      var header = el("div", "panel-header");
      header.appendChild(el("h2", "panel-title", "Diagnostics"));
      root.appendChild(header);

      var body = el("div", "panel-body");
      root.appendChild(body);

      if (!diagnostics || diagnostics.length === 0) {
        body.appendChild(el("p", "empty-state", "No diagnostics."));
        return;
      }

      diagnostics.forEach(function (diagnostic) {
        body.appendChild(renderDiagnostic(diagnostic));
      });
    }
  }

  function renderDiagnostic(diagnostic) {
    var wrapper = el("section", "diagnostic-item");
    var titleRow = el("div", "diagnostic-title-row");
    titleRow.appendChild(el("span", "status-chip severity-" + diagnostic.severity, diagnostic.severity));
    titleRow.appendChild(el("strong", "", diagnostic.source || "Linter"));
    wrapper.appendChild(titleRow);
    wrapper.appendChild(el("div", "", diagnostic.message || ""));
    wrapper.appendChild(el("div", "meta-value", "Range: " + diagnostic.from + " to " + diagnostic.to));
    return wrapper;
  }

  global.DiagnosticsPanel = DiagnosticsPanel;
})(window);

