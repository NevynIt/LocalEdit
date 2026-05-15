(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function fileName(input, suffix, extension) {
    var sourceName = input && input.document && input.document.fileName || "process";
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

  function quoteMermaid(value) {
    return "\"" + String(value == null ? "" : value).replace(/"/g, "'") + "\"";
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

  function parseIndentedTreeJson(text) {
    var value = parseJson(text || "");
    if (!value || value.format !== "indented-tree" || !Array.isArray(value.nodes)) {
      throw new Error("Expected json.indented-tree input.");
    }
    return value;
  }

  function processGraphDocument(nodes, edges, metadata) {
    return {
      format: "json.model-graph",
      profile: "process",
      version: "1.0",
      metadata: metadata || {},
      nodes: nodes,
      edges: edges
    };
  }

  function indentedTreeJsonToProcessGraph(input) {
    var parsed = parseIndentedTreeJson(input.text || "");
    var idCounts = new Map();
    parsed.nodes.forEach(function (node) {
      if (node.id) {
        idCounts.set(node.id, (idCounts.get(node.id) || 0) + 1);
      }
    });
    var ids = new Map();
    var nodes = parsed.nodes.map(function (node) {
      var id = node.id && idCounts.get(node.id) === 1 ? node.id : node.internalId;
      ids.set(node.internalId, id);
      var attrs = Object.assign({}, node.attributes || {}, {
        details: node.details || "",
        sourceLine: node.line || 0
      });
      return {
        id: id,
        label: node.label || id,
        type: node.type || (list(node.tags).indexOf("decision") !== -1 ? "gateway" : "activity"),
        tags: list(node.tags),
        attributes: attrs
      };
    });
    var edges = [];
    parsed.nodes.forEach(function (node) {
      var source = ids.get(node.internalId);
      list(node.children).forEach(function (childId, index) {
        edges.push({
          id: "flow-" + source + "-" + ids.get(childId) + "-" + index,
          source: source,
          target: ids.get(childId),
          type: "sequence",
          label: "next"
        });
      });
      list(node.links).forEach(function (link, index) {
        if (link && ids.get(link.targetInternalId)) {
          edges.push({
            id: "link-" + source + "-" + ids.get(link.targetInternalId) + "-" + index,
            source: source,
            target: ids.get(link.targetInternalId),
            type: link.type || "association",
            label: link.type || "association"
          });
        }
      });
    });
    return {
      text: JSON.stringify(processGraphDocument(nodes, edges, {
        sourceLanguage: "json.indented-tree",
        document: parsed.metadata || {}
      }), null, 2),
      languageId: "json.model-graph.process",
      fileName: fileName(input, ".process.model-graph", ".json"),
      mimeType: "application/json"
    };
  }

  function parseProcessGraph(input) {
    var graph = parseJson(input.text || "");
    if (!graph || graph.format !== "json.model-graph") {
      throw new Error("Expected json.model-graph process input.");
    }
    return graph;
  }

  function processGraphToMermaid(input) {
    var graph = parseProcessGraph(input);
    var lines = ["flowchart TD"];
    list(graph.nodes).forEach(function (node) {
      var id = sanitizeId(node.id, "node");
      var label = quoteMermaid(node.label || node.id || id);
      if (/gateway|decision/i.test(node.type || "")) {
        lines.push("  " + id + "{" + label + "}");
      } else if (/event|start|end/i.test(node.type || "")) {
        lines.push("  " + id + "((" + label + "))");
      } else {
        lines.push("  " + id + "[" + label + "]");
      }
    });
    list(graph.edges).forEach(function (edge) {
      var source = sanitizeId(edge.source, "source");
      var target = sanitizeId(edge.target, "target");
      var label = edge.label && edge.label !== "next" ? "|" + String(edge.label).replace(/\|/g, "/") + "|" : "";
      lines.push("  " + source + " -->" + label + " " + target);
    });
    return {
      text: lines.join("\n"),
      languageId: "text.mermaid",
      fileName: fileName(input, ".process", ".mmd"),
      mimeType: "text/x-mermaid"
    };
  }

  function processGraphToDot(input) {
    var graph = parseProcessGraph(input);
    var lines = ["digraph Process {", "  rankdir=LR;", "  node [shape=box, style=\"rounded,filled\", fillcolor=\"#eef6f4\", color=\"#0f766e\"];"];
    list(graph.nodes).forEach(function (node) {
      lines.push("  \"" + String(node.id).replace(/"/g, "\\\"") + "\" [label=\"" + String(node.label || node.id).replace(/"/g, "\\\"") + "\"];");
    });
    list(graph.edges).forEach(function (edge) {
      lines.push("  \"" + String(edge.source).replace(/"/g, "\\\"") + "\" -> \"" + String(edge.target).replace(/"/g, "\\\"") + "\" [label=\"" + String(edge.label || edge.type || "").replace(/"/g, "\\\"") + "\"];");
    });
    lines.push("}");
    return {
      text: lines.join("\n"),
      languageId: "text.graphviz-dot",
      fileName: fileName(input, ".process", ".dot"),
      mimeType: "text/vnd.graphviz"
    };
  }

  function bpmnToProcessGraph(input) {
    var text = input.text || "";
    var nodes = [];
    var nodeRegex = /<(?:bpmn:)?(startEvent|endEvent|task|userTask|serviceTask|manualTask|exclusiveGateway|parallelGateway)\b([^>]*)\/?>/gi;
    var match;
    while ((match = nodeRegex.exec(text))) {
      var attrs = parseAttributes(match[2] || "");
      var id = attrs.id || "node-" + (nodes.length + 1);
      nodes.push({
        id: id,
        label: attrs.name || id,
        type: match[1].replace(/Task$/, "Task").replace(/Gateway$/, "Gateway"),
        tags: ["bpmn"],
        attributes: attrs
      });
    }
    var edges = [];
    var edgeRegex = /<(?:bpmn:)?sequenceFlow\b([^>]*)\/?>/gi;
    while ((match = edgeRegex.exec(text))) {
      var edgeAttrs = parseAttributes(match[1] || "");
      if (edgeAttrs.sourceRef && edgeAttrs.targetRef) {
        edges.push({
          id: edgeAttrs.id || "flow-" + (edges.length + 1),
          source: edgeAttrs.sourceRef,
          target: edgeAttrs.targetRef,
          type: "sequence",
          label: edgeAttrs.name || "next"
        });
      }
    }
    return {
      text: JSON.stringify(processGraphDocument(nodes, edges, {
        sourceLanguage: "xml.bpmn",
        lossy: true
      }), null, 2),
      languageId: "json.model-graph.process",
      fileName: fileName(input, ".process.model-graph", ".json"),
      mimeType: "application/json"
    };
  }

  function processGraphToRoleActivityTable(input) {
    var graph = parseProcessGraph(input);
    var rows = list(graph.nodes).map(function (node) {
      var attrs = node.attributes || {};
      return [
        attrs.role || attrs.lane || attrs.owner || "",
        node.label || node.id || "",
        node.type || "",
        node.id || ""
      ];
    });
    return {
      text: JSON.stringify({
        format: "json.table",
        profile: "json.table.role-activity",
        version: "1.0",
        metadata: {
          sourceLanguage: input.languageId
        },
        columns: ["Role", "Activity", "Type", "ID"].map(function (label) {
          return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: label };
        }),
        rows: rows.map(function (row, index) {
          return { id: "row-" + (index + 1), cells: row };
        })
      }, null, 2),
      languageId: "json.table.role-activity",
      fileName: fileName(input, ".role-activity.table", ".json"),
      mimeType: "application/json"
    };
  }

  function processGraphToBpmn(input) {
    var graph = parseProcessGraph(input);
    var nodes = list(graph.nodes);
    var edges = list(graph.edges);
    var nodeXml = nodes.map(function (node) {
      var tag = /gateway|decision/i.test(node.type || "") ? "exclusiveGateway" : (/event|start/i.test(node.type || "") ? "startEvent" : (/end/i.test(node.type || "") ? "endEvent" : "task"));
      return "    <bpmn:" + tag + " id=\"" + escapeXml(node.id) + "\" name=\"" + escapeXml(node.label || node.id) + "\"/>";
    }).join("\n");
    var edgeXml = edges.map(function (edge, index) {
      return "    <bpmn:sequenceFlow id=\"" + escapeXml(edge.id || "Flow_" + (index + 1)) + "\" sourceRef=\"" + escapeXml(edge.source) + "\" targetRef=\"" + escapeXml(edge.target) + "\" name=\"" + escapeXml(edge.label || "") + "\"/>";
    }).join("\n");
    return {
      text: [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" id=\"Definitions_LocalEdit\">",
        "  <bpmn:process id=\"Process_LocalEdit\" isExecutable=\"false\">",
        nodeXml,
        edgeXml,
        "  </bpmn:process>",
        "</bpmn:definitions>"
      ].join("\n"),
      languageId: "xml.bpmn",
      fileName: fileName(input, ".process", ".bpmn"),
      mimeType: "application/xml"
    };
  }

  function lintProcessGraph(input) {
    try {
      var graph = parseProcessGraph(input);
      var ids = new Set(list(graph.nodes).map(function (node) { return String(node.id || ""); }));
      return list(graph.edges).filter(function (edge) {
        return !ids.has(String(edge.source || "")) || !ids.has(String(edge.target || ""));
      }).map(function (edge) {
        return {
          source: "Process Graph",
          severity: "warning",
          message: "Edge references missing node: " + (edge.id || edge.source + " -> " + edge.target) + ".",
          languageId: input.languageId
        };
      });
    } catch (error) {
      return [{
        source: "Process Graph",
        severity: "error",
        message: error && error.message ? error.message : String(error),
        languageId: input.languageId
      }];
    }
  }

  function exportBpmn(input) {
    return {
      fileName: fileName(input, "", ".bpmn"),
      mimeType: "application/xml",
      content: input.text || ""
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "process-model",
    name: "Process Model",
    version: "0.1.0",
    description: "Process model graph profiles, BPMN import/export, process diagram transforms, and role/activity tables.",
    contributes: {
      languages: [],
      editors: [],
      editorExtensions: [],
      transformers: [
        {
          id: "indented-tree-json-to-process-graph",
          name: "Indented Tree JSON to Process Graph",
          inputLanguage: "json.indented-tree",
          outputLanguage: "json.model-graph.process",
          visibility: "internal",
          transform: indentedTreeJsonToProcessGraph
        },
        {
          id: "process-graph-to-mermaid",
          name: "Process Graph to Mermaid",
          inputLanguage: "json.model-graph.process",
          outputLanguage: "text.mermaid",
          visibility: "internal",
          transform: processGraphToMermaid
        },
        {
          id: "process-graph-to-dot",
          name: "Process Graph to DOT",
          inputLanguage: "json.model-graph.process",
          outputLanguage: "text.graphviz-dot",
          visibility: "internal",
          transform: processGraphToDot
        },
        {
          id: "bpmn-to-process-graph",
          name: "BPMN to Process Graph",
          inputLanguage: "xml.bpmn",
          outputLanguage: "json.model-graph.process",
          visibility: "internal",
          transform: bpmnToProcessGraph
        },
        {
          id: "process-graph-to-role-activity-table",
          name: "Process Graph to Role Activity Table",
          inputLanguage: "json.model-graph.process",
          outputLanguage: "json.table.role-activity",
          visibility: "internal",
          transform: processGraphToRoleActivityTable
        },
        {
          id: "process-graph-to-bpmn",
          name: "Process Graph to BPMN",
          inputLanguage: "json.model-graph.process",
          outputLanguage: "xml.bpmn",
          visibility: "internal",
          transform: processGraphToBpmn
        }
      ],
      renderers: [],
      exporters: [
        {
          id: "bpmn-source-export",
          name: "BPMN XML",
          accepts: ["xml.bpmn"],
          outputFileExtension: "bpmn",
          mimeType: "application/xml",
          category: "Export",
          menuPath: ["Export", "BPMN"],
          export: exportBpmn
        }
      ],
      linters: [
        {
          id: "process-graph-linter",
          name: "Process Graph shape",
          accepts: ["json.model-graph.process"],
          lint: lintProcessGraph
        }
      ],
      pipelines: [
        {
          id: "view-indented-tree-as-process-graph",
          name: "View Indented Tree as Process Graph",
          inputLanguage: "text.indented-tree",
          category: "Graphs",
          menuPath: ["Graphs", "Process", "From Indented Tree"],
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-process-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "indented-tree-process-mermaid",
          name: "Indented Tree Process Mermaid",
          inputLanguage: "text.indented-tree",
          category: "Convert",
          menuPath: ["Convert", "Process", "Indented Tree to Mermaid"],
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-process-graph", params: {} },
            { use: "process-graph-to-mermaid", params: {} }
          ]
        },
        {
          id: "view-process-graph",
          name: "View Process Graph",
          inputLanguage: "json.model-graph.process",
          category: "Graphs",
          menuPath: ["Graphs", "Process", "Cytoscape"],
          steps: [
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "view-process-as-mermaid-svg",
          name: "View Process as Mermaid SVG",
          inputLanguage: "json.model-graph.process",
          category: "Preview",
          menuPath: ["Preview", "Process", "Mermaid SVG"],
          steps: [
            { use: "process-graph-to-mermaid", params: {} },
            { use: "mermaid-to-svg", params: {} },
            { use: "svg-preview", params: {} }
          ]
        },
        {
          id: "process-to-dot",
          name: "Process Graph to DOT",
          inputLanguage: "json.model-graph.process",
          category: "Convert",
          menuPath: ["Convert", "Process", "DOT"],
          steps: [
            { use: "process-graph-to-dot", params: {} }
          ]
        },
        {
          id: "process-role-activity-table",
          name: "Process Role Activity Table",
          inputLanguage: "json.model-graph.process",
          category: "Tables",
          menuPath: ["Tables", "Process", "Role Activity"],
          steps: [
            { use: "process-graph-to-role-activity-table", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "process-report",
          name: "Process Markdown Report",
          inputLanguage: "json.model-graph.process",
          category: "Reports",
          menuPath: ["Reports", "Process", "Markdown"],
          steps: [
            { use: "model-graph-to-markdown-report", params: {} }
          ]
        },
        {
          id: "export-process-bpmn",
          name: "Export Process as BPMN",
          inputLanguage: "json.model-graph.process",
          category: "Export",
          menuPath: ["Export", "Process", "BPMN"],
          steps: [
            { use: "process-graph-to-bpmn", params: {} },
            { use: "bpmn-source-export", params: {} }
          ]
        },
        {
          id: "view-bpmn-as-process-graph",
          name: "View BPMN as Process Graph",
          inputLanguage: "xml.bpmn",
          category: "Graphs",
          menuPath: ["Graphs", "BPMN", "Process Graph"],
          steps: [
            { use: "bpmn-to-process-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "bpmn-role-activity-table",
          name: "BPMN Role Activity Table",
          inputLanguage: "xml.bpmn",
          category: "Tables",
          menuPath: ["Tables", "BPMN", "Role Activity"],
          steps: [
            { use: "bpmn-to-process-graph", params: {} },
            { use: "process-graph-to-role-activity-table", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "bpmn-process-report",
          name: "BPMN Process Report",
          inputLanguage: "xml.bpmn",
          category: "Reports",
          menuPath: ["Reports", "BPMN", "Process"],
          steps: [
            { use: "bpmn-to-process-graph", params: {} },
            { use: "model-graph-to-markdown-report", params: {} }
          ]
        }
      ]
    }
  });
})(window);
