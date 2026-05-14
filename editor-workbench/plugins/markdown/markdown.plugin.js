(function (global) {
  "use strict";

  function requireMarkdownTools() {
    if (!global.EditorWorkbenchMarkdown) {
      throw new Error("Markdown runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchMarkdown;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.markdown) {
      throw new Error("CodeMirror Markdown runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  async function renderMarkdownHtml(documentModel) {
    return requireMarkdownTools().renderMarkdown(documentModel.text || "");
  }

  function htmlFileName(sourceName) {
    var baseName = sourceName || "untitled.md";
    var withoutExtension = baseName.replace(/\.[^.]+$/, "");
    return withoutExtension + ".html";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wrapHtmlDocument(title, body) {
    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head>",
      "<meta charset=\"utf-8\">",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>" + escapeHtml(title || "Markdown Export") + "</title>",
      "</head>",
      "<body>",
      body,
      "</body>",
      "</html>"
    ].join("\n");
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "markdown-core",
    name: "Markdown",
    version: "0.1.0",
    description: "Markdown language support, sanitized HTML preview, and HTML export.",
    languages: ["markdown"],
    languageDefinitions: [
      {
        id: "markdown",
        label: "Markdown",
        extensions: ["md", "markdown", "mdown", "mkd"],
        mimeTypes: ["text/markdown"]
      }
    ],
    highlighters: [
      {
        id: "markdown-codemirror",
        name: "Markdown syntax",
        languages: ["markdown"],
        getCodeMirrorExtensions: function () {
          return [requireCodeMirrorTools().markdown()];
        }
      }
    ],
    linters: [],
    transformers: [],
    renderers: [
      {
        id: "markdown-html-preview",
        name: "Markdown HTML Preview",
        inputLanguages: ["markdown"],
        outputKind: "html",
        render: async function (documentModel) {
          return {
            kind: "html",
            content: await renderMarkdownHtml(documentModel),
            mimeType: "text/html"
          };
        }
      }
    ],
    exporters: [
      {
        id: "markdown-html-export",
        name: "Markdown HTML",
        languages: ["markdown"],
        inputKinds: ["source"],
        outputFileExtension: "html",
        mimeType: "text/html",
        export: async function (input) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "", fileName: "untitled.md" };
          var body = await renderMarkdownHtml(sourceDocument);
          return {
            fileName: htmlFileName(sourceDocument.fileName),
            mimeType: "text/html",
            content: wrapHtmlDocument(sourceDocument.fileName || "Markdown Export", body)
          };
        }
      }
    ]
  });
})(window);
