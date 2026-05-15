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

    publish(source, diagnostics, documentModel) {
      var normalized = list(diagnostics).map((diagnostic) => {
        return this.normalize(diagnostic, source, documentModel);
      });
      this.bySource.set(source || "unknown", normalized);
      this.emit();
      return normalized;
    }

    clear(source) {
      if (source) {
        this.bySource.delete(source);
      } else {
        this.bySource.clear();
      }
      this.emit();
    }

    list() {
      var diagnostics = [];
      this.bySource.forEach(function (items) {
        diagnostics = diagnostics.concat(items);
      });
      return diagnostics;
    }

    normalize(diagnostic, source, documentModel) {
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
        languageId: item.languageId || documentModel && documentModel.languageId || "plain-text",
        range: range,
        target: item.target || undefined,
        step: item.step || undefined
      };
    }

    async runLinters(documentModel) {
      var linters = this.registry.getLinters(documentModel.languageId);
      var diagnostics = [];
      this.clear();

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
          diagnostics = diagnostics.concat(this.publish(source, result, documentModel));
        } catch (error) {
          diagnostics = diagnostics.concat(this.publish(source, [{
            severity: "warning",
            message: error && error.message ? error.message : String(error),
            languageId: documentModel.languageId
          }], documentModel));
        }
      }

      return diagnostics;
    }
  }

  global.DiagnosticsService = DiagnosticsService;
  global.DiagnosticsManager = DiagnosticsService;
})(window);
