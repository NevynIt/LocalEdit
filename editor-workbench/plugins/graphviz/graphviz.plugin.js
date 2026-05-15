(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    sanitize: "plugins/shared/sanitize/sanitize.bundle.js",
    graphviz: "plugins/graphviz/runtime/graphviz.bundle.js",
    codeMirror: "plugins/graphviz/runtime/codemirror-dot.bundle.js"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireGraphvizTools() {
    if (!global.EditorWorkbenchGraphviz || typeof global.EditorWorkbenchGraphviz.renderGraphvizSvg !== "function") {
      throw new Error("Graphviz runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchGraphviz;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.dot) {
      throw new Error("CodeMirror DOT runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function svgFileName(sourceName) {
    var baseName = sourceName || "untitled.dot";
    return baseName.replace(/\.[^.]+$/, "") + ".svg";
  }

  async function renderGraphviz(documentModel, context) {
    await requireRuntime(context).ensureScripts([RUNTIME_PATHS.sanitize, RUNTIME_PATHS.graphviz]);
    return requireGraphvizTools().renderGraphvizSvg(documentModel.text || "");
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push(global.EditorPluginContracts.fromLegacy({
    id: "graphviz-core",
    name: "Graphviz",
    version: "0.1.0",
    description: "Graphviz DOT language support with sanitized SVG preview and export.",
    documentationUrl: "https://graphviz.org/documentation/",
    allowedAttributeUrls: [
      "http://www.w3.org/2000/svg",
      "http://www.w3.org/1999/xlink"
    ],
    getExampleDocument: function () {
      return {
        fileName: "example.dot",
        languageId: "graphviz.dot",
        mimeType: "text/vnd.graphviz",
        text: [
          "digraph Example {",
          "  rankdir=LR;",
          "  Start -> Review -> Done;",
          "}"
        ].join("\n")
      };
    },
    languages: ["graphviz.dot"],
    languageDefinitions: [
      {
        id: "graphviz.dot",
        label: "Graphviz DOT",
        parent: "text",
        aliases: ["graphviz"],
        extensions: ["dot", "gv"],
        mimeTypes: ["text/vnd.graphviz"]
      }
    ],
    highlighters: [
      {
        id: "graphviz-codemirror",
        name: "DOT syntax",
        languages: ["graphviz.dot"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().dot()];
        }
      }
    ],
    linters: [],
    transformers: [],
    renderers: [
      {
        id: "graphviz-svg-preview",
        name: "Graphviz SVG Preview",
        inputLanguages: ["graphviz.dot"],
        outputKind: "svg",
        render: async function (documentModel, context) {
          return {
            kind: "svg",
            content: await renderGraphviz(documentModel, context),
            mimeType: "image/svg+xml"
          };
        }
      }
    ],
    exporters: [
      {
        id: "graphviz-svg-export",
        name: "Graphviz SVG",
        languages: ["graphviz.dot"],
        inputKinds: ["source"],
        outputFileExtension: "svg",
        mimeType: "image/svg+xml",
        export: async function (input, context) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "", fileName: "untitled.dot" };
          return {
            fileName: svgFileName(sourceDocument.fileName),
            mimeType: "image/svg+xml",
            content: await renderGraphviz(sourceDocument, context)
          };
        }
      }
    ]
  }));
})(window);
