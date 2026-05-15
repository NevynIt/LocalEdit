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
        languageId: "text.graphviz-dot",
        mimeType: "text/vnd.graphviz",
        text: [
          "digraph Example {",
          "  rankdir=LR;",
          "  Start -> Review -> Done;",
          "}"
        ].join("\n")
      };
    },
    languages: ["text.graphviz-dot"],
    contributes: {
      pipelines: [
        {
          id: "view-graphviz-as-svg",
          name: "View as SVG",
          inputLanguage: "text.graphviz-dot",
          steps: [
            { use: "graphviz-to-svg", params: {} },
            { use: "svg-preview", params: {} }
          ]
        },
        {
          id: "export-graphviz-as-svg",
          name: "Export as SVG",
          inputLanguage: "text.graphviz-dot",
          steps: [
            { use: "graphviz-to-svg", params: {} },
            { use: "svg-sanitized-export", params: {} }
          ]
        },
        {
          id: "export-graphviz-as-png",
          name: "Export as PNG",
          inputLanguage: "text.graphviz-dot",
          steps: [
            { use: "graphviz-to-svg", params: {} },
            { use: "svg-png-export", params: {} }
          ]
        }
      ]
    },
    languageDefinitions: [
      {
        id: "text.graphviz-dot",
        label: "Graphviz DOT",
        parent: "text",
        aliases: ["graphviz.dot", "graphviz"],
        extensions: ["dot", "gv"],
        mimeTypes: ["text/vnd.graphviz"]
      }
    ],
    highlighters: [
      {
        id: "graphviz-codemirror",
        name: "DOT syntax",
        languages: ["text.graphviz-dot"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().dot()];
        }
      }
    ],
    linters: [],
    transformers: [
      {
        id: "graphviz-to-svg",
        name: "Graphviz to SVG",
        inputLanguages: ["text.graphviz-dot"],
        outputLanguage: "xml.svg",
        visibility: "internal",
        transform: async function (documentModel, context) {
          return {
            text: await renderGraphviz(documentModel, context),
            languageId: "xml.svg",
            fileName: svgFileName(documentModel.fileName)
          };
        }
      }
    ],
    renderers: [],
    exporters: []
  }));
})(window);
