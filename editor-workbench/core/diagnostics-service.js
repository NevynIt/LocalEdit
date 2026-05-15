(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function positionFromOffset(text, offset) {
    var source = text || "";
    var safeOffset = Math.max(0, Math.min(Number.isFinite(offset) ? offset : 0, source.length));
    var line = 1;
    var column = 1;
    for (var index = 0; index < safeOffset; index += 1) {
      if (source[index] === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    return { line: line, column: column, offset: safeOffset };
  }

  function diagnosticKey(documentId, source) {
    return String(documentId || "active") + "::" + String(source || "unknown");
  }

  class DiagnosticsService {
    constructor(registry, runtime) {
      this.registry = registry;
      this.runtime = runtime;
      this.bySource = new Map();
      this.subscribers = [];
    }

    subscribe(callback) {
      this.subscribers.push(callback);
      return () => {
        this.subscribers = this.subscribers.filter(function (item) {
          return item !== callback;
        });
      };
    }

    emit() {
      var diagnostics = this.list();
      this.subscribers.forEach(function (callback) {
        callback(diagnostics);
      });
    }

    publish(source, diagnostics, documentModel, documentId) {
      var normalized = list(diagnostics).map((diagnostic) => {
        return this.normalize(diagnostic, source, documentModel, documentId);
      });
      this.bySource.set(diagnosticKey(documentId, source), normalized);
      this.emit();
      return normalized;
    }

    clear(documentId, source) {
      if (documentId && source) {
        this.bySource.delete(diagnosticKey(documentId, source));
      } else if (documentId) {
        var prefix = String(documentId) + "::";
        Array.from(this.bySource.keys()).forEach((key) => {
          if (key.indexOf(prefix) === 0) {
            this.bySource.delete(key);
          }
        });
      } else {
        this.bySource.clear();
      }
      this.emit();
    }

    list(documentId) {
      var diagnostics = [];
      this.bySource.forEach(function (items, key) {
        if (!documentId || key.indexOf(String(documentId) + "::") === 0) {
          diagnostics = diagnostics.concat(items);
        }
      });
      return diagnostics;
    }

    normalize(diagnostic, source, documentModel, documentId) {
      var item = diagnostic || {};
      var text = documentModel && documentModel.text || "";
      var range = item.range;
      if (!range && (Number.isFinite(item.from) || Number.isFinite(item.to))) {
        var from = Number.isFinite(item.from) ? item.from : 0;
        var to = Number.isFinite(item.to) ? item.to : from;
        range = {
          start: positionFromOffset(text, from),
          end: positionFromOffset(text, Math.max(from, to))
        };
      }
      if (!range) {
        range = {
          start: positionFromOffset(text, 0),
          end: positionFromOffset(text, 0)
        };
      }

      return {
        source: item.source || source || "unknown",
        severity: item.severity || "information",
        message: item.message || "",
        languageId: item.languageId || documentModel && documentModel.languageId || "text.plain",
        range: range,
        target: item.target || (documentId ? { documentId: documentId } : undefined),
        step: item.step || undefined
      };
    }

    async runLinters(documentModel, documentId) {
      var linters = this.registry.getLinters(documentModel.languageId);
      var diagnostics = [];
      this.clear(documentId);

      for (var index = 0; index < linters.length; index += 1) {
        var linter = linters[index];
        var source = linter.id;
        try {
          var result = await linter.lint({
            text: documentModel.text || "",
            languageId: documentModel.languageId,
            document: documentModel,
            context: {
              diagnostics: this,
              registry: this.registry,
              runtime: this.runtime
            }
          });
          diagnostics = diagnostics.concat(this.publish(source, result, documentModel, documentId));
        } catch (error) {
          diagnostics = diagnostics.concat(this.publish(source, [{
            severity: "warning",
            message: error && error.message ? error.message : String(error),
            languageId: documentModel.languageId
          }], documentModel, documentId));
        }
      }

      return diagnostics;
    }
  }

  global.DiagnosticsService = DiagnosticsService;
  global.DiagnosticsManager = DiagnosticsService;
})(window);
