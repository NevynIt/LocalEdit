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
    constructor(layout, options) {
      this.layout = layout;
      this.options = options || {};
      this.render([]);
    }

    render(diagnostics, documentModel) {
      var root = this.layout.diagnosticsPanel;
      var sourceText = documentModel && typeof documentModel.text === "string" ? documentModel.text : "";
      root.textContent = "";

      var header = el("div", "panel-header");
      header.appendChild(el("h2", "panel-title", "Diagnostics"));
      header.appendChild(createCloseButton(this.options.onClose));
      root.appendChild(header);

      var body = el("div", "panel-body");
      root.appendChild(body);

      if (!diagnostics || diagnostics.length === 0) {
        body.appendChild(el("p", "empty-state", "No diagnostics."));
        return;
      }

      var onSelectDiagnostic = this.options.onSelectDiagnostic;
      diagnostics.forEach(function (diagnostic) {
        body.appendChild(renderDiagnostic(diagnostic, sourceText, onSelectDiagnostic));
      });
    }
  }

  function createCloseButton(onClose) {
    var button = el("button", "panel-close-button", "X");
    button.type = "button";
    button.title = "Close diagnostics";
    button.setAttribute("aria-label", "Close diagnostics");
    button.addEventListener("click", function () {
      if (typeof onClose === "function") {
        onClose();
      }
    });
    return button;
  }

  function numericOffset(value) {
    var offset = Number(value);
    return Number.isFinite(offset) && offset >= 0 ? offset : 0;
  }

  function offsetToLineColumn(text, offset) {
    var source = text || "";
    var position = Math.max(0, Math.min(numericOffset(offset), source.length));
    var line = 1;
    var column = 1;
    for (var index = 0; index < position; index += 1) {
      if (source[index] === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    return {
      line: line,
      column: column
    };
  }

  function formatLocation(diagnostic, sourceText) {
    var start = diagnostic && diagnostic.range && diagnostic.range.start;
    var location = start && Number.isFinite(start.line) && Number.isFinite(start.column)
      ? start
      : offsetToLineColumn(sourceText, diagnostic && diagnostic.from);
    return "Line " + location.line + ", column " + location.column;
  }

  function renderDiagnostic(diagnostic, sourceText, onSelectDiagnostic) {
    var wrapper = el("section", "diagnostic-item");
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "button");
    wrapper.title = "Go to diagnostic location";
    var titleRow = el("div", "diagnostic-title-row");
    titleRow.appendChild(el("span", "status-chip severity-" + diagnostic.severity, diagnostic.severity));
    titleRow.appendChild(el("strong", "", diagnostic.source || "Linter"));
    wrapper.appendChild(titleRow);
    wrapper.appendChild(el("div", "", diagnostic.message || ""));
    wrapper.appendChild(el("div", "meta-value diagnostic-location", formatLocation(diagnostic, sourceText)));
    wrapper.addEventListener("click", function () {
      if (typeof onSelectDiagnostic === "function") {
        onSelectDiagnostic(diagnostic);
      }
    });
    wrapper.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (typeof onSelectDiagnostic === "function") {
          onSelectDiagnostic(diagnostic);
        }
      }
    });
    return wrapper;
  }

  global.DiagnosticsPanel = DiagnosticsPanel;
})(window);
