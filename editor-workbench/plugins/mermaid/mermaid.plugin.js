(function (global) {
  "use strict";

  var RUNTIME_PATHS = [
    "plugins/shared/sanitize/sanitize.bundle.js",
    "plugins/mermaid/runtime/mermaid.bundle.js"
  ];

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireMermaidTools() {
    if (!global.EditorWorkbenchMermaid || typeof global.EditorWorkbenchMermaid.renderMermaidSvg !== "function") {
      throw new Error("Mermaid runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchMermaid;
  }

  function svgFileName(sourceName) {
    var baseName = sourceName || "untitled.mmd";
    return baseName.replace(/\.[^.]+$/, "") + ".svg";
  }

  async function renderMermaid(documentModel, context) {
    await requireRuntime(context).ensureScripts(RUNTIME_PATHS);
    return requireMermaidTools().renderMermaidSvg(documentModel.text || "");
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "mermaid-core",
    name: "Mermaid",
    version: "0.1.0",
    description: "Mermaid language support with sanitized SVG preview and export.",
    documentationUrl: "https://mermaid.js.org/intro/",
    allowedAttributeUrls: [
      "http://www.w3.org/2000/svg",
      "http://www.w3.org/1999/xlink"
    ],
    getExampleDocument: function () {
      return {
        fileName: "example.mmd",
        languageId: "mermaid",
        mimeType: "text/x-mermaid",
        text: [
          "flowchart TD",
          "  A[Start] --> B{Validate}",
          "  B -->|Yes| C[Render Preview]",
          "  B -->|No| D[Show Error]"
        ].join("\n")
      };
    },
    languages: ["mermaid"],
    languageDefinitions: [
      {
        id: "mermaid",
        label: "Mermaid",
        extensions: ["mmd", "mermaid"],
        mimeTypes: ["text/x-mermaid"]
      }
    ],
    highlighters: [],
    linters: [],
    transformers: [],
    renderers: [
      {
        id: "mermaid-svg-preview",
        name: "Mermaid SVG Preview",
        inputLanguages: ["mermaid"],
        outputKind: "svg",
        render: async function (documentModel, context) {
          return {
            kind: "svg",
            content: await renderMermaid(documentModel, context),
            mimeType: "image/svg+xml"
          };
        }
      }
    ],
    exporters: [
      {
        id: "mermaid-svg-export",
        name: "Mermaid SVG",
        languages: ["mermaid"],
        inputKinds: ["source"],
        outputFileExtension: "svg",
        mimeType: "image/svg+xml",
        export: async function (input, context) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "", fileName: "untitled.mmd" };
          return {
            fileName: svgFileName(sourceDocument.fileName),
            mimeType: "image/svg+xml",
            content: await renderMermaid(sourceDocument, context)
          };
        }
      }
    ]
  });
})(window);
