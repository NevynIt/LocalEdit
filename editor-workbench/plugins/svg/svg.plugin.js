(function (global) {
  "use strict";

  function requireMarkdownTools() {
    if (!global.EditorWorkbenchMarkdown || typeof global.EditorWorkbenchMarkdown.sanitizeSvg !== "function") {
      throw new Error("SVG sanitizer is not loaded.");
    }
    return global.EditorWorkbenchMarkdown;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.html) {
      throw new Error("CodeMirror HTML runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function svgFileName(sourceName) {
    var baseName = sourceName || "untitled.svg";
    return baseName.replace(/\.[^.]+$/, "") + ".svg";
  }

  function sanitizeSvg(documentModel) {
    return requireMarkdownTools().sanitizeSvg(documentModel.text || "");
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "svg-core",
    name: "SVG",
    version: "0.1.0",
    description: "SVG language support with sanitized preview and export.",
    languages: ["svg"],
    languageDefinitions: [
      {
        id: "svg",
        label: "SVG",
        extensions: ["svg"],
        mimeTypes: ["image/svg+xml"]
      }
    ],
    highlighters: [
      {
        id: "svg-codemirror",
        name: "SVG syntax",
        languages: ["svg"],
        getCodeMirrorExtensions: function () {
          return [requireCodeMirrorTools().html({ selfClosingTags: true })];
        }
      }
    ],
    linters: [],
    transformers: [],
    renderers: [
      {
        id: "svg-preview",
        name: "SVG Preview",
        inputLanguages: ["svg"],
        outputKind: "svg",
        render: function (documentModel) {
          return {
            kind: "svg",
            content: sanitizeSvg(documentModel),
            mimeType: "image/svg+xml"
          };
        }
      }
    ],
    exporters: [
      {
        id: "svg-sanitized-export",
        name: "Sanitized SVG",
        languages: ["svg"],
        inputKinds: ["source"],
        outputFileExtension: "svg",
        mimeType: "image/svg+xml",
        export: function (input) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "", fileName: "untitled.svg" };
          return {
            fileName: svgFileName(sourceDocument.fileName),
            mimeType: "image/svg+xml",
            content: sanitizeSvg(sourceDocument)
          };
        }
      }
    ]
  });
})(window);
