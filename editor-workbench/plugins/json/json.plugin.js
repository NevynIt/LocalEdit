(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    codeMirror: "plugins/json/runtime/codemirror-json.bundle.js",
    cytoscape: "plugins/mermaid/runtime/mermaid.bundle.js",
    viewer: "plugins/shared/cytoscape-viewer/cytoscape-viewer.js"
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

  var JSON_CYTOSCAPE_STYLE = [
    {
      selector: "node",
      style: {
        "background-color": "#dbeafe",
        "border-color": "#60a5fa",
        "border-width": 1,
        "color": "#0f172a",
        "font-family": "Consolas, Courier New, monospace",
        "font-size": 11,
        "height": "label",
        "label": "data(label)",
        "padding": "10px",
        "shape": "round-rectangle",
        "text-halign": "center",
        "text-max-width": 180,
        "text-valign": "center",
        "text-wrap": "wrap",
        "width": "label"
      }
    },
    {
      selector: "node[kind = 'root']",
      style: {
        "background-color": "#c7d2fe",
        "border-color": "#6366f1",
        "font-weight": 700
      }
    },
    {
      selector: "node[kind = 'branch']",
      style: {
        "background-color": "#dcfce7",
        "border-color": "#34d399"
      }
    },
    {
      selector: "node[kind = 'leaf']",
      style: {
        "background-color": "#f8fafc",
        "border-color": "#cbd5e1"
      }
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "line-color": "#94a3b8",
        "opacity": 0.9,
        "target-arrow-color": "#94a3b8",
        "target-arrow-shape": "triangle",
        "width": 1.5
      }
    }
  ];

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.json) {
      throw new Error("CodeMirror JSON runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function requireCytoscapeTools() {
    if (!global.EditorWorkbenchMermaid) {
      throw new Error("Cytoscape runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchMermaid;
  }

  function resolveCytoscapeFactory() {
    var tools = requireCytoscapeTools();
    if (typeof tools.cytoscape === "function") {
      return tools.cytoscape;
    }
    if (typeof tools.getCytoscape === "function") {
      return tools.getCytoscape();
    }
    throw new Error("Cytoscape runtime bundle is not loaded.");
  }

  function requireCytoscapeViewer() {
    if (!global.EditorWorkbenchCytoscapeViewer || typeof global.EditorWorkbenchCytoscapeViewer.mount !== "function") {
      throw new Error("Cytoscape viewer runtime is not loaded.");
    }
    return global.EditorWorkbenchCytoscapeViewer;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function diagnosticFromJsonError(error) {
    var message = error && error.message ? error.message : String(error);
    var match = /\bposition\s+(\d+)/i.exec(message);
    var position = match ? Number(match[1]) : 0;
    if (!Number.isFinite(position) || position < 0) {
      position = 0;
    }
    return {
      from: position,
      to: position + 1,
      severity: "error",
      message: message,
      source: "JSON"
    };
  }

  function describeValue(value) {
    if (Array.isArray(value)) {
      return "Array [" + value.length + "]";
    }
    if (value && typeof value === "object") {
      return "Object {" + Object.keys(value).length + "}";
    }
    if (value === null) {
      return "null";
    }
    return JSON.stringify(value);
  }

  function valueKind(value) {
    if (Array.isArray(value)) {
      return "array";
    }
    if (value === null) {
      return "null";
    }
    return typeof value;
  }

  function truncateText(value, maxLength) {
    var text = String(value == null ? "" : value);
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, Math.max(0, maxLength - 1)) + "\u2026";
  }

  function createGraphLabel(label, value) {
    if (value && typeof value === "object") {
      return label + "\n" + describeValue(value);
    }
    return label + "\n" + truncateText(describeValue(value), 72);
  }

  function buildCytoscapeGraph(rootValue) {
    var elements = [];
    var nextId = 0;
    var stats = {
      nodes: 0,
      edges: 0,
      depth: 0
    };

    function visit(label, value, parentId, depth) {
      var nodeId = "json-node-" + nextId;
      nextId += 1;
      stats.nodes += 1;
      stats.depth = Math.max(stats.depth, depth);
      elements.push({
        data: {
          id: nodeId,
          label: createGraphLabel(label, value),
          kind: parentId ? (value && typeof value === "object" ? "branch" : "leaf") : "root",
          valueKind: valueKind(value)
        }
      });

      if (parentId) {
        stats.edges += 1;
        elements.push({
          data: {
            id: "json-edge-" + parentId + "-" + nodeId,
            source: parentId,
            target: nodeId
          }
        });
      }

      if (value && typeof value === "object") {
        var keys = Array.isArray(value)
          ? value.map(function (_, index) { return index; })
          : Object.keys(value);
        keys.forEach(function (key) {
          visit(String(key), value[key], nodeId, depth + 1);
        });
      }

      return nodeId;
    }

    return {
      elements: elements,
      rootId: visit("$", rootValue, "", 0),
      stats: stats
    };
  }

  function createSummaryText(graph) {
    return graph.stats.nodes + " nodes \u2022 " + graph.stats.edges + " edges \u2022 depth " + graph.stats.depth;
  }

  function renderNode(label, value) {
    var safeLabel = escapeHtml(label);
    if (value && typeof value === "object") {
      var keys = Array.isArray(value) ? value.map(function (_, index) { return index; }) : Object.keys(value);
      var children = keys.map(function (key) {
        return renderNode(String(key), value[key]);
      }).join("");
      return [
        "<details open class=\"tree-node\">",
        "<summary><span class=\"tree-key\">" + safeLabel + "</span> <span class=\"tree-meta\">" + escapeHtml(describeValue(value)) + "</span></summary>",
        "<div class=\"tree-children\">" + children + "</div>",
        "</details>"
      ].join("");
    }

    return [
      "<div class=\"tree-leaf\">",
      "<span class=\"tree-key\">" + safeLabel + "</span>",
      "<span class=\"tree-value\">" + escapeHtml(describeValue(value)) + "</span>",
      "</div>"
    ].join("");
  }

  function renderJsonTree(documentModel) {
    var value = parseJson(documentModel.text || "");
    return TREE_PREVIEW_STYLE + "<div class=\"tree-preview json-tree\">" + renderNode("$", value) + "</div>";
  }

  async function renderJsonCytoscapeTree(documentModel, context) {
    var value = parseJson(documentModel.text || "");
    var graph = buildCytoscapeGraph(value);
    await requireRuntime(context).ensureScripts([RUNTIME_PATHS.cytoscape, RUNTIME_PATHS.viewer]);
    var cytoscapeFactory = resolveCytoscapeFactory();
    var viewer = requireCytoscapeViewer();
    return {
      kind: "custom",
      content: {
        mount: function (target) {
          return viewer.mount(target, cytoscapeFactory, graph, {
            title: "JSON tree graph",
            summary: createSummaryText(graph),
            layout: {
              name: "breadthfirst",
              directed: true,
              animate: false,
              padding: 32,
              spacingFactor: 1.1
            },
            minZoom: 0.15,
            maxZoom: 3,
            style: JSON_CYTOSCAPE_STYLE
          });
        }
      },
      mimeType: "application/x.editor-workbench.custom+json-tree"
    };
  }

  function formatJson(documentModel, compact) {
    var value = parseJson(documentModel.text || "");
    return {
      text: compact ? JSON.stringify(value) : JSON.stringify(value, null, 2),
      languageId: documentModel.languageId || "text.json",
      fileName: documentModel.fileName,
      mode: "replace-current"
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push(global.EditorPluginContracts.fromLegacy({
    id: "json-core",
    name: "JSON",
    version: "0.1.0",
    description: "JSON syntax, linting, tree previews, and formatting.",
    documentationUrl: "https://www.json.org/json-en.html",
    getExampleDocument: function () {
      return {
        fileName: "example.json",
      languageId: "text.json",
        mimeType: "application/json",
        text: JSON.stringify({
          name: "LocalEdit",
          enabled: true,
          plugins: ["markdown", "json", "xml"],
          limits: {
            autoLoad: false,
            previewRows: 50
          }
        }, null, 2)
      };
    },
    languages: ["text.json"],
    languageDefinitions: [
      {
        id: "text.json",
        label: "JSON",
        aliases: ["json"],
        extensions: ["json"],
        mimeTypes: ["application/json"]
      }
    ],
    highlighters: [
      {
        id: "json-codemirror",
        name: "JSON syntax",
        languages: ["text.json"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().json()];
        }
      }
    ],
    linters: [
      {
        id: "json-parse-linter",
        name: "JSON parser",
        languages: ["text.json"],
        lint: function (documentModel) {
          try {
            parseJson(documentModel.text || "");
            return [];
          } catch (error) {
            return [diagnosticFromJsonError(error)];
          }
        }
      }
    ],
    transformers: [
      {
        id: "json-format",
        name: "Format JSON",
        inputLanguages: ["text.json"],
        outputLanguage: "text.json",
        transform: function (documentModel) {
          return formatJson(documentModel, false);
        }
      },
      {
        id: "json-compact",
        name: "Compact JSON",
        inputLanguages: ["text.json"],
        outputLanguage: "text.json",
        transform: function (documentModel) {
          return formatJson(documentModel, true);
        }
      }
    ],
    renderers: [],
    exporters: []
  }));
})(window);
