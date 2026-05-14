(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    codeMirror: "plugins/json/runtime/codemirror-json.bundle.js"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.json) {
      throw new Error("CodeMirror JSON runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function diagnosticFromJsonError(error) {
    var message = error && error.message ? error.message : String(error);
    var match = /\bposition\s+(\d+)/i.exec(message);
    var position = match ? Number(match[1]) : 0;
    if (!Number.isFinite(position) || position < 0) {
      position = 0;
    }
    return {
      from: position,
      to: position + 1,
      severity: "error",
      message: message,
      source: "JSON"
    };
  }

  function describeValue(value) {
    if (Array.isArray(value)) {
      return "Array [" + value.length + "]";
    }
    if (value && typeof value === "object") {
      return "Object {" + Object.keys(value).length + "}";
    }
    if (value === null) {
      return "null";
    }
    return JSON.stringify(value);
  }

  function renderNode(label, value) {
    var safeLabel = escapeHtml(label);
    if (value && typeof value === "object") {
      var keys = Array.isArray(value) ? value.map(function (_, index) { return index; }) : Object.keys(value);
      var children = keys.map(function (key) {
        return renderNode(String(key), value[key]);
      }).join("");
      return [
        "<details open class=\"tree-node\">",
        "<summary><span class=\"tree-key\">" + safeLabel + "</span> <span class=\"tree-meta\">" + escapeHtml(describeValue(value)) + "</span></summary>",
        "<div class=\"tree-children\">" + children + "</div>",
        "</details>"
      ].join("");
    }

    return [
      "<div class=\"tree-leaf\">",
      "<span class=\"tree-key\">" + safeLabel + "</span>",
      "<span class=\"tree-value\">" + escapeHtml(describeValue(value)) + "</span>",
      "</div>"
    ].join("");
  }

  function renderJsonTree(documentModel) {
    var value = parseJson(documentModel.text || "");
    return "<div class=\"tree-preview json-tree\">" + renderNode("$", value) + "</div>";
  }

  function formatJson(documentModel, compact) {
    var value = parseJson(documentModel.text || "");
    return {
      text: compact ? JSON.stringify(value) : JSON.stringify(value, null, 2),
      languageId: "json",
      fileName: documentModel.fileName,
      mode: "replace-current"
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "json-core",
    name: "JSON",
    version: "0.1.0",
    description: "JSON syntax, linting, tree preview, and formatting.",
    languages: ["json"],
    languageDefinitions: [
      {
        id: "json",
        label: "JSON",
        extensions: ["json"],
        mimeTypes: ["application/json"]
      }
    ],
    highlighters: [
      {
        id: "json-codemirror",
        name: "JSON syntax",
        languages: ["json"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().json()];
        }
      }
    ],
    linters: [
      {
        id: "json-parse-linter",
        name: "JSON parser",
        languages: ["json"],
        lint: function (documentModel) {
          try {
            parseJson(documentModel.text || "");
            return [];
          } catch (error) {
            return [diagnosticFromJsonError(error)];
          }
        }
      }
    ],
    transformers: [
      {
        id: "json-format",
        name: "Format JSON",
        inputLanguages: ["json"],
        transform: function (documentModel) {
          return formatJson(documentModel, false);
        }
      },
      {
        id: "json-compact",
        name: "Compact JSON",
        inputLanguages: ["json"],
        transform: function (documentModel) {
          return formatJson(documentModel, true);
        }
      }
    ],
    renderers: [
      {
        id: "json-tree-preview",
        name: "JSON Tree Preview",
        inputLanguages: ["json"],
        outputKind: "html",
        render: function (documentModel) {
          return {
            kind: "html",
            content: renderJsonTree(documentModel),
            mimeType: "text/html"
          };
        }
      }
    ],
    exporters: []
  });
})(window);
