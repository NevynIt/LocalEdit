(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    codeMirror: "plugins/xml/runtime/codemirror-xml.bundle.js",
    prettier: "plugins/xml/runtime/prettier-xml.bundle.js"
  };

  var TREE_PREVIEW_STYLE = [
    "<style>",
    ".tree-preview { display: grid; gap: 4px; font-family: Consolas, \"Courier New\", monospace; font-size: 13px; line-height: 1.45; }",
    ".tree-node summary { cursor: pointer; user-select: none; }",
    ".tree-children { margin-left: 18px; border-left: 1px solid var(--border, #cbd3df); padding-left: 10px; }",
    ".tree-leaf { display: flex; gap: 8px; margin-left: 18px; min-width: 0; }",
    ".tree-key { color: var(--accent-strong, #0b5f59); font-weight: 700; }",
    ".tree-meta { color: var(--muted, #5d6b7c); }",
    ".tree-value { overflow-wrap: anywhere; }",
    "</style>"
  ].join("\n");

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.xml) {
      throw new Error("CodeMirror XML runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function requirePrettierTools() {
    if (!global.EditorWorkbenchPrettierXml || typeof global.EditorWorkbenchPrettierXml.formatXml !== "function") {
      throw new Error("Prettier XML runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchPrettierXml;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseXml(text) {
    var source = text || "";
    var documentModel = new DOMParser().parseFromString(source, "application/xml");
    var parserError = documentModel.getElementsByTagName("parsererror")[0];
    if (parserError) {
      throw new Error((parserError.textContent || "XML parse error.").trim());
    }
    return documentModel;
  }

  function lintXml(documentModel) {
    try {
      parseXml(documentModel.text || "");
      return [];
    } catch (error) {
      return [{
        from: 0,
        to: 1,
        severity: "error",
        message: error && error.message ? error.message : String(error),
        source: "XML"
      }];
    }
  }

  function attributeSummary(node) {
    if (!node.attributes || node.attributes.length === 0) {
      return "";
    }

    return Array.from(node.attributes).map(function (attribute) {
      return attribute.name + "=\"" + attribute.value + "\"";
    }).join(" ");
  }

  function renderNode(node) {
    if (node.nodeType === Node.DOCUMENT_NODE) {
      return Array.from(node.childNodes).map(renderNode).join("");
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      var attrs = attributeSummary(node);
      var label = "<" + node.nodeName + (attrs ? " " + attrs : "") + ">";
      var children = Array.from(node.childNodes).map(renderNode).join("");
      return [
        "<details open class=\"tree-node xml-node\">",
        "<summary><span class=\"tree-key\">" + escapeHtml(label) + "</span></summary>",
        "<div class=\"tree-children\">" + children + "</div>",
        "</details>"
      ].join("");
    }

    if (node.nodeType === Node.TEXT_NODE) {
      var text = node.nodeValue || "";
      if (!text.trim()) {
        return "";
      }
      return "<div class=\"tree-leaf\"><span class=\"tree-meta\">text</span><span class=\"tree-value\">" + escapeHtml(text.trim()) + "</span></div>";
    }

    if (node.nodeType === Node.CDATA_SECTION_NODE) {
      return "<div class=\"tree-leaf\"><span class=\"tree-meta\">CDATA</span><span class=\"tree-value\">" + escapeHtml(node.nodeValue || "") + "</span></div>";
    }

    if (node.nodeType === Node.COMMENT_NODE) {
      return "<div class=\"tree-leaf\"><span class=\"tree-meta\">comment</span><span class=\"tree-value\">" + escapeHtml(node.nodeValue || "") + "</span></div>";
    }

    if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
      return "<div class=\"tree-leaf\"><span class=\"tree-meta\">instruction</span><span class=\"tree-value\">" + escapeHtml(node.nodeName + " " + (node.nodeValue || "")) + "</span></div>";
    }

    return "";
  }

  function renderXmlTree(documentModel) {
    var parsed = parseXml(documentModel.text || "");
    return TREE_PREVIEW_STYLE + "<div class=\"tree-preview xml-tree\">" + renderNode(parsed) + "</div>";
  }

  function removeWhitespaceOnlyTextNodes(node) {
    Array.from(node.childNodes).forEach(function (child) {
      if (child.nodeType === Node.TEXT_NODE && !child.nodeValue.trim()) {
        node.removeChild(child);
        return;
      }

      removeWhitespaceOnlyTextNodes(child);
    });
  }

  function compactXml(documentModel) {
    var parsed = parseXml(documentModel.text || "");
    removeWhitespaceOnlyTextNodes(parsed);
    return {
      text: new XMLSerializer().serializeToString(parsed),
      languageId: "xml",
      fileName: documentModel.fileName,
      mode: "replace-current"
    };
  }

  async function formatXml(documentModel, context) {
    await requireRuntime(context).ensureScripts(RUNTIME_PATHS.prettier);
    return {
      text: await requirePrettierTools().formatXml(documentModel.text || ""),
      languageId: "xml",
      fileName: documentModel.fileName,
      mode: "replace-current"
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push(global.EditorPluginContracts.fromLegacy({
    id: "xml-core",
    name: "XML",
    version: "0.1.0",
    description: "XML syntax, linting, tree preview, and formatting.",
    documentationUrl: "https://developer.mozilla.org/docs/Web/XML",
    getExampleDocument: function () {
      return {
        fileName: "example.xml",
        languageId: "xml",
        mimeType: "application/xml",
        text: [
          "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
          "<catalog>",
          "  <book id=\"bk101\">",
          "    <title>XML Developer Guide</title>",
          "    <author>LocalEdit</author>",
          "  </book>",
          "</catalog>"
        ].join("\n")
      };
    },
    languages: ["xml"],
    languageDefinitions: [
      {
        id: "xml",
        label: "XML",
        extensions: ["xml", "xsd", "xsl", "rss", "atom"],
        mimeTypes: ["application/xml", "text/xml"]
      }
    ],
    highlighters: [
      {
        id: "xml-codemirror",
        name: "XML syntax",
        languages: ["xml"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().xml()];
        }
      }
    ],
    linters: [
      {
        id: "xml-parser-linter",
        name: "XML parser",
        languages: ["xml"],
        lint: lintXml
      }
    ],
    transformers: [
      {
        id: "xml-format",
        name: "Format XML",
        inputLanguages: ["xml"],
        transform: formatXml
      },
      {
        id: "xml-compact",
        name: "Compact XML",
        inputLanguages: ["xml"],
        transform: compactXml
      }
    ],
    renderers: [
      {
        id: "xml-tree-preview",
        name: "XML Tree Preview",
        inputLanguages: ["xml"],
        outputKind: "html",
        render: function (documentModel) {
          return {
            kind: "html",
            content: renderXmlTree(documentModel),
            mimeType: "text/html"
          };
        }
      }
    ],
    exporters: []
  }));
})(window);
