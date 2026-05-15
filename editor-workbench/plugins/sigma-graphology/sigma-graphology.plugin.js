(function (global) {
  "use strict";

  var RUNTIME_PATH = "plugins/sigma-graphology/runtime/sigma-graphology.bundle.js";
  var STYLE_ID = "editor-workbench-sigma-graphology-style";
  var PALETTE = [
    "#2563eb",
    "#059669",
    "#d97706",
    "#dc2626",
    "#7c3aed",
    "#0891b2",
    "#be123c",
    "#4d7c0f",
    "#9333ea",
    "#0f766e",
    "#c2410c",
    "#1d4ed8"
  ];
  var DEFAULT_NODE_COLOR = "#2563eb";
  var DEFAULT_EDGE_COLOR = "#94a3b8";
  var MUTED_NODE_COLOR = "#cbd5e1";
  var MUTED_EDGE_COLOR = "#d8dee8";

  var VIEWER_STYLE = [
    ".sigma-graph-shell { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; height: calc(100vh - 32px); min-height: 0; color: #111827; }",
    ".sigma-graph-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; }",
    ".sigma-graph-title-group { min-width: 0; display: grid; gap: 2px; }",
    ".sigma-graph-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }",
    ".sigma-graph-summary { color: var(--muted, #5d6b7c); font-size: 12px; }",
    ".sigma-graph-toolbar { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 6px; }",
    ".sigma-graph-toolbar label { display: inline-flex; align-items: center; gap: 4px; color: #334155; font-size: 12px; }",
    ".sigma-graph-toolbar select, .sigma-graph-toolbar input[type='number'], .sigma-graph-search { min-height: 28px; border: 1px solid var(--border, #cbd3df); border-radius: 6px; background: #ffffff; color: #111827; font: inherit; font-size: 12px; }",
    ".sigma-graph-toolbar input[type='number'] { width: 72px; padding: 0 6px; }",
    ".sigma-graph-search { width: 190px; padding: 0 8px; }",
    ".sigma-graph-toolbar button, .sigma-graph-list button { min-height: 28px; border: 1px solid var(--border, #cbd3df); border-radius: 6px; background: #f8fafc; color: #111827; font: inherit; font-size: 12px; cursor: pointer; }",
    ".sigma-graph-toolbar button:hover, .sigma-graph-list button:hover { background: #eef2f7; }",
    ".sigma-graph-body { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 8px; min-height: 0; }",
    ".sigma-graph-viewport { position: relative; min-height: 0; overflow: hidden; border: 1px solid var(--border, #cbd3df); border-radius: 8px; background: #ffffff; }",
    ".sigma-graph-viewport.is-dragging { cursor: grabbing; }",
    ".sigma-graph-viewport canvas { outline: none; }",
    ".sigma-graph-side { min-height: 0; overflow: auto; border-left: 1px solid var(--border, #cbd3df); padding: 0 0 0 8px; display: grid; align-content: start; gap: 10px; }",
    ".sigma-graph-section { display: grid; gap: 6px; }",
    ".sigma-graph-section-title { color: #475569; font-size: 11px; font-weight: 700; letter-spacing: 0; text-transform: uppercase; }",
    ".sigma-graph-detail { display: grid; gap: 4px; font-size: 12px; }",
    ".sigma-graph-detail-row { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 8px; align-items: start; }",
    ".sigma-graph-detail-key { color: #64748b; }",
    ".sigma-graph-detail-value { overflow-wrap: anywhere; color: #111827; }",
    ".sigma-graph-list { display: grid; gap: 4px; }",
    ".sigma-graph-list button { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 4px 6px; text-align: left; }",
    ".sigma-graph-list-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".sigma-graph-list-meta { color: #64748b; font-size: 11px; }",
    ".sigma-graph-status { position: absolute; left: 10px; bottom: 10px; max-width: calc(100% - 20px); padding: 4px 8px; border: 1px solid #cbd3df; border-radius: 6px; background: rgba(248, 250, 252, 0.92); color: #334155; font-size: 12px; pointer-events: none; }",
    ".sigma-graph-empty { color: #64748b; font-size: 12px; }",
    ".sigma-graph-fallback-svg { display: block; width: 100%; height: 100%; min-height: 360px; }",
    ".sigma-graph-fallback-edge { stroke: #94a3b8; stroke-width: 1.4; opacity: 0.75; }",
    ".sigma-graph-fallback-edge.is-muted { stroke: #d8dee8; opacity: 0.45; }",
    ".sigma-graph-fallback-node { cursor: grab; stroke: #ffffff; stroke-width: 1.5; }",
    ".sigma-graph-fallback-node.is-muted { fill: #cbd5e1; }",
    ".sigma-graph-fallback-node.is-selected { stroke: #111827; stroke-width: 2.5; }",
    ".sigma-graph-fallback-label { fill: #111827; font: 11px Arial, Helvetica, sans-serif; pointer-events: none; paint-order: stroke; stroke: #ffffff; stroke-width: 3px; stroke-linejoin: round; }",
    "@media (max-width: 900px) { .sigma-graph-body { grid-template-columns: 1fr; grid-template-rows: minmax(360px, 1fr) auto; } .sigma-graph-side { max-height: 220px; border-left: 0; border-top: 1px solid var(--border, #cbd3df); padding: 8px 0 0 0; } .sigma-graph-header { grid-template-columns: 1fr; } .sigma-graph-toolbar { justify-content: flex-start; } }"
  ].join("\n");

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireTools() {
    if (!global.EditorWorkbenchSigmaGraphology) {
      throw new Error("Sigma/Graphology runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchSigmaGraphology;
  }

  function ensureStyles(documentRef) {
    if (documentRef.getElementById(STYLE_ID)) {
      return;
    }
    var style = documentRef.createElement("style");
    style.id = STYLE_ID;
    style.textContent = VIEWER_STYLE;
    (documentRef.head || documentRef.documentElement).appendChild(style);
  }

  function scalar(value) {
    if (value == null) {
      return "";
    }
    if (Array.isArray(value)) {
      return value.map(scalar).filter(Boolean).join(", ");
    }
    if (isPlainObject(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  function compactId(value, fallback) {
    var text = String(value == null ? "" : value).trim();
    if (!text) {
      text = fallback || "node";
    }
    return text;
  }

  function graphFileBase(input) {
    var sourceName = input && input.document && input.document.fileName || "graph";
    return String(sourceName || "graph")
      .replace(/\.(process|architecture|dependency|traceability)?\.?model-graph\.json$/i, "")
      .replace(/\.(tree|cy|cytoscape|jm|jsmind|openapi|table)\.json$/i, "")
      .replace(/\.(gexf|json|xml|yaml|yml|csv|tsv|dot|gv|mmd|mermaid|itt|opml|bpmn|archimate|js|py|txt)$/i, "") || "graph";
  }

  function addAttributes(target, attrs) {
    if (!isPlainObject(attrs)) {
      return target;
    }
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value != null && value !== "") {
        target[key] = scalar(value);
      }
    });
    return target;
  }

  function normalizeNode(rawNode, fallbackId) {
    var id = compactId(rawNode && rawNode.id, fallbackId);
    var attrs = {
      label: scalar(rawNode && (rawNode.label || rawNode.name || rawNode.topic || id)) || id,
      type: scalar(rawNode && rawNode.type),
      kind: scalar(rawNode && rawNode.kind),
      tags: scalar(rawNode && rawNode.tags),
      source: scalar(rawNode && rawNode.source)
    };
    addAttributes(attrs, rawNode && rawNode.attributes);
    return {
      id: id,
      attributes: attrs
    };
  }

  function normalizeEdge(rawEdge, fallbackId) {
    var attrs = {
      label: scalar(rawEdge && (rawEdge.label || rawEdge.name || rawEdge.type || rawEdge.kind)),
      type: scalar(rawEdge && rawEdge.type),
      kind: scalar(rawEdge && rawEdge.kind),
      weight: rawEdge && rawEdge.weight != null && Number.isFinite(Number(rawEdge.weight)) ? Number(rawEdge.weight) : 1
    };
    addAttributes(attrs, rawEdge && rawEdge.attributes);
    return {
      id: compactId(rawEdge && rawEdge.id, fallbackId),
      source: compactId(rawEdge && rawEdge.source, ""),
      target: compactId(rawEdge && rawEdge.target, ""),
      directed: rawEdge && rawEdge.directed === false ? false : true,
      attributes: attrs
    };
  }

  function modelGraphToRaw(value) {
    if (!value || value.format !== "json.model-graph") {
      throw new Error("Expected json.model-graph input.");
    }
    return {
      metadata: value.metadata || {},
      nodes: list(value.nodes).map(function (node, index) {
        return normalizeNode(node || {}, "node-" + (index + 1));
      }),
      edges: list(value.edges).map(function (edge, index) {
        return normalizeEdge(edge || {}, "edge-" + (index + 1));
      })
    };
  }

  function cytoscapeToRaw(value) {
    var source = value && Object.prototype.hasOwnProperty.call(value, "elements") ? value.elements : value;
    var nodes = [];
    var edges = [];

    function pushElement(element, index) {
      if (!isPlainObject(element)) {
        return;
      }
      var data = isPlainObject(element.data) ? element.data : element;
      var isEdge = element.group === "edges" || data.source != null || data.target != null;
      if (isEdge) {
        edges.push(normalizeEdge({
          id: data.id,
          source: data.source,
          target: data.target,
          label: data.label || data.name,
          type: data.type,
          kind: data.kind,
          weight: data.weight,
          attributes: data
        }, "edge-" + (edges.length + 1)));
        return;
      }
      nodes.push(normalizeNode({
        id: data.id,
        label: data.label || data.name,
        type: data.type,
        kind: data.kind,
        tags: data.tags,
        attributes: data
      }, "node-" + (index + 1)));
    }

    if (Array.isArray(source)) {
      source.forEach(pushElement);
    } else if (isPlainObject(source)) {
      list(source.nodes).forEach(pushElement);
      list(source.edges).forEach(pushElement);
    }

    return {
      metadata: isPlainObject(value) && isPlainObject(value.metadata) ? value.metadata : {},
      nodes: nodes,
      edges: edges
    };
  }

  function treeToRaw(value) {
    if (!value || value.format !== "json.tree" || !value.root) {
      throw new Error("Expected json.tree input.");
    }
    var nodes = [];
    var edges = [];
    function visit(node, parentId) {
      if (!node || !node.id) {
        return;
      }
      var nodeId = String(node.id);
      nodes.push(normalizeNode({
        id: nodeId,
        label: node.label || nodeId,
        type: node.kind || "node",
        attributes: {
          summary: node.summary || "",
          kind: node.kind || ""
        }
      }, nodeId));
      if (parentId) {
        edges.push(normalizeEdge({
          id: "tree-" + parentId + "-" + nodeId,
          source: parentId,
          target: nodeId,
          label: "contains",
          type: "contains",
          kind: "hierarchy"
        }, "edge-" + edges.length));
      }
      list(node.children).forEach(function (child) {
        visit(child, nodeId);
      });
    }
    visit(value.root, "");
    return {
      metadata: value.metadata || {},
      nodes: nodes,
      edges: edges
    };
  }

  function jsmindToRaw(value) {
    if (!value || value.format !== "node_tree" || !value.data) {
      throw new Error("Expected jsMind node_tree input.");
    }
    var nodes = [];
    var edges = [];
    function visit(node, parentId) {
      if (!node || !node.id) {
        return;
      }
      var nodeId = String(node.id);
      nodes.push(normalizeNode({
        id: nodeId,
        label: node.topic || nodeId,
        type: "mind-map-node",
        attributes: {
          direction: node.direction || "",
          expanded: node.expanded != null ? Boolean(node.expanded) : ""
        }
      }, nodeId));
      if (parentId) {
        edges.push(normalizeEdge({
          id: "mind-" + parentId + "-" + nodeId,
          source: parentId,
          target: nodeId,
          label: "contains",
          type: "contains",
          kind: "hierarchy"
        }, "edge-" + edges.length));
      }
      list(node.children).forEach(function (child) {
        visit(child, nodeId);
      });
    }
    visit(value.data, "");
    return {
      metadata: value.meta || {},
      nodes: nodes,
      edges: edges
    };
  }

  function uniqueEdgeKey(graph, base) {
    var key = compactId(base, "edge-" + (graph.size + 1));
    if (!graph.hasEdge(key)) {
      return key;
    }
    var index = 2;
    while (graph.hasEdge(key + "-" + index)) {
      index += 1;
    }
    return key + "-" + index;
  }

  function ensureGraphNode(graph, id, attrs) {
    if (!id) {
      return "";
    }
    if (graph.hasNode(id)) {
      if (attrs) {
        graph.mergeNodeAttributes(id, attrs);
      }
      return id;
    }
    graph.addNode(id, Object.assign({
      label: id,
      x: 0,
      y: 0,
      size: 5,
      color: DEFAULT_NODE_COLOR
    }, attrs || {}));
    return id;
  }

  function buildGraphologyGraph(tools, raw) {
    var graph = new tools.Graph({
      type: "mixed",
      multi: true,
      allowSelfLoops: true
    });
    list(raw.nodes).forEach(function (node, index) {
      var normalized = node && node.id ? node : normalizeNode(node || {}, "node-" + (index + 1));
      ensureGraphNode(graph, normalized.id, normalized.attributes || {});
    });
    list(raw.edges).forEach(function (edge, index) {
      var normalized = edge && edge.source ? edge : normalizeEdge(edge || {}, "edge-" + (index + 1));
      var source = ensureGraphNode(graph, normalized.source, { label: normalized.source, inferred: true });
      var target = ensureGraphNode(graph, normalized.target, { label: normalized.target, inferred: true });
      if (!source || !target) {
        return;
      }
      var key = uniqueEdgeKey(graph, normalized.id || "edge-" + (index + 1));
      var attrs = Object.assign({
        label: normalized.attributes && normalized.attributes.label || "",
        color: DEFAULT_EDGE_COLOR,
        size: Math.max(0.5, Math.min(6, Number(normalized.attributes && normalized.attributes.weight) || 1))
      }, normalized.attributes || {});
      if (normalized.directed === false) {
        graph.addUndirectedEdgeWithKey(key, source, target, attrs);
      } else {
        graph.addDirectedEdgeWithKey(key, source, target, attrs);
      }
    });
    graph.setAttribute("metadata", raw.metadata || {});
    return graph;
  }

  function graphFromGexf(tools, text) {
    var parsed = tools.gexf.parse(tools.Graph, text || "", {
      addMissingNodes: true,
      allowUndeclaredAttributes: true,
      respectInputGraphType: false
    });
    parsed.forEachNode(function (node, attr) {
      parsed.mergeNodeAttributes(node, {
        label: attr.label || node,
        size: Number(attr.size) || 5,
        color: attr.color || DEFAULT_NODE_COLOR,
        x: Number.isFinite(Number(attr.x)) ? Number(attr.x) : 0,
        y: Number.isFinite(Number(attr.y)) ? Number(attr.y) : 0
      });
    });
    parsed.forEachEdge(function (edge, attr) {
      parsed.mergeEdgeAttributes(edge, {
        label: attr.label || "",
        color: attr.color || DEFAULT_EDGE_COLOR,
        size: Number(attr.size) || Math.max(0.5, Math.min(6, Number(attr.weight) || 1))
      });
    });
    return parsed;
  }

  function parseGraphInput(input, tools) {
    if (input.languageId === "xml.gexf") {
      return graphFromGexf(tools, input.text || "");
    }
    var value = parseJson(input.text || "");
    if (input.languageId === "json.cytoscape") {
      return buildGraphologyGraph(tools, cytoscapeToRaw(value));
    }
    if (input.languageId === "json.tree") {
      return buildGraphologyGraph(tools, treeToRaw(value));
    }
    if (input.languageId === "json.jsmind") {
      return buildGraphologyGraph(tools, jsmindToRaw(value));
    }
    return buildGraphologyGraph(tools, modelGraphToRaw(value));
  }

  function extent(values) {
    var min = Infinity;
    var max = -Infinity;
    values.forEach(function (value) {
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [0, 1];
    }
    if (min === max) {
      return [min, min + 1];
    }
    return [min, max];
  }

  function scale(value, domain, minSize, maxSize) {
    if (!Number.isFinite(value)) {
      return minSize;
    }
    var ratio = (value - domain[0]) / (domain[1] - domain[0]);
    return minSize + Math.max(0, Math.min(1, ratio)) * (maxSize - minSize);
  }

  function paletteColor(value) {
    var text = String(value == null ? "" : value);
    var hash = 0;
    for (var index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) | 0;
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }

  function hasPositions(graph) {
    var positioned = 0;
    graph.forEachNode(function (node, attr) {
      if (Number.isFinite(Number(attr.x)) && Number.isFinite(Number(attr.y)) && (Number(attr.x) !== 0 || Number(attr.y) !== 0)) {
        positioned += 1;
      }
    });
    return positioned >= Math.max(1, Math.ceil(graph.order / 4));
  }

  function hasValidPositionsForAllNodes(graph) {
    var valid = true;
    graph.forEachNode(function (node, attr) {
      if (!Number.isFinite(Number(attr.x)) || !Number.isFinite(Number(attr.y))) {
        valid = false;
      }
    });
    return valid;
  }

  function assignCircularFallbackPositions(graph, overwrite) {
    var nodes = graph.nodes();
    var count = Math.max(1, nodes.length);
    var radius = Math.max(8, Math.sqrt(count) * 8);
    nodes.forEach(function (node, index) {
      var attr = graph.getNodeAttributes(node);
      if (!overwrite && Number.isFinite(Number(attr.x)) && Number.isFinite(Number(attr.y))) {
        graph.mergeNodeAttributes(node, {
          x: Number(attr.x),
          y: Number(attr.y)
        });
        return;
      }
      var angle = count === 1 ? 0 : (index / count) * Math.PI * 2;
      graph.mergeNodeAttributes(node, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    });
  }

  function ensureFinitePositions(graph) {
    if (graph.order === 0 || hasValidPositionsForAllNodes(graph)) {
      graph.forEachNode(function (node, attr) {
        graph.mergeNodeAttributes(node, {
          x: Number(attr.x) || 0,
          y: Number(attr.y) || 0
        });
      });
      return;
    }
    assignCircularFallbackPositions(graph, false);
  }

  function initializePositions(graph, tools) {
    if (graph.order === 0) {
      return;
    }
    ensureFinitePositions(graph);
    if (hasPositions(graph)) {
      return;
    }
    tools.layouts.circular.assign(graph, {
      scale: Math.max(4, Math.sqrt(Math.max(1, graph.order)) * 8),
      center: 0
    });
    ensureFinitePositions(graph);
  }

  function safePagerank(graph, tools) {
    try {
      return tools.metrics.pagerank(graph, {
        alpha: 0.85,
        maxIterations: 100,
        tolerance: 1e-6
      });
    } catch (error) {
      var values = {};
      graph.forEachNode(function (node) {
        values[node] = 0;
      });
      return values;
    }
  }

  function safeLouvain(graph, tools) {
    try {
      return tools.communities.louvain(graph);
    } catch (error) {
      var values = {};
      var index = 0;
      graph.forEachNode(function (node) {
        values[node] = index;
        index += 1;
      });
      return values;
    }
  }

  function refreshMetrics(graph, tools) {
    var pageranks = safePagerank(graph, tools);
    var communities = safeLouvain(graph, tools);
    graph.forEachNode(function (node) {
      graph.mergeNodeAttributes(node, {
        degree: graph.degree(node),
        inDegree: graph.inDegree(node),
        outDegree: graph.outDegree(node),
        pagerank: Number(pageranks[node]) || 0,
        community: communities[node]
      });
    });
  }

  function applyAppearance(graph, state) {
    var degreeValues = [];
    var pagerankValues = [];
    graph.forEachNode(function (node, attr) {
      degreeValues.push(Number(attr.degree) || 0);
      pagerankValues.push(Number(attr.pagerank) || 0);
    });
    var degreeDomain = extent(degreeValues);
    var pagerankDomain = extent(pagerankValues);
    graph.forEachNode(function (node, attr) {
      var sizeValue = state.sizeMetric === "pagerank" ? Number(attr.pagerank) || 0 : Number(attr.degree) || 0;
      var sizeDomain = state.sizeMetric === "pagerank" ? pagerankDomain : degreeDomain;
      var colorValue = state.colorMode === "community" ? attr.community : (state.colorMode === "type" ? attr.type || attr.kind : "");
      graph.mergeNodeAttributes(node, {
        size: state.sizeMetric === "fixed" ? 6 : scale(sizeValue, sizeDomain, 4, 18),
        color: state.colorMode === "none" ? DEFAULT_NODE_COLOR : paletteColor(colorValue || "default")
      });
    });
  }

  function runLayout(graph, tools, layoutName, iterations) {
    var count = Math.max(1, Math.min(1000, Number(iterations) || 100));
    if (layoutName === "random") {
      tools.layouts.random.assign(graph, {
        scale: Math.max(4, Math.sqrt(Math.max(1, graph.order)) * 10),
        center: 0
      });
      ensureFinitePositions(graph);
      return "Random layout applied.";
    }
    if (layoutName === "circular") {
      tools.layouts.circular.assign(graph, {
        scale: Math.max(4, Math.sqrt(Math.max(1, graph.order)) * 8),
        center: 0
      });
      ensureFinitePositions(graph);
      return "Circular layout applied.";
    }
    if (layoutName === "noverlap") {
      ensureFinitePositions(graph);
      tools.layouts.noverlap.assign(graph, {
        maxIterations: count,
        settings: {
          margin: 4,
          ratio: 1.2,
          expansion: 1.1
        }
      });
      ensureFinitePositions(graph);
      return "Noverlap layout applied.";
    }
    ensureFinitePositions(graph);
    tools.layouts.forceAtlas2.assign(graph, {
      iterations: count,
      settings: tools.layouts.forceAtlas2.inferSettings(graph)
    });
    ensureFinitePositions(graph);
    return "ForceAtlas2 layout applied.";
  }

  function topNodes(graph, metric, limit) {
    var rows = [];
    graph.forEachNode(function (node, attr) {
      rows.push({
        node: node,
        label: attr.label || node,
        value: metric === "pagerank" ? Number(attr.pagerank) || 0 : Number(attr.degree) || 0
      });
    });
    rows.sort(function (a, b) {
      return b.value - a.value || a.label.localeCompare(b.label);
    });
    return rows.slice(0, limit || 8);
  }

  function graphSummary(graph) {
    return graph.order + " nodes, " + graph.size + " edges";
  }

  function createDetailRow(documentRef, key, value) {
    var row = documentRef.createElement("div");
    row.className = "sigma-graph-detail-row";
    var keyElement = documentRef.createElement("span");
    keyElement.className = "sigma-graph-detail-key";
    keyElement.textContent = key;
    var valueElement = documentRef.createElement("span");
    valueElement.className = "sigma-graph-detail-value";
    valueElement.textContent = value == null || value === "" ? "-" : scalar(value);
    row.appendChild(keyElement);
    row.appendChild(valueElement);
    return row;
  }

  function downloadText(documentRef, fileName, mimeType, text) {
    var blob = new Blob([text || ""], { type: mimeType || "text/plain" });
    var url = global.URL.createObjectURL(blob);
    var link = documentRef.createElement("a");
    link.href = url;
    link.download = fileName || "graph.txt";
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    global.setTimeout(function () {
      global.URL.revokeObjectURL(url);
    }, 100);
  }

  function canCreateWebGLContext(documentRef) {
    try {
      var canvas = documentRef.createElement("canvas");
      var context = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (context && context.getExtension) {
        var loseContext = context.getExtension("WEBGL_lose_context");
        if (loseContext && loseContext.loseContext) {
          loseContext.loseContext();
        }
      }
      return Boolean(context);
    } catch (error) {
      return false;
    }
  }

  function isWebGLStartupError(error) {
    var message = error && error.message ? error.message : String(error || "");
    return /blendFunc|WebGL|webgl|getContext|context/i.test(message);
  }

  function mountExplorer(target, tools, graph, input, params) {
    var documentRef = target.ownerDocument;
    ensureStyles(documentRef);

    var state = {
      colorMode: params.colorMode || "community",
      sizeMetric: params.sizeMetric || "degree",
      labelMode: params.labels || "auto",
      edgeLabels: Boolean(params.edgeLabels),
      layout: params.layout || "forceatlas2",
      iterations: params.iterations || 120,
      selectedNode: "",
      selectedEdge: "",
      focusNeighbors: false,
      query: "",
      matches: new Set()
    };

    initializePositions(graph, tools);
    refreshMetrics(graph, tools);
    applyAppearance(graph, state);
    if (!hasPositions(graph)) {
      runLayout(graph, tools, state.layout, state.iterations);
    }

    var shell = documentRef.createElement("section");
    shell.className = "sigma-graph-shell";

    var header = documentRef.createElement("div");
    header.className = "sigma-graph-header";
    var titleGroup = documentRef.createElement("div");
    titleGroup.className = "sigma-graph-title-group";
    var title = documentRef.createElement("strong");
    title.className = "sigma-graph-title";
    title.textContent = input.document && input.document.fileName || "Graph Explorer";
    var summary = documentRef.createElement("span");
    summary.className = "sigma-graph-summary";
    summary.textContent = graphSummary(graph);
    titleGroup.appendChild(title);
    titleGroup.appendChild(summary);

    var toolbar = documentRef.createElement("div");
    toolbar.className = "sigma-graph-toolbar";

    function option(select, value, label) {
      var element = documentRef.createElement("option");
      element.value = value;
      element.textContent = label || value;
      select.appendChild(element);
    }

    function label(text, control) {
      var wrapper = documentRef.createElement("label");
      var span = documentRef.createElement("span");
      span.textContent = text;
      wrapper.appendChild(span);
      wrapper.appendChild(control);
      toolbar.appendChild(wrapper);
      return wrapper;
    }

    var layoutSelect = documentRef.createElement("select");
    option(layoutSelect, "forceatlas2", "ForceAtlas2");
    option(layoutSelect, "noverlap", "Noverlap");
    option(layoutSelect, "circular", "Circle");
    option(layoutSelect, "random", "Random");
    layoutSelect.value = state.layout;
    label("Layout", layoutSelect);

    var iterationsInput = documentRef.createElement("input");
    iterationsInput.type = "number";
    iterationsInput.min = "1";
    iterationsInput.max = "1000";
    iterationsInput.step = "10";
    iterationsInput.value = String(state.iterations);
    label("Iter", iterationsInput);

    var runButton = documentRef.createElement("button");
    runButton.type = "button";
    runButton.textContent = "Run";
    runButton.title = "Run selected layout";
    toolbar.appendChild(runButton);

    var colorSelect = documentRef.createElement("select");
    option(colorSelect, "community", "Community");
    option(colorSelect, "type", "Type");
    option(colorSelect, "none", "Single");
    colorSelect.value = state.colorMode;
    label("Color", colorSelect);

    var sizeSelect = documentRef.createElement("select");
    option(sizeSelect, "degree", "Degree");
    option(sizeSelect, "pagerank", "PageRank");
    option(sizeSelect, "fixed", "Fixed");
    sizeSelect.value = state.sizeMetric;
    label("Size", sizeSelect);

    var labelSelect = documentRef.createElement("select");
    option(labelSelect, "auto", "Auto");
    option(labelSelect, "all", "All");
    option(labelSelect, "none", "None");
    labelSelect.value = state.labelMode;
    label("Labels", labelSelect);

    var edgeLabelToggle = documentRef.createElement("input");
    edgeLabelToggle.type = "checkbox";
    edgeLabelToggle.checked = state.edgeLabels;
    label("Edge text", edgeLabelToggle);

    var searchInput = documentRef.createElement("input");
    searchInput.className = "sigma-graph-search";
    searchInput.type = "search";
    searchInput.placeholder = "Search nodes";
    toolbar.appendChild(searchInput);

    var focusButton = documentRef.createElement("button");
    focusButton.type = "button";
    focusButton.textContent = "Focus";
    focusButton.title = "Toggle selected node neighborhood focus";
    toolbar.appendChild(focusButton);

    var clearButton = documentRef.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "Clear";
    clearButton.title = "Clear selection and filters";
    toolbar.appendChild(clearButton);

    var fitButton = documentRef.createElement("button");
    fitButton.type = "button";
    fitButton.textContent = "Fit";
    fitButton.title = "Fit graph to view";
    toolbar.appendChild(fitButton);

    var resetButton = documentRef.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Reset";
    resetButton.title = "Reset camera";
    toolbar.appendChild(resetButton);

    var downloadButton = documentRef.createElement("button");
    downloadButton.type = "button";
    downloadButton.textContent = "GEXF";
    downloadButton.title = "Download current graph as GEXF";
    toolbar.appendChild(downloadButton);

    header.appendChild(titleGroup);
    header.appendChild(toolbar);

    var body = documentRef.createElement("div");
    body.className = "sigma-graph-body";
    var viewport = documentRef.createElement("div");
    viewport.className = "sigma-graph-viewport";
    var status = documentRef.createElement("div");
    status.className = "sigma-graph-status";
    status.textContent = "Ready.";
    viewport.appendChild(status);
    var side = documentRef.createElement("aside");
    side.className = "sigma-graph-side";

    body.appendChild(viewport);
    body.appendChild(side);
    shell.appendChild(header);
    shell.appendChild(body);
    target.appendChild(shell);

    function selectedNeighborhood() {
      var nodes = new Set();
      if (!state.selectedNode || !graph.hasNode(state.selectedNode)) {
        return nodes;
      }
      nodes.add(state.selectedNode);
      list(graph.neighbors(state.selectedNode)).forEach(function (node) {
        nodes.add(node);
      });
      return nodes;
    }

    function recomputeMatches() {
      var query = state.query.trim().toLowerCase();
      state.matches = new Set();
      if (!query) {
        return;
      }
      graph.forEachNode(function (node, attr) {
        var text = [node, attr.label, attr.type, attr.kind, attr.tags].join(" ").toLowerCase();
        if (text.indexOf(query) !== -1) {
          state.matches.add(node);
        }
      });
    }

    function nodeReducer(node, data) {
      var x = Number(data.x);
      var y = Number(data.y);
      var result = {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        label: state.labelMode === "none" ? "" : data.label,
        color: data.color,
        size: data.size,
        forceLabel: state.labelMode === "all" || node === state.selectedNode || state.matches.has(node),
        highlighted: node === state.selectedNode
      };
      if (state.focusNeighbors && state.selectedNode) {
        var neighborhood = selectedNeighborhood();
        if (!neighborhood.has(node)) {
          result.color = MUTED_NODE_COLOR;
          result.size = Math.max(2, Number(data.size) * 0.45);
        }
      } else if (state.matches.size && !state.matches.has(node)) {
        result.color = MUTED_NODE_COLOR;
        result.size = Math.max(2, Number(data.size) * 0.55);
      }
      return result;
    }

    function edgeReducer(edge, data) {
      var result = {
        label: state.edgeLabels ? data.label || "" : "",
        color: data.color || DEFAULT_EDGE_COLOR,
        size: data.size || 1
      };
      if (state.focusNeighbors && state.selectedNode) {
        var neighborhood = selectedNeighborhood();
        var source = graph.source(edge);
        var target = graph.target(edge);
        if (!neighborhood.has(source) || !neighborhood.has(target)) {
          result.hidden = true;
        }
      } else if (state.matches.size) {
        var matchSource = graph.source(edge);
        var matchTarget = graph.target(edge);
        if (!state.matches.has(matchSource) && !state.matches.has(matchTarget)) {
          result.color = MUTED_EDGE_COLOR;
          result.size = 0.5;
        }
      }
      return result;
    }

    var renderer = null;
    var renderFallback = null;
    var dragState = null;
    var fallbackDragSvg = null;
    var suppressClickUntil = 0;

    function shouldSuppressClick() {
      return Date.now() < suppressClickUntil;
    }

    function suppressNextClick() {
      suppressClickUntil = Date.now() + 250;
      global.setTimeout(function () {
        if (Date.now() >= suppressClickUntil) {
          suppressClickUntil = 0;
        }
      }, 300);
    }

    function preventPointerDefault(payload) {
      if (payload && typeof payload.preventSigmaDefault === "function") {
        payload.preventSigmaDefault();
      }
      var original = payload && payload.original || payload && payload.event && payload.event.original;
      if (!original && payload && typeof payload.preventDefault === "function") {
        original = payload;
      }
      if (original && typeof original.preventDefault === "function") {
        original.preventDefault();
      }
      if (original && typeof original.stopPropagation === "function") {
        original.stopPropagation();
      }
    }

    function graphPointFromEvent(event) {
      if (!renderer || !event) {
        return null;
      }
      var x = Number(event.x);
      var y = Number(event.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return renderer.viewportToGraph({ x: x, y: y });
    }

    function svgPointFromEvent(svg, event) {
      if (!svg || !event || typeof svg.createSVGPoint !== "function" || typeof svg.getScreenCTM !== "function") {
        return null;
      }
      var matrix = svg.getScreenCTM();
      if (!matrix) {
        return null;
      }
      var point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(matrix.inverse());
    }

    function isContainsEdge(attrs) {
      return ["label", "type", "kind", "relationship", "relationship_type", "relationshipType"].some(function (key) {
        return String(attrs && attrs[key] || "").trim().toLowerCase() === "contains";
      });
    }

    function collectOutgoingContainsNodes(root) {
      var nodes = new Set([root]);
      var stack = [root];
      while (stack.length) {
        var current = stack.pop();
        if (!graph.hasNode(current) || typeof graph.outEdges !== "function") {
          continue;
        }
        graph.outEdges(current).forEach(function (edge) {
          var attrs = graph.getEdgeAttributes(edge);
          if (!isContainsEdge(attrs)) {
            return;
          }
          var targetNode = graph.target(edge);
          if (!nodes.has(targetNode)) {
            nodes.add(targetNode);
            stack.push(targetNode);
          }
        });
      }
      return Array.from(nodes);
    }

    function beginNodeDrag(node, graphPoint, includeContains, pointerPayload) {
      if (!node || !graph.hasNode(node) || !graphPoint) {
        return;
      }
      var nodes = includeContains ? collectOutgoingContainsNodes(node) : [node];
      var origins = {};
      nodes.forEach(function (dragNode) {
        var attrs = graph.getNodeAttributes(dragNode);
        origins[dragNode] = {
          x: Number(attrs.x) || 0,
          y: Number(attrs.y) || 0
        };
      });
      dragState = {
        root: node,
        nodes: nodes,
        start: {
          x: Number(graphPoint.x) || 0,
          y: Number(graphPoint.y) || 0
        },
        origins: origins,
        moved: false,
        includeContains: Boolean(includeContains)
      };
      viewport.classList.add("is-dragging");
      state.selectedNode = node;
      state.selectedEdge = "";
      renderSidePanel();
      refreshRenderer();
      setStatus(includeContains && nodes.length > 1 ? "Dragging " + nodes.length + " contained nodes." : "Dragging node.");
      preventPointerDefault(pointerPayload);
    }

    function updateNodeDrag(graphPoint, pointerPayload) {
      if (!dragState || !graphPoint) {
        return;
      }
      var dx = (Number(graphPoint.x) || 0) - dragState.start.x;
      var dy = (Number(graphPoint.y) || 0) - dragState.start.y;
      if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
        dragState.moved = true;
      }
      dragState.nodes.forEach(function (node) {
        var origin = dragState.origins[node];
        if (!origin || !graph.hasNode(node)) {
          return;
        }
        graph.mergeNodeAttributes(node, {
          x: origin.x + dx,
          y: origin.y + dy
        });
      });
      refreshRenderer();
      preventPointerDefault(pointerPayload);
    }

    function endNodeDrag(pointerPayload) {
      if (!dragState) {
        return;
      }
      var movedCount = dragState.nodes.length;
      var didMove = dragState.moved;
      dragState = null;
      fallbackDragSvg = null;
      viewport.classList.remove("is-dragging");
      if (renderer) {
        renderer.getCamera().enable();
      }
      if (didMove) {
        suppressNextClick();
        refreshRenderer();
        setStatus("Moved " + movedCount + " node" + (movedCount === 1 ? "" : "s") + ".");
      }
      preventPointerDefault(pointerPayload);
    }

    function handleFallbackDragMove(event) {
      if (!dragState) {
        return;
      }
      var svg = viewport.querySelector(".sigma-graph-fallback-svg") || fallbackDragSvg;
      var point = svgPointFromEvent(svg, event);
      updateNodeDrag(point, event);
    }

    function handleFallbackDragEnd(event) {
      documentRef.removeEventListener("mousemove", handleFallbackDragMove);
      documentRef.removeEventListener("mouseup", handleFallbackDragEnd);
      endNodeDrag(event);
    }

    function startFallbackNodeDrag(node, svg, event) {
      fallbackDragSvg = svg;
      var point = svgPointFromEvent(svg, event);
      if (!point) {
        return;
      }
      beginNodeDrag(node, point, Boolean(event && event.shiftKey), event);
      if (dragState) {
        documentRef.addEventListener("mousemove", handleFallbackDragMove);
        documentRef.addEventListener("mouseup", handleFallbackDragEnd);
      }
    }

    function graphBounds() {
      var bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      };
      graph.forEachNode(function (node, attr) {
        var x = Number(attr.x);
        var y = Number(attr.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return;
        }
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
      });
      if (!Number.isFinite(bounds.minX) || bounds.minX === bounds.maxX) {
        bounds.minX = -10;
        bounds.maxX = 10;
      }
      if (!Number.isFinite(bounds.minY) || bounds.minY === bounds.maxY) {
        bounds.minY = -10;
        bounds.maxY = 10;
      }
      return bounds;
    }

    function shouldMuteFallbackNode(node) {
      if (state.focusNeighbors && state.selectedNode) {
        return !selectedNeighborhood().has(node);
      }
      return Boolean(state.matches.size && !state.matches.has(node));
    }

    function shouldHideFallbackEdge(edge) {
      if (!state.focusNeighbors || !state.selectedNode) {
        return false;
      }
      var neighborhood = selectedNeighborhood();
      return !neighborhood.has(graph.source(edge)) || !neighborhood.has(graph.target(edge));
    }

    function renderSvgFallback(message) {
      var previous = viewport.querySelector(".sigma-graph-fallback-svg");
      if (previous) {
        previous.remove();
      }

      var bounds = graphBounds();
      var padding = Math.max(12, Math.sqrt(Math.max(1, graph.order)) * 2);
      var minX = bounds.minX - padding;
      var minY = bounds.minY - padding;
      var width = Math.max(1, bounds.maxX - bounds.minX + padding * 2);
      var height = Math.max(1, bounds.maxY - bounds.minY + padding * 2);
      var namespace = "http://www.w3.org/2000/svg";
      var svg = documentRef.createElementNS(namespace, "svg");
      svg.classList.add("sigma-graph-fallback-svg");
      svg.setAttribute("viewBox", [minX, minY, width, height].join(" "));
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Graph fallback preview");

      graph.forEachEdge(function (edge, attr, source, target) {
        if (shouldHideFallbackEdge(edge)) {
          return;
        }
        var sourceAttrs = graph.getNodeAttributes(source);
        var targetAttrs = graph.getNodeAttributes(target);
        var line = documentRef.createElementNS(namespace, "line");
        line.classList.add("sigma-graph-fallback-edge");
        if (state.matches.size && !state.matches.has(source) && !state.matches.has(target)) {
          line.classList.add("is-muted");
        }
        line.setAttribute("x1", Number(sourceAttrs.x) || 0);
        line.setAttribute("y1", Number(sourceAttrs.y) || 0);
        line.setAttribute("x2", Number(targetAttrs.x) || 0);
        line.setAttribute("y2", Number(targetAttrs.y) || 0);
        svg.appendChild(line);
      });

      graph.forEachNode(function (node, attr) {
        var group = documentRef.createElementNS(namespace, "g");
        var circle = documentRef.createElementNS(namespace, "circle");
        var radius = Math.max(2.5, Math.min(12, Number(attr.size) || 5));
        circle.classList.add("sigma-graph-fallback-node");
        if (shouldMuteFallbackNode(node)) {
          circle.classList.add("is-muted");
        }
        if (state.selectedNode === node) {
          circle.classList.add("is-selected");
        }
        circle.setAttribute("cx", Number(attr.x) || 0);
        circle.setAttribute("cy", Number(attr.y) || 0);
        circle.setAttribute("r", radius);
        circle.setAttribute("fill", shouldMuteFallbackNode(node) ? MUTED_NODE_COLOR : attr.color || DEFAULT_NODE_COLOR);
        group.appendChild(circle);
        group.addEventListener("mousedown", function (event) {
          event.stopPropagation();
          event.preventDefault();
          startFallbackNodeDrag(node, svg, event);
        });
        group.addEventListener("click", function (event) {
          event.stopPropagation();
          if (shouldSuppressClick()) {
            return;
          }
          selectNode(node, false);
        });

        if (state.labelMode === "all" || state.selectedNode === node || state.matches.has(node)) {
          var text = documentRef.createElementNS(namespace, "text");
          text.classList.add("sigma-graph-fallback-label");
          text.setAttribute("x", (Number(attr.x) || 0) + radius + 2);
          text.setAttribute("y", (Number(attr.y) || 0) + 3);
          text.textContent = attr.label || node;
          group.appendChild(text);
        }
        svg.appendChild(group);
      });

      svg.addEventListener("click", function () {
        if (shouldSuppressClick()) {
          return;
        }
        state.selectedNode = "";
        state.selectedEdge = "";
        renderSidePanel();
        refreshRenderer();
      });
      viewport.insertBefore(svg, status);
      setStatus(message || "WebGL is unavailable; showing SVG fallback.");
    }

    function setStatus(message) {
      status.textContent = message || "";
    }

    function refreshRenderer() {
      if (!renderer) {
        if (typeof renderFallback === "function") {
          renderFallback();
        }
        return;
      }
      renderer.setSettings({
        renderLabels: state.labelMode !== "none",
        renderEdgeLabels: state.edgeLabels,
        labelRenderedSizeThreshold: state.labelMode === "all" ? 0 : 8,
        nodeReducer: nodeReducer,
        edgeReducer: edgeReducer
      });
      renderer.refresh();
    }

    function renderSidePanel() {
      side.textContent = "";
      var details = documentRef.createElement("section");
      details.className = "sigma-graph-section";
      var detailsTitle = documentRef.createElement("div");
      detailsTitle.className = "sigma-graph-section-title";
      detailsTitle.textContent = state.selectedEdge ? "Edge" : "Node";
      details.appendChild(detailsTitle);
      var detailBody = documentRef.createElement("div");
      detailBody.className = "sigma-graph-detail";
      if (state.selectedEdge && graph.hasEdge(state.selectedEdge)) {
        var edgeAttrs = graph.getEdgeAttributes(state.selectedEdge);
        detailBody.appendChild(createDetailRow(documentRef, "id", state.selectedEdge));
        detailBody.appendChild(createDetailRow(documentRef, "source", graph.source(state.selectedEdge)));
        detailBody.appendChild(createDetailRow(documentRef, "target", graph.target(state.selectedEdge)));
        ["label", "type", "kind", "weight"].forEach(function (key) {
          detailBody.appendChild(createDetailRow(documentRef, key, edgeAttrs[key]));
        });
      } else if (state.selectedNode && graph.hasNode(state.selectedNode)) {
        var attrs = graph.getNodeAttributes(state.selectedNode);
        detailBody.appendChild(createDetailRow(documentRef, "id", state.selectedNode));
        ["label", "type", "kind", "degree", "inDegree", "outDegree", "pagerank", "community", "tags"].forEach(function (key) {
          detailBody.appendChild(createDetailRow(documentRef, key, key === "pagerank" ? Number(attrs[key] || 0).toPrecision(4) : attrs[key]));
        });
      } else {
        var empty = documentRef.createElement("div");
        empty.className = "sigma-graph-empty";
        empty.textContent = "Select a node or edge.";
        detailBody.appendChild(empty);
      }
      details.appendChild(detailBody);
      side.appendChild(details);

      var matches = Array.from(state.matches).slice(0, 8).map(function (node) {
        var attrs = graph.getNodeAttributes(node);
        return {
          node: node,
          label: attrs.label || node,
          value: Number(attrs.degree) || 0
        };
      });
      if (state.query) {
        side.appendChild(renderNodeList("Matches", matches));
      }
      side.appendChild(renderNodeList("Top Degree", topNodes(graph, "degree", 8)));
      side.appendChild(renderNodeList("Top PageRank", topNodes(graph, "pagerank", 8)));
    }

    function renderNodeList(titleText, rows) {
      var section = documentRef.createElement("section");
      section.className = "sigma-graph-section";
      var titleElement = documentRef.createElement("div");
      titleElement.className = "sigma-graph-section-title";
      titleElement.textContent = titleText;
      section.appendChild(titleElement);
      var listElement = documentRef.createElement("div");
      listElement.className = "sigma-graph-list";
      if (!rows.length) {
        var empty = documentRef.createElement("div");
        empty.className = "sigma-graph-empty";
        empty.textContent = "No nodes.";
        listElement.appendChild(empty);
      }
      rows.forEach(function (row) {
        var button = documentRef.createElement("button");
        button.type = "button";
        button.title = "Select and center " + (row.label || row.node);
        var name = documentRef.createElement("span");
        name.className = "sigma-graph-list-name";
        name.textContent = row.label || row.node;
        var meta = documentRef.createElement("span");
        meta.className = "sigma-graph-list-meta";
        meta.textContent = Number(row.value || 0).toPrecision(3);
        button.appendChild(name);
        button.appendChild(meta);
        button.addEventListener("click", function () {
          selectNode(row.node, true);
        });
        listElement.appendChild(button);
      });
      section.appendChild(listElement);
      return section;
    }

    function framedNodePosition(node) {
      var attrs = graph.getNodeAttributes(node);
      var point = {
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0
      };
      if (!renderer || typeof renderer.graphToViewport !== "function" || typeof renderer.viewportToFramedGraph !== "function") {
        return point;
      }
      return renderer.viewportToFramedGraph(renderer.graphToViewport(point));
    }

    function centerNodeInRenderer(node) {
      if (!renderer || !graph.hasNode(node)) {
        return;
      }
      var framed = framedNodePosition(node);
      var camera = renderer.getCamera();
      var current = camera.getState();
      var currentRatio = Number(current.ratio);
      var targetRatio = Number.isFinite(currentRatio) ? Math.min(currentRatio, 0.65) : 0.65;
      var framedX = Number(framed.x);
      var framedY = Number(framed.y);
      camera.animate({
        x: Number.isFinite(framedX) ? framedX : 0.5,
        y: Number.isFinite(framedY) ? framedY : 0.5,
        ratio: Math.max(0.05, targetRatio)
      }, { duration: 250 });
    }

    function selectNode(node, moveCamera) {
      if (!node || !graph.hasNode(node)) {
        return;
      }
      state.selectedNode = node;
      state.selectedEdge = "";
      if (moveCamera && renderer) {
        centerNodeInRenderer(node);
      }
      renderSidePanel();
      refreshRenderer();
      setStatus("Selected " + (graph.getNodeAttribute(node, "label") || node) + ".");
    }

    function clearSelection() {
      state.selectedNode = "";
      state.selectedEdge = "";
      state.focusNeighbors = false;
      state.query = "";
      state.matches = new Set();
      searchInput.value = "";
      focusButton.textContent = "Focus";
      renderSidePanel();
      refreshRenderer();
      setStatus("Selection cleared.");
    }

    function startSigmaRenderer() {
      if (!canCreateWebGLContext(documentRef)) {
        renderFallback = function () {
          renderSvgFallback("WebGL is unavailable; showing SVG fallback.");
        };
        renderFallback();
        return;
      }

      try {
        renderer = new tools.Sigma(graph, viewport, {
          allowInvalidContainer: true,
          defaultNodeColor: DEFAULT_NODE_COLOR,
          defaultEdgeColor: DEFAULT_EDGE_COLOR,
          enableEdgeEvents: true,
          renderLabels: state.labelMode !== "none",
          renderEdgeLabels: state.edgeLabels,
          labelRenderedSizeThreshold: state.labelMode === "all" ? 0 : 8,
          labelDensity: 0.12,
          nodeReducer: nodeReducer,
          edgeReducer: edgeReducer,
          zIndex: true
        });
      } catch (error) {
        if (!isWebGLStartupError(error)) {
          throw error;
        }
        renderer = null;
        renderFallback = function () {
          renderSvgFallback("WebGL startup failed; showing SVG fallback.");
        };
        renderFallback();
        return;
      }

      renderer.on("downNode", function (event) {
        var point = graphPointFromEvent(event.event);
        if (!point) {
          return;
        }
        renderer.getCamera().disable();
        beginNodeDrag(event.node, point, Boolean(event.event && event.event.original && event.event.original.shiftKey), event);
      });

      renderer.getMouseCaptor().on("mousemovebody", function (event) {
        if (!dragState) {
          return;
        }
        updateNodeDrag(graphPointFromEvent(event), event);
      });

      renderer.getMouseCaptor().on("mouseup", function (event) {
        endNodeDrag(event);
      });

      renderer.on("clickNode", function (event) {
        if (shouldSuppressClick()) {
          return;
        }
        selectNode(event.node, false);
      });
      renderer.on("clickEdge", function (event) {
        if (shouldSuppressClick()) {
          return;
        }
        state.selectedEdge = event.edge;
        state.selectedNode = "";
        renderSidePanel();
        refreshRenderer();
        setStatus("Selected edge " + event.edge + ".");
      });
      renderer.on("clickStage", function () {
        if (shouldSuppressClick()) {
          return;
        }
        state.selectedNode = "";
        state.selectedEdge = "";
        renderSidePanel();
        refreshRenderer();
      });
    }

    startSigmaRenderer();

    runButton.addEventListener("click", function () {
      state.layout = layoutSelect.value;
      state.iterations = Number(iterationsInput.value) || state.iterations;
      setStatus("Running " + state.layout + "...");
      global.setTimeout(function () {
        try {
          var message = runLayout(graph, tools, state.layout, state.iterations);
          if (renderer) {
            renderer.refresh();
            renderer.getCamera().animatedReset({ duration: 250 });
          } else {
            refreshRenderer();
          }
          setStatus(message);
        } catch (error) {
          setStatus(error && error.message ? error.message : String(error));
        }
      }, 10);
    });

    colorSelect.addEventListener("change", function () {
      state.colorMode = colorSelect.value;
      applyAppearance(graph, state);
      refreshRenderer();
      setStatus("Color updated.");
    });
    sizeSelect.addEventListener("change", function () {
      state.sizeMetric = sizeSelect.value;
      applyAppearance(graph, state);
      renderSidePanel();
      refreshRenderer();
      setStatus("Size updated.");
    });
    labelSelect.addEventListener("change", function () {
      state.labelMode = labelSelect.value;
      refreshRenderer();
    });
    edgeLabelToggle.addEventListener("change", function () {
      state.edgeLabels = edgeLabelToggle.checked;
      refreshRenderer();
    });
    searchInput.addEventListener("input", function () {
      state.query = searchInput.value || "";
      recomputeMatches();
      renderSidePanel();
      refreshRenderer();
      setStatus(state.matches.size ? state.matches.size + " matches." : "No matches.");
    });
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && state.matches.size) {
        selectNode(Array.from(state.matches)[0], true);
      }
    });
    focusButton.addEventListener("click", function () {
      if (!state.selectedNode) {
        setStatus("Select a node first.");
        return;
      }
      state.focusNeighbors = !state.focusNeighbors;
      focusButton.textContent = state.focusNeighbors ? "Unfocus" : "Focus";
      refreshRenderer();
      setStatus(state.focusNeighbors ? "Neighborhood focus enabled." : "Neighborhood focus disabled.");
    });
    clearButton.addEventListener("click", clearSelection);
    fitButton.addEventListener("click", function () {
      if (renderer) {
        renderer.getCamera().animatedReset({ duration: 250 });
      } else {
        refreshRenderer();
      }
    });
    resetButton.addEventListener("click", function () {
      state.focusNeighbors = false;
      focusButton.textContent = "Focus";
      if (renderer) {
        renderer.getCamera().animatedReset({ duration: 250 });
      }
      refreshRenderer();
    });
    downloadButton.addEventListener("click", function () {
      try {
        var gexf = tools.gexf.write(graph);
        downloadText(documentRef, graphFileBase(input) + ".sigma.gexf", "application/gexf+xml", gexf);
        setStatus("Downloaded GEXF.");
      } catch (error) {
        setStatus(error && error.message ? error.message : String(error));
      }
    });

    renderSidePanel();
    global.requestAnimationFrame(function () {
      if (renderer) {
        renderer.resize();
        renderer.getCamera().animatedReset({ duration: 0 });
      } else {
        refreshRenderer();
      }
    });

    return function () {
      documentRef.removeEventListener("mousemove", handleFallbackDragMove);
      documentRef.removeEventListener("mouseup", handleFallbackDragEnd);
      dragState = null;
      if (renderer) {
        renderer.kill();
      }
      shell.remove();
    };
  }

  async function renderSigmaExplorer(input) {
    await requireRuntime(input.context).ensureScripts(RUNTIME_PATH);
    var tools = requireTools();
    var graph = parseGraphInput(input, tools);
    var params = input.params || {};
    return {
      kind: "custom",
      content: {
        mount: function (target) {
          return mountExplorer(target, tools, graph, input, params);
        }
      },
      mimeType: "application/x.editor-workbench.custom+sigma-graphology"
    };
  }

  function pipeline(id, name, inputLanguage, steps, group) {
    return {
      id: id,
      name: name,
      inputLanguage: inputLanguage,
      category: "Graphs",
      menuPath: ["Graphs", "Sigma", group || name],
      steps: steps.map(function (step) {
        return typeof step === "string" ? { use: step, params: {} } : step;
      })
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "sigma-graphology-explorer",
    name: "Sigma Graph Explorer",
    version: "0.1.0",
    description: "Interactive sigma.js and graphology graph explorer with ForceAtlas2, Noverlap, metrics, community coloring, search, focus, and GEXF download.",
    contributes: {
      languages: [],
      editors: [],
      editorExtensions: [],
      transformers: [],
      renderers: [
        {
          id: "sigma-graphology-renderer",
          name: "Sigma Graph Explorer",
          accepts: ["json.model-graph", "json.cytoscape", "json.tree", "json.jsmind", "xml.gexf"],
          outputKind: "custom",
          visibility: "internal",
          category: "Graphs",
          menuPath: ["Graphs", "Sigma", "Explore"],
          parameters: {
            layout: { type: "enum", values: ["forceatlas2", "noverlap", "circular", "random"], default: "forceatlas2" },
            iterations: { type: "integer", default: 120 },
            colorMode: { type: "enum", values: ["community", "type", "none"], default: "community" },
            sizeMetric: { type: "enum", values: ["degree", "pagerank", "fixed"], default: "degree" },
            labels: { type: "enum", values: ["auto", "all", "none"], default: "auto" },
            edgeLabels: { type: "boolean", default: false }
          },
          render: renderSigmaExplorer
        }
      ],
      exporters: [],
      linters: [],
      pipelines: [
        pipeline("view-model-graph-sigma", "Explore Model Graph", "json.model-graph", ["sigma-graphology-renderer"], "Model Graph"),
        pipeline("view-gephi-gexf-sigma", "Explore Gephi GEXF", "xml.gexf", ["sigma-graphology-renderer"], "Gephi GEXF"),
        pipeline("view-cytoscape-sigma", "Explore Cytoscape JSON", "json.cytoscape", ["sigma-graphology-renderer"], "Cytoscape"),
        pipeline("view-json-tree-sigma", "Explore JSON Tree", "json.tree", ["sigma-graphology-renderer"], "Tree"),
        pipeline("view-jsmind-sigma", "Explore jsMind", "json.jsmind", ["sigma-graphology-renderer"], "Mind Map"),
        pipeline("view-indented-tree-sigma", "Explore Indented Tree", "text.indented-tree", ["indented-tree-to-json", "indented-tree-json-to-model-graph", "sigma-graphology-renderer"], "Indented Tree"),
        pipeline("view-opml-sigma", "Explore OPML", "xml.opml", ["opml-to-tree", "sigma-graphology-renderer"], "OPML"),
        pipeline("view-markdown-outline-sigma", "Explore Markdown Outline", "text.markdown", ["markdown-to-outline-tree", "sigma-graphology-renderer"], "Markdown"),
        pipeline("view-json-sigma", "Explore JSON Tree Projection", "text.json", ["json-to-tree", "sigma-graphology-renderer"], "JSON"),
        pipeline("view-yaml-sigma", "Explore YAML Tree Projection", "text.yaml", ["yaml-to-tree", "sigma-graphology-renderer"], "YAML"),
        pipeline("view-json-table-relations-sigma", "Explore Table Relations", "json.table", ["json-table-to-architecture-graph", "sigma-graphology-renderer"], "Tables"),
        pipeline("view-csv-relations-sigma", "Explore CSV Relations", "text.csv", ["csv-to-json-table", "json-table-to-architecture-graph", "sigma-graphology-renderer"], "CSV"),
        pipeline("view-openapi-sigma", "Explore OpenAPI Graph", "json.openapi", ["openapi-to-dependency-graph", "sigma-graphology-renderer"], "OpenAPI"),
        pipeline("view-openapi-yaml-sigma", "Explore OpenAPI YAML Graph", "yaml.openapi", ["yaml-openapi-to-json-openapi", "openapi-to-dependency-graph", "sigma-graphology-renderer"], "OpenAPI YAML"),
        pipeline("view-package-json-sigma", "Explore package.json Dependencies", "text.json", ["package-json-to-dependency-graph", "sigma-graphology-renderer"], "Package JSON"),
        pipeline("view-javascript-imports-sigma", "Explore JavaScript Imports", "text.javascript", ["javascript-imports-to-dependency-graph", "sigma-graphology-renderer"], "JavaScript"),
        pipeline("view-python-imports-sigma", "Explore Python Imports", "text.python", ["python-imports-to-dependency-graph", "sigma-graphology-renderer"], "Python"),
        pipeline("view-bpmn-sigma", "Explore BPMN Process Graph", "xml.bpmn", ["bpmn-to-process-graph", "sigma-graphology-renderer"], "BPMN"),
        pipeline("view-archimate-sigma", "Explore ArchiMate Graph", "xml.archimate-exchange", ["archimate-to-architecture-graph", "sigma-graphology-renderer"], "ArchiMate")
      ]
    }
  });
})(window);
