(function () {
  "use strict";

  window.EditorPlugins = window.EditorPlugins || [];
  window.EditorPlugins.push({
    id: "example-smoke",
    name: "Example Smoke Plugin",
    version: "0.1.0",
    description: "A tiny example plugin for testing plugin loading, rendering, and exporting.",
    getExampleDocument: function () {
      return {
        fileName: "example.txt",
        languageId: "plain-text",
        mimeType: "text/plain",
        text: "Example smoke plugin text.\n"
      };
    },
    languages: [],
    highlighters: [],
    linters: [],
    transformers: [],
    renderers: [
      {
        id: "example-smoke-text-renderer",
        name: "Example Text Preview",
        inputLanguages: [],
        outputKind: "text",
        render: function (documentModel) {
          return {
            kind: "text",
            content: "Example plugin preview\n\n" + (documentModel.text || ""),
            mimeType: "text/plain"
          };
        }
      }
    ],
    exporters: [
      {
        id: "example-smoke-text-export",
        name: "Example Text Export",
        languages: [],
        inputKinds: ["source"],
        outputFileExtension: "txt",
        mimeType: "text/plain",
        export: function (input) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "" };
          return {
            fileName: "example-plugin-output.txt",
            mimeType: "text/plain",
            content: "Example plugin export\n\n" + (sourceDocument.text || "")
          };
        }
      }
    ]
  });
})();

