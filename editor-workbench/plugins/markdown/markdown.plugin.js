(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    sanitize: "plugins/shared/sanitize/sanitize.bundle.js",
    markdown: "plugins/markdown/runtime/markdown.bundle.js",
    codeMirror: "plugins/markdown/runtime/codemirror-markdown.bundle.js",
    mermaid: "plugins/mermaid/runtime/mermaid.bundle.js",
    graphviz: "plugins/graphviz/runtime/graphviz.bundle.js"
  };

  var MARKDOWN_PREVIEW_STYLE = [
    "<style>",
    ".diagram { max-width: 100%; overflow: auto; margin: 12px 0; }",
    ".diagram svg { max-width: 100%; height: auto; }",
    ".diagram-error { border: 1px solid #f5b5ae; border-radius: 6px; background: #fff5f4; color: #b42318; padding: 10px; }",
    "</style>"
  ].join("\n");

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireMarkdownTools() {
    if (!global.EditorWorkbenchMarkdown || typeof global.EditorWorkbenchMarkdown.renderMarkdown !== "function") {
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

  function hasMermaidFence(source) {
    return /(^|\n)```(?:mermaid|mmd)(?:[^\n]*)\n/i.test(source || "");
  }

  function hasGraphvizFence(source) {
    return /(^|\n)```(?:dot|gv|graphviz)(?:[^\n]*)\n/i.test(source || "");
  }

  async function ensureMarkdownRuntime(context, text) {
    var scripts = [RUNTIME_PATHS.sanitize, RUNTIME_PATHS.markdown];
    if (hasMermaidFence(text)) {
      scripts.push(RUNTIME_PATHS.mermaid);
    }
    if (hasGraphvizFence(text)) {
      scripts.push(RUNTIME_PATHS.graphviz);
    }
    await requireRuntime(context).ensureScripts(scripts);
  }

  async function renderMarkdownHtml(documentModel, context) {
    await ensureMarkdownRuntime(context, documentModel.text || "");
    return MARKDOWN_PREVIEW_STYLE + "\n" + await requireMarkdownTools().renderMarkdown(documentModel.text || "");
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
    documentationUrl: "https://www.markdownguide.org/basic-syntax/",
    getExampleDocument: function () {
      return {
        fileName: "example.md",
        languageId: "markdown",
        mimeType: "text/markdown",
        text: [
          "# Example Markdown",
          "",
          "This is **Markdown** with a short checklist and a Mermaid diagram.",
          "",
          "- Review the plugin manager",
          "- Load an example file",
          "",
          "```mermaid",
          "flowchart TD",
          "  Start --> Review",
          "  Review --> Done",
          "```"
        ].join("\n")
      };
    },
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
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
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
        render: async function (documentModel, context) {
          return {
            kind: "html",
            content: await renderMarkdownHtml(documentModel, context),
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
        export: async function (input, context) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "", fileName: "untitled.md" };
          var body = await renderMarkdownHtml(sourceDocument, context);
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
