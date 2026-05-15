(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function fileName(input, suffix, extension) {
    var sourceName = input && input.document && input.document.fileName || "architecture";
    return sourceName.replace(/\.[^.]+$/, "") + suffix + extension;
  }

  function sanitizeId(value, fallback) {
    var text = String(value || "").trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!text || !/^[A-Za-z_]/.test(text)) {
      text = fallback;
    }
    return text;
  }

  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseAttributes(source) {
    var attrs = {};
    var regex = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    var match;
    while ((match = regex.exec(source || ""))) {
      attrs[match[1]] = match[3] != null ? match[3] : match[4] || "";
    }
    return attrs;
  }

  function parseTable(input) {
    var table = parseJson(input.text || "");
    if (!table || table.format !== "json.table") {
      throw new Error("Expected json.table input.");
    }
    return table;
  }

  function tableRows(table) {
    return list(table.rows).map(function (row) {
      return list(row.cells);
    });
  }

  function normalizeLabel(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function inferColumns(table) {
    var labels = list(table.columns).map(function (column, index) {
      return column.label || column.id || "Column " + (index + 1);
    });
    var rows = tableRows(table);
    var firstRow = rows[0] || [];
    var firstRowLabels = firstRow.map(normalizeLabel);
    var hasHeaderRow = ["source", "target", "relationship", "source-type", "target-type", "name", "type"].some(function (label) {
      return firstRowLabels.indexOf(label) !== -1;
    });
    if (hasHeaderRow) {
      labels = firstRow;
      rows = rows.slice(1);
    }
    var lookup = new Map();
    labels.forEach(function (label, index) {
      lookup.set(normalizeLabel(label), index);
    });
    function pick(names, fallback) {
      for (var index = 0; index < names.length; index += 1) {
        if (lookup.has(names[index])) {
          return lookup.get(names[index]);
        }
      }
      return fallback;
    }
    return {
      labels: labels,
      rows: rows,
      source: pick(["source", "from", "name", "component", "system"], 0),
      target: pick(["target", "to", "depends-on", "dependency"], Math.min(1, labels.length - 1)),
      relationship: pick(["relationship", "relation", "edge", "kind"], Math.min(2, labels.length - 1)),
      sourceType: pick(["source-type", "type", "layer"], Math.min(3, labels.length - 1)),
      targetType: pick(["target-type"], -1)
    };
  }

  function architectureGraph(nodes, edges, metadata) {
    return {
      format: "json.model-graph",
      profile: "architecture",
      version: "1.0",
      metadata: metadata || {},
      nodes: nodes,
      edges: edges
    };
  }

  function tableToArchitectureGraph(input) {
    var table = parseTable(input);
    var inferred = inferColumns(table);
    var nodesById = new Map();
    var edges = [];
    function ensureNode(label, type) {
      var id = sanitizeId(label, "component-" + (nodesById.size + 1));
      if (!nodesById.has(id)) {
        nodesById.set(id, {
          id: id,
          label: label || id,
          type: type || "component",
          tags: [],
          attributes: {}
        });
      }
      return id;
    }
    inferred.rows.forEach(function (row, index) {
      var sourceLabel = row[inferred.source] || "";
      var targetLabel = row[inferred.target] || "";
      if (!sourceLabel) {
        return;
      }
      var source = ensureNode(sourceLabel, row[inferred.sourceType] || "component");
      if (!targetLabel || inferred.target === inferred.source) {
        return;
      }
      var target = ensureNode(targetLabel, inferred.targetType >= 0 ? row[inferred.targetType] : "component");
      var relationship = row[inferred.relationship] || "relates-to";
      edges.push({
        id: "architecture-edge-" + (index + 1),
        source: source,
        target: target,
        type: relationship,
        label: relationship
      });
    });
    return {
      text: JSON.stringify(architectureGraph(Array.from(nodesById.values()), edges, {
        sourceLanguage: input.languageId
      }), null, 2),
      languageId: "json.model-graph.architecture",
      fileName: fileName(input, ".architecture.model-graph", ".json"),
      mimeType: "application/json"
    };
  }

  function parseArchitectureGraph(input) {
    var graph = parseJson(input.text || "");
    if (!graph || graph.format !== "json.model-graph") {
      throw new Error("Expected json.model-graph architecture input.");
    }
    return graph;
  }

  function architectureToTraceabilityTable(input) {
    var graph = parseArchitectureGraph(input);
    var nodes = new Map();
    list(graph.nodes).forEach(function (node) {
      nodes.set(String(node.id), node);
    });
    var rows = list(graph.edges).map(function (edge) {
      var source = nodes.get(String(edge.source)) || {};
      var target = nodes.get(String(edge.target)) || {};
      return [
        source.label || edge.source || "",
        edge.label || edge.type || "",
        target.label || edge.target || "",
        source.type || "",
        target.type || ""
      ];
    });
    return {
      text: JSON.stringify({
        format: "json.table",
        profile: "json.table.traceability-matrix",
        version: "1.0",
        metadata: {
          sourceLanguage: input.languageId
        },
        columns: ["Source", "Relationship", "Target", "Source Type", "Target Type"].map(function (label) {
          return { id: normalizeLabel(label), label: label };
        }),
        rows: rows.map(function (row, index) {
          return { id: "row-" + (index + 1), cells: row };
        })
      }, null, 2),
      languageId: "json.table.traceability-matrix",
      fileName: fileName(input, ".traceability.table", ".json"),
      mimeType: "application/json"
    };
  }

  function architectureToTraceabilityGraph(input) {
    var graph = parseArchitectureGraph(input);
    var next = Object.assign({}, graph, {
      profile: "traceability",
      metadata: Object.assign({}, graph.metadata || {}, {
        sourceProfile: graph.profile || "architecture"
      })
    });
    return {
      text: JSON.stringify(next, null, 2),
      languageId: "json.model-graph.traceability",
      fileName: fileName(input, ".traceability.model-graph", ".json"),
      mimeType: "application/json"
    };
  }

  function archimateToArchitectureGraph(input) {
    var text = input.text || "";
    var nodes = [];
    var elementRegex = /<element\b([^>]*?)(?:\/>|>([\s\S]*?)<\/element>)/gi;
    var match;
    while ((match = elementRegex.exec(text))) {
      var attrs = parseAttributes(match[1] || "");
      var body = match[2] || "";
      var nameMatch = /<name\b[^>]*>([\s\S]*?)<\/name>/i.exec(body);
      var id = attrs.identifier || attrs.id || "element-" + (nodes.length + 1);
      nodes.push({
        id: id,
        label: nameMatch ? nameMatch[1].replace(/<[^>]+>/g, "").trim() : id,
        type: attrs["xsi:type"] || attrs.type || "Element",
        tags: ["archimate"],
        attributes: attrs
      });
    }
    var edges = [];
    var relationRegex = /<relationship\b([^>]*?)(?:\/>|>[\s\S]*?<\/relationship>)/gi;
    while ((match = relationRegex.exec(text))) {
      var relationAttrs = parseAttributes(match[1] || "");
      if (relationAttrs.source && relationAttrs.target) {
        edges.push({
          id: relationAttrs.identifier || relationAttrs.id || "relationship-" + (edges.length + 1),
          source: relationAttrs.source,
          target: relationAttrs.target,
          type: relationAttrs["xsi:type"] || relationAttrs.type || "Association",
          label: relationAttrs.name || relationAttrs["xsi:type"] || relationAttrs.type || "relates-to"
        });
      }
    }
    return {
      text: JSON.stringify(architectureGraph(nodes, edges, {
        sourceLanguage: "xml.archimate-exchange",
        lossy: true
      }), null, 2),
      languageId: "json.model-graph.architecture",
      fileName: fileName(input, ".architecture.model-graph", ".json"),
      mimeType: "application/json"
    };
  }

  function architectureGraphToArchimate(input) {
    var graph = parseArchitectureGraph(input);
    var nodes = list(graph.nodes).map(function (node) {
      return [
        "    <element identifier=\"" + escapeXml(node.id) + "\" xsi:type=\"" + escapeXml(node.type || "ApplicationComponent") + "\">",
        "      <name>" + escapeXml(node.label || node.id) + "</name>",
        "    </element>"
      ].join("\n");
    }).join("\n");
    var edges = list(graph.edges).map(function (edge, index) {
      return "    <relationship identifier=\"" + escapeXml(edge.id || "relationship-" + (index + 1)) + "\" xsi:type=\"" + escapeXml(edge.type || "AssociationRelationship") + "\" source=\"" + escapeXml(edge.source) + "\" target=\"" + escapeXml(edge.target) + "\"/>";
    }).join("\n");
    return {
      text: [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<model xmlns=\"http://www.opengroup.org/xsd/archimate/3.0/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" identifier=\"localedit-model\">",
        "  <name>LocalEdit Architecture</name>",
        "  <elements>",
        nodes,
        "  </elements>",
        "  <relationships>",
        edges,
        "  </relationships>",
        "</model>"
      ].join("\n"),
      languageId: "xml.archimate-exchange",
      fileName: fileName(input, ".archimate", ".xml"),
      mimeType: "application/xml"
    };
  }

  function lintArchitectureGraph(input) {
    try {
      var graph = parseArchitectureGraph(input);
      var ids = new Set(list(graph.nodes).map(function (node) { return String(node.id || ""); }));
      return list(graph.edges).filter(function (edge) {
        return !ids.has(String(edge.source || "")) || !ids.has(String(edge.target || ""));
      }).map(function (edge) {
        return {
          source: "Architecture Graph",
          severity: "warning",
          message: "Edge references missing node: " + (edge.id || edge.source + " -> " + edge.target) + ".",
          languageId: input.languageId
        };
      });
    } catch (error) {
      return [{
        source: "Architecture Graph",
        severity: "error",
        message: error && error.message ? error.message : String(error),
        languageId: input.languageId
      }];
    }
  }

  function exportArchimate(input) {
    return {
      fileName: fileName(input, "", ".archimate.xml"),
      mimeType: "application/xml",
      content: input.text || ""
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "architecture-model",
    name: "Architecture Model",
    version: "0.1.0",
    description: "Architecture graph profiles, traceability views, table/CSV import, and ArchiMate Exchange XML import/export.",
    contributes: {
      languages: [],
      editors: [],
      editorExtensions: [],
      transformers: [
        {
          id: "json-table-to-architecture-graph",
          name: "JSON Table to Architecture Graph",
          inputLanguage: "json.table",
          outputLanguage: "json.model-graph.architecture",
          visibility: "internal",
          transform: tableToArchitectureGraph
        },
        {
          id: "architecture-graph-to-traceability-table",
          name: "Architecture Graph to Traceability Table",
          inputLanguage: "json.model-graph.architecture",
          outputLanguage: "json.table.traceability-matrix",
          visibility: "internal",
          transform: architectureToTraceabilityTable
        },
        {
          id: "architecture-graph-to-traceability-graph",
          name: "Architecture Graph to Traceability Graph",
          inputLanguage: "json.model-graph.architecture",
          outputLanguage: "json.model-graph.traceability",
          visibility: "internal",
          transform: architectureToTraceabilityGraph
        },
        {
          id: "archimate-to-architecture-graph",
          name: "ArchiMate to Architecture Graph",
          inputLanguage: "xml.archimate-exchange",
          outputLanguage: "json.model-graph.architecture",
          visibility: "internal",
          transform: archimateToArchitectureGraph
        },
        {
          id: "architecture-graph-to-archimate",
          name: "Architecture Graph to ArchiMate",
          inputLanguage: "json.model-graph.architecture",
          outputLanguage: "xml.archimate-exchange",
          visibility: "internal",
          transform: architectureGraphToArchimate
        }
      ],
      renderers: [],
      exporters: [
        {
          id: "archimate-source-export",
          name: "ArchiMate Exchange XML",
          accepts: ["xml.archimate-exchange"],
          outputFileExtension: "archimate.xml",
          mimeType: "application/xml",
          category: "Export",
          menuPath: ["Export", "ArchiMate"],
          export: exportArchimate
        }
      ],
      linters: [
        {
          id: "architecture-graph-linter",
          name: "Architecture Graph shape",
          accepts: ["json.model-graph.architecture"],
          lint: lintArchitectureGraph
        }
      ],
      pipelines: [
        {
          id: "table-to-architecture-graph",
          name: "Table to Architecture Graph",
          inputLanguage: "json.table",
          category: "Graphs",
          menuPath: ["Graphs", "Architecture", "From Table"],
          steps: [
            { use: "json-table-to-architecture-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "csv-to-architecture-graph",
          name: "CSV to Architecture Graph",
          inputLanguage: "text.csv",
          category: "Graphs",
          menuPath: ["Graphs", "Architecture", "From CSV"],
          steps: [
            { use: "csv-to-json-table", params: {} },
            { use: "json-table-to-architecture-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "view-architecture-graph",
          name: "View Architecture Graph",
          inputLanguage: "json.model-graph.architecture",
          category: "Graphs",
          menuPath: ["Graphs", "Architecture", "Cytoscape"],
          steps: [
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "architecture-traceability-table",
          name: "Architecture Traceability Table",
          inputLanguage: "json.model-graph.architecture",
          category: "Tables",
          menuPath: ["Tables", "Architecture", "Traceability"],
          steps: [
            { use: "architecture-graph-to-traceability-table", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "architecture-traceability-graph",
          name: "Architecture Traceability Graph",
          inputLanguage: "json.model-graph.architecture",
          category: "Graphs",
          menuPath: ["Graphs", "Architecture", "Traceability"],
          steps: [
            { use: "architecture-graph-to-traceability-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "architecture-report",
          name: "Architecture Markdown Report",
          inputLanguage: "json.model-graph.architecture",
          category: "Reports",
          menuPath: ["Reports", "Architecture", "Markdown"],
          steps: [
            { use: "model-graph-to-markdown-report", params: {} }
          ]
        },
        {
          id: "export-architecture-archimate",
          name: "Export Architecture as ArchiMate",
          inputLanguage: "json.model-graph.architecture",
          category: "Export",
          menuPath: ["Export", "Architecture", "ArchiMate"],
          steps: [
            { use: "architecture-graph-to-archimate", params: {} },
            { use: "archimate-source-export", params: {} }
          ]
        },
        {
          id: "view-archimate-as-architecture-graph",
          name: "View ArchiMate as Architecture Graph",
          inputLanguage: "xml.archimate-exchange",
          category: "Graphs",
          menuPath: ["Graphs", "ArchiMate", "Architecture Graph"],
          steps: [
            { use: "archimate-to-architecture-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "archimate-architecture-report",
          name: "ArchiMate Architecture Report",
          inputLanguage: "xml.archimate-exchange",
          category: "Reports",
          menuPath: ["Reports", "ArchiMate", "Architecture"],
          steps: [
            { use: "archimate-to-architecture-graph", params: {} },
            { use: "model-graph-to-markdown-report", params: {} }
          ]
        }
      ]
    }
  });
})(window);
