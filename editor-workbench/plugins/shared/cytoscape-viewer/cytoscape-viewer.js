(function (global) {
  "use strict";

  var LAYOUT_OPTIONS = ["breadthfirst", "cose", "circle", "grid", "concentric"];

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
        "line-style": "dashed",
        "target-arrow-color": "#f59e0b"
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

  var VIEWER_STYLE_ID = "editor-workbench-cytoscape-viewer-style";
  var VIEWER_STYLE = [
    ".cytoscape-graph-shell { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; height: calc(100vh - 32px); min-height: 0; }",
    ".cytoscape-graph-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }",
    ".cytoscape-graph-title-group { display: grid; gap: 2px; }",
    ".cytoscape-graph-title { font-size: 14px; }",
    ".cytoscape-graph-summary { color: var(--muted, #5d6b7c); font-size: 12px; }",
    ".cytoscape-graph-controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; }",
    ".cytoscape-graph-viewport { min-height: 0; border: 1px solid var(--border, #cbd3df); border-radius: 8px; background: #ffffff; }"
  ].join("\n");

  function ensureViewerStyles(documentRef) {
    if (documentRef.getElementById(VIEWER_STYLE_ID)) {
      return;
    }
    var style = documentRef.createElement("style");
    style.id = VIEWER_STYLE_ID;
    style.textContent = VIEWER_STYLE;
    (documentRef.head || documentRef.documentElement).appendChild(style);
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function sanitizeLayoutName(name) {
    return LAYOUT_OPTIONS.indexOf(name) === -1 ? DEFAULT_LAYOUT.name : name;
  }

  function createLayoutOptions(name, baseLayout) {
    var layoutName = sanitizeLayoutName(name);
    var options = Object.assign({}, DEFAULT_LAYOUT, baseLayout || {}, {
      name: layoutName,
      animate: false,
      padding: 32
    });
    if (layoutName === "breadthfirst") {
      options.directed = true;
      options.spacingFactor = options.spacingFactor || DEFAULT_LAYOUT.spacingFactor;
    }
    return options;
  }

  function getElementList(graph) {
    if (!graph) {
      return [];
    }
    if (Array.isArray(graph.elementList)) {
      return graph.elementList;
    }
    if (Array.isArray(graph.elements)) {
      return graph.elements;
    }
    if (isPlainObject(graph.elements)) {
      return (graph.elements.nodes || []).concat(graph.elements.edges || []);
    }
    return [];
  }

  function isEdge(element) {
    var data = element && isPlainObject(element.data) ? element.data : {};
    return element && (element.group === "edges" || data.source != null || data.target != null);
  }

  function createSummaryText(graph, elements) {
    if (graph && isPlainObject(graph.elements) && Array.isArray(graph.elements.nodes) && Array.isArray(graph.elements.edges)) {
      return graph.elements.nodes.length + " nodes, " + graph.elements.edges.length + " edges";
    }

    var counts = (elements || []).reduce(function (result, element) {
      if (isEdge(element)) {
        result.edges += 1;
      } else {
        result.nodes += 1;
      }
      return result;
    }, { nodes: 0, edges: 0 });
    return counts.nodes + " nodes, " + counts.edges + " edges";
  }

  function resolveStyle(graph, options) {
    if (options && Array.isArray(options.style) && options.style.length > 0) {
      return options.style;
    }
    if (graph && Array.isArray(graph.style) && graph.style.length > 0) {
      return graph.style;
    }
    return DEFAULT_STYLE;
  }

  function mount(target, cytoscapeFactory, graph, options) {
    var viewerOptions = options || {};
    var elements = getElementList(graph);
    var configuredLayout = viewerOptions.layout || (graph && graph.layout) || DEFAULT_LAYOUT;
    var documentRef = target.ownerDocument;
    ensureViewerStyles(documentRef);
    var shell = documentRef.createElement("section");
    shell.className = "cytoscape-graph-shell";

    var header = documentRef.createElement("div");
    header.className = "cytoscape-graph-header";

    var titleGroup = documentRef.createElement("div");
    titleGroup.className = "cytoscape-graph-title-group";

    var title = documentRef.createElement("strong");
    title.className = "cytoscape-graph-title";
    title.textContent = viewerOptions.title || "Cytoscape graph";

    var summary = documentRef.createElement("span");
    summary.className = "cytoscape-graph-summary";
    summary.textContent = viewerOptions.summary || createSummaryText(graph, elements);

    titleGroup.appendChild(title);
    titleGroup.appendChild(summary);

    var controls = documentRef.createElement("div");
    controls.className = "cytoscape-graph-controls";

    var layoutSelect = documentRef.createElement("select");
    LAYOUT_OPTIONS.forEach(function (name) {
      var option = documentRef.createElement("option");
      option.value = name;
      option.textContent = name;
      layoutSelect.appendChild(option);
    });
    layoutSelect.value = sanitizeLayoutName(configuredLayout.name);

    var runLayoutButton = documentRef.createElement("button");
    runLayoutButton.type = "button";
    runLayoutButton.textContent = "Run";
    runLayoutButton.title = "Run selected layout";

    var fitButton = documentRef.createElement("button");
    fitButton.type = "button";
    fitButton.textContent = "Fit";
    fitButton.title = "Fit graph to view";

    var resetButton = documentRef.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Reset";
    resetButton.title = "Reset zoom and pan";

    controls.appendChild(layoutSelect);
    controls.appendChild(runLayoutButton);
    controls.appendChild(fitButton);
    controls.appendChild(resetButton);

    header.appendChild(titleGroup);
    header.appendChild(controls);

    var viewport = documentRef.createElement("div");
    viewport.className = "cytoscape-graph-viewport";

    shell.appendChild(header);
    shell.appendChild(viewport);
    target.appendChild(shell);

    var baseLayout = configuredLayout;
    var fitPadding = Number.isFinite(viewerOptions.fitPadding) ? viewerOptions.fitPadding : 32;
    var cy = cytoscapeFactory({
      container: viewport,
      elements: elements,
      layout: createLayoutOptions(layoutSelect.value, baseLayout),
      minZoom: viewerOptions.minZoom || 0.1,
      maxZoom: viewerOptions.maxZoom || 4,
      wheelSensitivity: viewerOptions.wheelSensitivity || 0.15,
      style: resolveStyle(graph, viewerOptions)
    });

    function fitGraph() {
      cy.fit(cy.elements(), fitPadding);
    }

    function resetGraph() {
      cy.zoom(1);
      cy.center(cy.elements());
      fitGraph();
    }

    function runSelectedLayout() {
      cy.layout(createLayoutOptions(layoutSelect.value, baseLayout)).run();
      global.setTimeout(fitGraph, 60);
    }

    runLayoutButton.addEventListener("click", runSelectedLayout);
    fitButton.addEventListener("click", fitGraph);
    resetButton.addEventListener("click", resetGraph);

    if (typeof global.requestAnimationFrame === "function") {
      global.requestAnimationFrame(fitGraph);
    } else {
      fitGraph();
    }

    return function () {
      runLayoutButton.removeEventListener("click", runSelectedLayout);
      fitButton.removeEventListener("click", fitGraph);
      resetButton.removeEventListener("click", resetGraph);
      cy.destroy();
    };
  }

  global.EditorWorkbenchCytoscapeViewer = {
    createLayoutOptions: createLayoutOptions,
    defaultStyle: DEFAULT_STYLE,
    getElementList: getElementList,
    layoutOptions: LAYOUT_OPTIONS.slice(),
    mount: mount,
    sanitizeLayoutName: sanitizeLayoutName
  };
})(window);
