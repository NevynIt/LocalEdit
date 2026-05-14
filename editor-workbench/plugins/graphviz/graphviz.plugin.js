(function (global) {
  "use strict";

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

  async function renderGraphviz(documentModel) {
    return requireGraphvizTools().renderGraphvizSvg(documentModel.text || "");
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "graphviz-core",
    name: "Graphviz",
    version: "0.1.0",
    description: "Graphviz DOT language support with sanitized SVG preview and export.",
    languages: ["graphviz"],
    languageDefinitions: [
      {
        id: "graphviz",
        label: "Graphviz DOT",
        extensions: ["dot", "gv"],
        mimeTypes: ["text/vnd.graphviz"]
      }
    ],
    highlighters: [
      {
        id: "graphviz-codemirror",
        name: "DOT syntax",
        languages: ["graphviz"],
        getCodeMirrorExtensions: function () {
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
        inputLanguages: ["graphviz"],
        outputKind: "svg",
        render: async function (documentModel) {
          return {
            kind: "svg",
            content: await renderGraphviz(documentModel),
            mimeType: "image/svg+xml"
          };
        }
      }
    ],
    exporters: [
      {
        id: "graphviz-svg-export",
        name: "Graphviz SVG",
        languages: ["graphviz"],
        inputKinds: ["source"],
        outputFileExtension: "svg",
        mimeType: "image/svg+xml",
        export: async function (input) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "", fileName: "untitled.dot" };
          return {
            fileName: svgFileName(sourceDocument.fileName),
            mimeType: "image/svg+xml",
            content: await renderGraphviz(sourceDocument)
          };
        }
      }
    ]
  });
})(window);
