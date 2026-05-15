(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    codeMirror: "plugins/json/runtime/codemirror-json.bundle.js",
    cytoscape: "plugins/mermaid/runtime/mermaid.bundle.js",
    viewer: "plugins/shared/cytoscape-viewer/cytoscape-viewer.js"
  };

  var DEFAULT_LAYOUT = {
    name: "breadthfirst",
    directed: true,
    animate: false,
    padding: 32,
    spacingFactor: 1.1
  };

  var DEFAULT_STYLE = [
    {
      selector: "node",
      style: {
        "background-color": "#dbeafe",
        "border-color": "#60a5fa",
        "border-width": 1,
        "color": "#0f172a",
        "font-family": "Arial, Helvetica, sans-serif",
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
      selector: "node[type]",
      style: {
        "background-color": "#dcfce7",
        "border-color": "#34d399"
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
    },
    {
      selector: "edge[kind = 'link']",
      style: {
        "line-color": "#f59e0b",
        "target-arrow-color": "#f59e0b",
        "line-style": "dashed"
      }
    },
    {
      selector: "edge[label]",
      style: {
        "color": "#475569",
        "font-size": 10,
        "label": "data(label)",
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.8,
        "text-background-padding": 2,
        "text-rotation": "autorotate"
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
    if (typeof global.EditorWorkbenchMermaid.cytoscape === "function") {
      return global.EditorWorkbenchMermaid.cytoscape;
    }
    if (typeof global.EditorWorkbenchMermaid.getCytoscape === "function") {
      return global.EditorWorkbenchMermaid.getCytoscape();
    }
    throw new Error("Cytoscape runtime bundle is not loaded.");
  }

  function requireCytoscapeViewer() {
    if (!global.EditorWorkbenchCytoscapeViewer || typeof global.EditorWorkbenchCytoscapeViewer.mount !== "function") {
      throw new Error("Cytoscape viewer runtime is not loaded.");
    }
    return global.EditorWorkbenchCytoscapeViewer;
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
      source: "Cytoscape JSON"
    };
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function cloneElement(element) {
    if (!isPlainObject(element)) {
      return element;
    }
    return Object.assign({}, element, {
      data: isPlainObject(element.data) ? Object.assign({}, element.data) : element.data
    });
  }

  function normalizeElements(elements) {
    var nodes = [];
    var edges = [];

    function addElement(element) {
      if (!isPlainObject(element)) {
        return;
      }

      var copy = cloneElement(element);
      var data = isPlainObject(copy.data) ? copy.data : {};
      var isEdge = copy.group === "edges" || data.source != null || data.target != null;
      var isNode = copy.group === "nodes" || !isEdge;
      if (isEdge) {
        copy.group = "edges";
        edges.push(copy);
      } else if (isNode) {
        copy.group = "nodes";
        nodes.push(copy);
      }
    }

    if (Array.isArray(elements)) {
      elements.forEach(addElement);
    } else if (isPlainObject(elements)) {
      if (Array.isArray(elements.nodes)) {
        elements.nodes.forEach(function (element) {
          var copy = cloneElement(element);
          if (isPlainObject(copy)) {
            copy.group = "nodes";
          }
          addElement(copy);
        });
      }
      if (Array.isArray(elements.edges)) {
        elements.edges.forEach(function (element) {
          var copy = cloneElement(element);
          if (isPlainObject(copy)) {
            copy.group = "edges";
          }
          addElement(copy);
        });
      }
    }

    return {
      nodes: nodes,
      edges: edges
    };
  }

  function normalizeCytoscapeDocument(value) {
    var root = value;
    var elementsSource = value;
    var metadata = {};
    var layout = Object.assign({}, DEFAULT_LAYOUT);
    var style = [];

    if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, "elements")) {
      elementsSource = value.elements;
      metadata = isPlainObject(value.metadata) ? value.metadata : {};
      if (isPlainObject(value.layout)) {
        layout = Object.assign({}, DEFAULT_LAYOUT, value.layout);
      }
      if (Array.isArray(value.style)) {
        style = value.style;
      }
    }

    var elements = normalizeElements(elementsSource);
    var elementList = elements.nodes.concat(elements.edges);
    return {
      format: isPlainObject(root) && typeof root.format === "string" ? root.format : "cytoscape-js-document",
      version: isPlainObject(root) && typeof root.version === "string" ? root.version : "1.0",
      metadata: metadata,
      layout: layout,
      style: style,
      elements: elements,
      elementList: elementList,
      raw: root
    };
  }

  function normalizeForRender(documentModel) {
    return normalizeCytoscapeDocument(parseJson(documentModel.text || ""));
  }

  function addDiagnostic(diagnostics, severity, message, source) {
    diagnostics.push({
      from: 0,
      to: 1,
      severity: severity,
      message: message,
      source: source || "Cytoscape JSON"
    });
  }

  function lintCytoscape(documentModel) {
    var value;
    try {
      value = parseJson(documentModel.text || "");
    } catch (error) {
      return [diagnosticFromJsonError(error)];
    }

    var diagnostics = [];
    if (!Array.isArray(value) && !isPlainObject(value)) {
      addDiagnostic(diagnostics, "error", "Cytoscape JSON must be an element array or an object with an elements property.");
      return diagnostics;
    }

    if (isPlainObject(value)) {
      if (Object.prototype.hasOwnProperty.call(value, "layout") && !isPlainObject(value.layout)) {
        addDiagnostic(diagnostics, "error", "layout must be an object when provided.");
      }
      if (Object.prototype.hasOwnProperty.call(value, "style") && !Array.isArray(value.style)) {
        addDiagnostic(diagnostics, "error", "style must be an array when provided.");
      }
      if (Object.prototype.hasOwnProperty.call(value, "elements") && !Array.isArray(value.elements) && !isPlainObject(value.elements)) {
        addDiagnostic(diagnostics, "error", "elements must be an array or an object with nodes and edges arrays.");
      }
    }

    var documentGraph = normalizeCytoscapeDocument(value);
    if (documentGraph.elementList.length === 0) {
      addDiagnostic(diagnostics, "warning", "No Cytoscape elements were found.");
    }

    var nodeIds = new Set();
    var elementIds = new Set();
    documentGraph.elements.nodes.forEach(function (node, index) {
      var data = isPlainObject(node.data) ? node.data : {};
      var id = data.id == null ? "" : String(data.id);
      if (!id) {
        addDiagnostic(diagnostics, "error", "Node " + (index + 1) + " is missing data.id.");
        return;
      }
      if (nodeIds.has(id)) {
        addDiagnostic(diagnostics, "error", "Duplicate node id: " + id + ".");
      }
      nodeIds.add(id);
      if (elementIds.has(id)) {
        addDiagnostic(diagnostics, "error", "Duplicate element id: " + id + ".");
      }
      elementIds.add(id);
    });

    documentGraph.elements.edges.forEach(function (edge, index) {
      var data = isPlainObject(edge.data) ? edge.data : {};
      var id = data.id == null ? "" : String(data.id);
      var source = data.source == null ? "" : String(data.source);
      var target = data.target == null ? "" : String(data.target);

      if (!source || !target) {
        addDiagnostic(diagnostics, "error", "Edge " + (index + 1) + " is missing data.source or data.target.");
      }
      if (id) {
        if (elementIds.has(id)) {
          addDiagnostic(diagnostics, "error", "Duplicate element id: " + id + ".");
        }
        elementIds.add(id);
      }
      if (source && !nodeIds.has(source)) {
        addDiagnostic(diagnostics, "error", "Edge " + (id || index + 1) + " references missing source node " + source + ".");
      }
      if (target && !nodeIds.has(target)) {
        addDiagnostic(diagnostics, "error", "Edge " + (id || index + 1) + " references missing target node " + target + ".");
      }
    });

    return diagnostics;
  }

  function cytoscapeFileName(sourceName) {
    var baseName = sourceName || "untitled.cy.json";
    if (/\.(cy\.json|cytoscape\.json|cyjs)$/i.test(baseName)) {
      return baseName;
    }
    return baseName.replace(/\.[^.]+$/, "") + ".cy.json";
  }

  function formatJson(documentModel, compact) {
    var value = parseJson(documentModel.text || "");
    return {
      text: compact ? JSON.stringify(value) : JSON.stringify(value, null, 2),
      languageId: "json.cytoscape",
      fileName: cytoscapeFileName(documentModel.fileName),
      mode: "replace-current"
    };
  }

  async function renderCytoscape(documentModel, context) {
    var graph = normalizeForRender(documentModel);
    await requireRuntime(context).ensureScripts([RUNTIME_PATHS.cytoscape, RUNTIME_PATHS.viewer]);
    var cytoscapeFactory = requireCytoscapeTools();
    var viewer = requireCytoscapeViewer();
    return {
      kind: "custom",
      content: {
        mount: function (target) {
          return viewer.mount(target, cytoscapeFactory, graph, {
            style: graph.style && graph.style.length ? graph.style : DEFAULT_STYLE
          });
        }
      },
      mimeType: "application/x.editor-workbench.custom+cytoscape"
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push(global.EditorPluginContracts.fromLegacy({
    id: "cytoscape-core",
    name: "Cytoscape JSON",
    version: "0.1.0",
    description: "Cytoscape.js JSON editing, linting, graph preview, and formatting.",
    documentationUrl: "https://js.cytoscape.org/",
    getExampleDocument: function () {
      return {
        fileName: "example.cy.json",
        languageId: "json.cytoscape",
        mimeType: "application/vnd.cytoscape+json",
        text: JSON.stringify({
          format: "cytoscape-js-document",
          version: "1.0",
          metadata: {
            title: "Example graph"
          },
          layout: {
            name: "breadthfirst",
            directed: true
          },
          style: [],
          elements: {
            nodes: [
              { data: { id: "root", label: "Root" } },
              { data: { id: "child-a", label: "Child A" } },
              { data: { id: "child-b", label: "Child B" } }
            ],
            edges: [
              { data: { id: "root-child-a", source: "root", target: "child-a", kind: "hierarchy" } },
              { data: { id: "root-child-b", source: "root", target: "child-b", kind: "hierarchy" } }
            ]
          }
        }, null, 2)
      };
    },
    languages: ["json.cytoscape"],
    languageDefinitions: [
      {
        id: "json.cytoscape",
        label: "Cytoscape JSON",
        parent: "json",
        aliases: ["cytoscape"],
        extensions: ["cy.json", "cytoscape.json", "cyjs"],
        mimeTypes: ["application/vnd.cytoscape+json"]
      }
    ],
    highlighters: [
      {
        id: "cytoscape-json-codemirror",
        name: "Cytoscape JSON syntax",
        languages: ["json.cytoscape"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().json()];
        }
      }
    ],
    linters: [
      {
        id: "cytoscape-json-linter",
        name: "Cytoscape JSON shape",
        languages: ["json.cytoscape"],
        lint: lintCytoscape
      }
    ],
    transformers: [
      {
        id: "cytoscape-json-format",
        name: "Format Cytoscape JSON",
        inputLanguages: ["json.cytoscape"],
        outputLanguage: "json.cytoscape",
        transform: function (documentModel) {
          return formatJson(documentModel, false);
        }
      },
      {
        id: "cytoscape-json-compact",
        name: "Compact Cytoscape JSON",
        inputLanguages: ["json.cytoscape"],
        outputLanguage: "json.cytoscape",
        transform: function (documentModel) {
          return formatJson(documentModel, true);
        }
      }
    ],
    renderers: [
      {
        id: "cytoscape-graph-preview",
        name: "Cytoscape Graph Preview",
        inputLanguages: ["json.cytoscape"],
        outputKind: "custom",
        render: renderCytoscape
      }
    ],
    exporters: []
  }));
})(window);
