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
  global.EditorPlugins.push(global.EditorPluginContracts.fromLegacy({
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
        languageId: "text.mermaid",
        mimeType: "text/x-mermaid",
        text: [
          "flowchart TD",
          "  A[Start] --> B{Validate}",
          "  B -->|Yes| C[Render Preview]",
          "  B -->|No| D[Show Error]"
        ].join("\n")
      };
    },
    languages: ["text.mermaid"],
    contributes: {
      pipelines: [
        {
          id: "view-mermaid-as-svg",
          name: "View as SVG",
          inputLanguage: "text.mermaid",
          steps: [
            { use: "mermaid-to-svg", params: {} },
            { use: "svg-preview", params: {} }
          ]
        },
        {
          id: "export-mermaid-as-svg",
          name: "Export as SVG",
          inputLanguage: "text.mermaid",
          steps: [
            { use: "mermaid-to-svg", params: {} },
            { use: "svg-sanitized-export", params: {} }
          ]
        },
        {
          id: "export-mermaid-as-png",
          name: "Export as PNG",
          inputLanguage: "text.mermaid",
          steps: [
            { use: "mermaid-to-svg", params: {} },
            { use: "svg-png-export", params: {} }
          ]
        }
      ]
    },
    languageDefinitions: [
      {
        id: "text.mermaid",
        label: "Mermaid",
        aliases: ["mermaid"],
        extensions: ["mmd", "mermaid"],
        mimeTypes: ["text/x-mermaid"]
      }
    ],
    highlighters: [],
    linters: [],
    transformers: [
      {
        id: "mermaid-to-svg",
        name: "Mermaid to SVG",
        inputLanguages: ["text.mermaid"],
        outputLanguage: "xml.svg",
        visibility: "internal",
        transform: async function (documentModel, context) {
          return {
            text: await renderMermaid(documentModel, context),
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
