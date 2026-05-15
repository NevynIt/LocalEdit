(function (global) {
  "use strict";

  var CSV_RUNTIME_PATH = "plugins/csv/runtime/csv.bundle.js";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireCsvTools() {
    if (!global.EditorWorkbenchCsv || typeof global.EditorWorkbenchCsv.parse !== "function") {
      throw new Error("CSV runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCsv;
  }

  function requireIndentedTreeTools() {
    if (!global.EditorWorkbenchIndentedTree || typeof global.EditorWorkbenchIndentedTree.parse !== "function") {
      throw new Error("Indented Tree parser is not available.");
    }
    return global.EditorWorkbenchIndentedTree;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function jsonFileName(sourceName, suffix) {
    var baseName = sourceName || "untitled.json";
    return baseName.replace(/\.[^.]+$/, "") + (suffix || "") + ".json";
  }

  function csvFileName(sourceName) {
    var baseName = sourceName || "untitled.table.json";
    return baseName.replace(/\.[^.]+$/, "") + ".csv";
  }

  function parseJsonText(text) {
    return JSON.parse(text || "");
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

  function truncate(value, limit) {
    var text = String(value == null ? "" : value);
    return text.length <= limit ? text : text.slice(0, Math.max(0, limit - 3)) + "...";
  }

  function makeTreeDocument(root, metadata) {
    return {
      format: "json.tree",
      version: "1.0",
      root: root,
      metadata: metadata || {}
    };
  }

  function jsonValueToTree(label, value, path) {
    var kind = valueKind(value);
    var node = {
      id: path || "$",
      label: label,
      kind: kind,
      summary: describeValue(value)
    };

    if (value && typeof value === "object") {
      var keys = Array.isArray(value)
        ? value.map(function (_, index) { return index; })
        : Object.keys(value);
      node.children = keys.map(function (key) {
        return jsonValueToTree(String(key), value[key], (path || "$") + "/" + String(key).replace(/[^A-Za-z0-9_-]+/g, "-"));
      });
      return node;
    }

    node.value = value;
    node.valuePreview = truncate(describeValue(value), 160);
    return node;
  }

  function jsonToTree(input) {
    var value = parseJsonText(input.text || "");
    return {
      text: JSON.stringify(makeTreeDocument(jsonValueToTree("$", value, "$"), {
        sourceLanguage: input.languageId || "text.json"
      }), null, 2),
      languageId: "json.tree",
      fileName: jsonFileName(input.document && input.document.fileName, ".tree")
    };
  }

  function attributesToObject(node) {
    var attributes = {};
    if (!node || !node.attributes) {
      return attributes;
    }
    Array.from(node.attributes).forEach(function (attribute) {
      attributes[attribute.name] = attribute.value;
    });
    return attributes;
  }

  function xmlNodeToTree(node, counter) {
    if (!node) {
      return null;
    }

    if (node.nodeType === 9) {
      var documentChildren = Array.from(node.childNodes).map(function (child) {
        return xmlNodeToTree(child, counter);
      }).filter(Boolean);
      return {
        id: "xml-document",
        label: "document",
        kind: "document",
        summary: documentChildren.length + " child nodes",
        children: documentChildren
      };
    }

    counter.value += 1;
    var id = "xml-node-" + counter.value;
    if (node.nodeType === 1) {
      var children = Array.from(node.childNodes).map(function (child) {
        return xmlNodeToTree(child, counter);
      }).filter(Boolean);
      return {
        id: id,
        label: "<" + node.nodeName + ">",
        kind: "element",
        summary: node.nodeName,
        attributes: attributesToObject(node),
        children: children
      };
    }

    if (node.nodeType === 3) {
      var text = (node.nodeValue || "").trim();
      if (!text) {
        return null;
      }
      return {
        id: id,
        label: "text",
        kind: "text",
        summary: truncate(text, 120),
        value: text,
        valuePreview: truncate(text, 160)
      };
    }

    if (node.nodeType === 4) {
      return {
        id: id,
        label: "CDATA",
        kind: "cdata",
        summary: truncate(node.nodeValue || "", 120),
        value: node.nodeValue || "",
        valuePreview: truncate(node.nodeValue || "", 160)
      };
    }

    if (node.nodeType === 8) {
      return {
        id: id,
        label: "comment",
        kind: "comment",
        summary: truncate(node.nodeValue || "", 120),
        value: node.nodeValue || "",
        valuePreview: truncate(node.nodeValue || "", 160)
      };
    }

    if (node.nodeType === 7) {
      return {
        id: id,
        label: "instruction",
        kind: "instruction",
        summary: truncate(node.nodeName + " " + (node.nodeValue || ""), 120),
        value: node.nodeValue || "",
        valuePreview: truncate(node.nodeValue || "", 160)
      };
    }

    return null;
  }

  function parseXml(text) {
    var documentModel = new DOMParser().parseFromString(text || "", "application/xml");
    var parserError = documentModel.getElementsByTagName("parsererror")[0];
    if (parserError) {
      throw new Error((parserError.textContent || "XML parse error.").trim());
    }
    return documentModel;
  }

  function xmlToTree(input) {
    var parsed = parseXml(input.text || "");
    return {
      text: JSON.stringify(makeTreeDocument(xmlNodeToTree(parsed, { value: 0 }), {
        sourceLanguage: input.languageId || "text.xml",
        lossy: true
      }), null, 2),
      languageId: "json.tree",
      fileName: jsonFileName(input.document && input.document.fileName, ".tree")
    };
  }

  function parseIndentedTreeJson(text) {
    var value = parseJsonText(text || "");
    if (!value || value.format !== "indented-tree" || !Array.isArray(value.nodes)) {
      throw new Error("json.indented-tree requires an Indented Tree JSON document.");
    }
    return value;
  }

  function indentedTreeToJson(input) {
    var parsed = requireIndentedTreeTools().parse(input.text || "");
    return {
      text: JSON.stringify(parsed, null, 2),
      languageId: "json.indented-tree",
      fileName: jsonFileName(input.document && input.document.fileName, ".indented-tree"),
      diagnostics: parsed.diagnostics || []
    };
  }

  function indentedTreeJsonToTree(input) {
    var parsed = parseIndentedTreeJson(input.text || "");
    var byId = new Map();
    parsed.nodes.forEach(function (node) {
      byId.set(node.internalId, node);
    });

    function buildNode(node) {
      var metadata = {};
      if (node.id) {
        metadata.id = node.id;
      }
      if (node.type) {
        metadata.type = node.type;
      }
      if (node.tags && node.tags.length) {
        metadata.tags = node.tags;
      }
      if (node.attributes && Object.keys(node.attributes).length) {
        metadata.attributes = node.attributes;
      }
      if (node.details) {
        metadata.details = node.details;
      }

      return {
        id: node.internalId,
        label: node.label || node.internalId,
        kind: node.type || "node",
        summary: node.label || node.internalId,
        attributes: metadata,
        children: list(node.children).map(function (childId) {
          return buildNode(byId.get(childId));
        }).filter(Boolean)
      };
    }

    var rootChildren = list(parsed.roots).map(function (rootId) {
      return buildNode(byId.get(rootId));
    }).filter(Boolean);

    return {
      text: JSON.stringify(makeTreeDocument({
        id: "indented-tree-root",
        label: parsed.metadata && parsed.metadata.title ? String(parsed.metadata.title) : "Indented Tree",
        kind: "root",
        summary: rootChildren.length + " root nodes",
        children: rootChildren
      }, {
        sourceLanguage: "text.indented-tree",
        document: parsed.metadata || {}
      }), null, 2),
      languageId: "json.tree",
      fileName: jsonFileName(input.document && input.document.fileName, ".tree")
    };
  }

  function uniqueNodeIdCounts(parsed) {
    var counts = new Map();
    parsed.nodes.forEach(function (node) {
      if (node.id) {
        counts.set(node.id, (counts.get(node.id) || 0) + 1);
      }
    });
    return counts;
  }

  function indentedTreeJsonToModelGraph(input) {
    var parsed = parseIndentedTreeJson(input.text || "");
    var idCounts = uniqueNodeIdCounts(parsed);
    var nodeIdMap = new Map();
    var nodes = parsed.nodes.map(function (node) {
      var graphId = node.id && idCounts.get(node.id) === 1 ? node.id : node.internalId;
      nodeIdMap.set(node.internalId, graphId);
      return {
        id: graphId,
        label: node.label || graphId,
        type: node.type || "node",
        tags: list(node.tags),
        attributes: Object.assign({}, node.attributes || {}, {
          details: node.details || "",
          sourceLine: node.line || 0,
          declaredId: node.id || ""
        })
      };
    });

    var edges = [];
    parsed.nodes.forEach(function (node) {
      var targetId = nodeIdMap.get(node.internalId);
      if (node.parent && nodeIdMap.get(node.parent)) {
        edges.push({
          id: "contains-" + nodeIdMap.get(node.parent) + "-" + targetId,
          source: nodeIdMap.get(node.parent),
          target: targetId,
          type: "contains",
          label: "contains",
          kind: "hierarchy"
        });
      }
      list(node.links).forEach(function (link, index) {
        var linkedTarget = link && link.targetInternalId ? nodeIdMap.get(link.targetInternalId) : "";
        if (!linkedTarget) {
          return;
        }
        edges.push({
          id: "link-" + targetId + "-" + linkedTarget + "-" + index,
          source: targetId,
          target: linkedTarget,
          type: link.type || "related-to",
          label: link.type || "related-to",
          kind: "link"
        });
      });
    });

    return {
      text: JSON.stringify({
        format: "json.model-graph",
        version: "1.0",
        metadata: {
          sourceLanguage: "text.indented-tree",
          document: parsed.metadata || {}
        },
        nodes: nodes,
        edges: edges
      }, null, 2),
      languageId: "json.model-graph",
      fileName: jsonFileName(input.document && input.document.fileName, ".model-graph")
    };
  }

  function normalizeModelGraph(value) {
    if (!value || value.format !== "json.model-graph") {
      throw new Error("json.model-graph document must declare format: json.model-graph.");
    }
    return {
      metadata: value.metadata || {},
      nodes: list(value.nodes),
      edges: list(value.edges)
    };
  }

  function modelGraphToCytoscape(input) {
    var graph = normalizeModelGraph(parseJsonText(input.text || ""));
    var elements = {
      nodes: graph.nodes.map(function (node) {
        return {
          group: "nodes",
          data: {
            id: String(node.id || ""),
            label: String(node.label || node.id || ""),
            type: node.type || "",
            tags: list(node.tags),
            attributes: node.attributes || {}
          }
        };
      }).filter(function (node) {
        return Boolean(node.data.id);
      }),
      edges: graph.edges.map(function (edge, index) {
        return {
          group: "edges",
          data: {
            id: edge.id || "edge-" + index,
            source: String(edge.source || ""),
            target: String(edge.target || ""),
            kind: edge.kind || edge.type || "link",
            type: edge.type || "",
            label: edge.label || edge.type || ""
          }
        };
      }).filter(function (edge) {
        return edge.data.source && edge.data.target;
      })
    };

    return {
      text: JSON.stringify({
        format: "cytoscape-js-document",
        version: "1.0",
        metadata: graph.metadata,
        layout: {
          name: "breadthfirst",
          directed: true,
          animate: false,
          padding: 32,
          spacingFactor: 1.1
        },
        style: [],
        elements: elements
      }, null, 2),
      languageId: "json.cytoscape",
      fileName: jsonFileName(input.document && input.document.fileName, ".cy")
    };
  }

  function treeToCytoscape(input) {
    var tree = parseJsonText(input.text || "");
    if (!tree || tree.format !== "json.tree" || !tree.root) {
      throw new Error("json.tree document must declare format: json.tree and root.");
    }

    var nodes = [];
    var edges = [];
    function visit(node, parentId) {
      if (!node || !node.id) {
        return;
      }
      nodes.push({
        group: "nodes",
        data: {
          id: String(node.id),
          label: String(node.label || node.id),
          kind: node.kind || "",
          summary: node.summary || ""
        }
      });
      if (parentId) {
        edges.push({
          group: "edges",
          data: {
            id: "tree-" + parentId + "-" + node.id,
            source: String(parentId),
            target: String(node.id),
            kind: "hierarchy",
            type: "contains",
            label: "contains"
          }
        });
      }
      list(node.children).forEach(function (child) {
        visit(child, node.id);
      });
    }
    visit(tree.root, "");

    return {
      text: JSON.stringify({
        format: "cytoscape-js-document",
        version: "1.0",
        metadata: Object.assign({}, tree.metadata || {}, {
          sourceFormat: "json.tree",
          lossy: true
        }),
        layout: {
          name: "breadthfirst",
          directed: true,
          animate: false,
          padding: 32,
          spacingFactor: 1.1
        },
        style: [],
        elements: {
          nodes: nodes,
          edges: edges
        }
      }, null, 2),
      languageId: "json.cytoscape",
      fileName: jsonFileName(input.document && input.document.fileName, ".cy")
    };
  }

  function detectDelimiter(input) {
    var fileName = input.document && input.document.fileName ? input.document.fileName.toLowerCase() : "";
    if (fileName.endsWith(".tsv")) {
      return "\t";
    }
    var text = input.text || "";
    if (text.indexOf("\t") !== -1 && text.indexOf(",") === -1) {
      return "\t";
    }
    return ",";
  }

  async function csvToTable(input) {
    await requireRuntime(input.context).ensureScripts(CSV_RUNTIME_PATH);
    var result = requireCsvTools().parse(input.text || "", {
      delimiter: detectDelimiter(input)
    });
    var rows = list(result.data).filter(function (row) {
      return Array.isArray(row) && row.some(function (cell) {
        return String(cell == null ? "" : cell).trim() !== "";
      });
    });
    var columnCount = rows.reduce(function (max, row) {
      return Math.max(max, row.length);
    }, 0);
    var columns = [];
    for (var index = 0; index < columnCount; index += 1) {
      columns.push({
        id: "column-" + (index + 1),
        label: "Column " + (index + 1)
      });
    }
    return {
      text: JSON.stringify({
        format: "json.table",
        version: "1.0",
        metadata: {
          sourceLanguage: "text.csv",
          delimiter: detectDelimiter(input)
        },
        columns: columns,
        rows: rows.map(function (row, rowIndex) {
          return {
            id: "row-" + (rowIndex + 1),
            cells: columns.map(function (_, columnIndex) {
              return row[columnIndex] == null ? "" : String(row[columnIndex]);
            })
          };
        })
      }, null, 2),
      languageId: "json.table",
      fileName: jsonFileName(input.document && input.document.fileName, ".table"),
      diagnostics: list(result.errors).map(function (error) {
        return {
          source: "CSV",
          severity: "error",
          message: error && error.message ? error.message : "CSV parse error.",
          languageId: "text.csv"
        };
      })
    };
  }

  function renderTreeNode(node) {
    if (!node) {
      return "";
    }
    var children = list(node.children).map(renderTreeNode).join("");
    var meta = [];
    if (node.kind) {
      meta.push(node.kind);
    }
    if (node.summary && node.summary !== node.label) {
      meta.push(node.summary);
    }
    var attributes = node.attributes && Object.keys(node.attributes).length
      ? "<pre class=\"tree-details\">" + escapeHtml(JSON.stringify(node.attributes, null, 2)) + "</pre>"
      : "";
    if (children) {
      return [
        "<details open class=\"tree-node\">",
        "<summary><span class=\"tree-key\">" + escapeHtml(node.label || node.id) + "</span>",
        meta.length ? " <span class=\"tree-meta\">" + escapeHtml(meta.join(" - ")) + "</span>" : "",
        "</summary>",
        attributes,
        "<div class=\"tree-children\">" + children + "</div>",
        "</details>"
      ].join("");
    }
    return [
      "<div class=\"tree-leaf\">",
      "<span class=\"tree-key\">" + escapeHtml(node.label || node.id) + "</span>",
      meta.length ? "<span class=\"tree-meta\">" + escapeHtml(meta.join(" - ")) + "</span>" : "",
      node.valuePreview ? "<span class=\"tree-value\">" + escapeHtml(node.valuePreview) + "</span>" : "",
      attributes,
      "</div>"
    ].join("");
  }

  function renderTree(input) {
    var tree = parseJsonText(input.text || "");
    if (!tree || tree.format !== "json.tree" || !tree.root) {
      throw new Error("json.tree renderer requires a json.tree document.");
    }
    var style = [
      "<style>",
      ".tree-preview { display: grid; gap: 4px; font-family: Consolas, \"Courier New\", monospace; font-size: 13px; line-height: 1.45; max-height: calc(100vh - 32px); overflow: auto; }",
      ".tree-node summary { cursor: pointer; user-select: none; }",
      ".tree-children { margin-left: 18px; border-left: 1px solid var(--border, #cbd3df); padding-left: 10px; }",
      ".tree-leaf { display: flex; flex-wrap: wrap; gap: 8px; margin-left: 18px; min-width: 0; }",
      ".tree-key { color: var(--accent-strong, #0b5f59); font-weight: 700; }",
      ".tree-meta { color: var(--muted, #5d6b7c); }",
      ".tree-value { overflow-wrap: anywhere; }",
      ".tree-details { margin: 4px 0 6px 18px; color: var(--muted, #5d6b7c); white-space: pre-wrap; }",
      "</style>"
    ].join("\n");
    return {
      kind: "html",
      content: style + "<div class=\"tree-preview json-tree\">" + renderTreeNode(tree.root) + "</div>",
      mimeType: "text/html"
    };
  }

  function parseTable(input) {
    var table = parseJsonText(input.text || "");
    if (!table || table.format !== "json.table") {
      throw new Error("json.table renderer requires a json.table document.");
    }
    return table;
  }

  function renderTableHtml(table, firstRowAsHeader) {
    var columns = list(table.columns);
    var rows = list(table.rows);
    var bodyRows = firstRowAsHeader ? rows.slice(1) : rows;
    var headerRow = firstRowAsHeader && rows.length ? rows[0] : null;
    var head = "<thead><tr><th>#</th>" + columns.map(function (column, index) {
      var label = headerRow ? list(headerRow.cells)[index] : column.label || column.id || "Column " + (index + 1);
      return "<th>" + escapeHtml(label || "Column " + (index + 1)) + "</th>";
    }).join("") + "</tr></thead>";
    var body = bodyRows.map(function (row, rowIndex) {
      var sourceRowNumber = firstRowAsHeader ? rowIndex + 2 : rowIndex + 1;
      var cells = "<th>" + sourceRowNumber + "</th>" + columns.map(function (_, columnIndex) {
        return "<td>" + escapeHtml(list(row.cells)[columnIndex] == null ? "" : list(row.cells)[columnIndex]) + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("");
    return "<table class=\"json-table\"><caption>" + escapeHtml(table.metadata && table.metadata.title || "Table") + "</caption>" + head + "<tbody>" + body + "</tbody></table>";
  }

  function renderTable(input) {
    var table = parseTable(input);
    var style = [
      "<style>",
      ".table-viewer { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px; max-height: calc(100vh - 32px); min-height: 0; }",
      ".table-header-checkbox { align-self: center; margin: 0; }",
      ".table-viewer-options { align-self: center; color: var(--muted, #5d6b7c); cursor: pointer; font-size: 12px; font-weight: 700; }",
      ".table-wrap { grid-column: 1 / -1; max-width: 100%; max-height: calc(100vh - 88px); overflow: auto; border: 1px solid var(--border, #cbd3df); border-radius: 6px; background: var(--surface, #ffffff); }",
      ".table-header-table { display: none; }",
      ".table-header-checkbox:checked ~ .table-default-table { display: none; }",
      ".table-header-checkbox:checked ~ .table-header-table { display: block; }",
      ".json-table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 13px; }",
      ".json-table caption { padding: 6px 8px; color: var(--muted, #5d6b7c); text-align: left; font-weight: 700; }",
      ".json-table th, .json-table td { max-width: 360px; border: 1px solid var(--border, #cbd3df); padding: 6px 8px; text-align: left; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }",
      ".json-table th { position: sticky; top: 0; z-index: 1; background: var(--surface-strong, #eef1f5); color: var(--muted, #5d6b7c); font-weight: 700; }",
      ".json-table tbody th { left: 0; z-index: 2; }",
      "</style>"
    ].join("\n");
    return {
      kind: "html",
      content: [
        style,
        "<section class=\"table-viewer\">",
        "<input class=\"table-header-checkbox\" id=\"json-table-first-row-header\" type=\"checkbox\">",
        "<label class=\"table-viewer-options\" for=\"json-table-first-row-header\">Interpret first row as titles</label>",
        "<div class=\"table-wrap table-default-table\">" + renderTableHtml(table, false) + "</div>",
        "<div class=\"table-wrap table-header-table\">" + renderTableHtml(table, true) + "</div>",
        "</section>"
      ].join(""),
      mimeType: "text/html"
    };
  }

  function quoteCsvCell(value) {
    var text = String(value == null ? "" : value);
    if (/[",\r\n]/.test(text)) {
      return "\"" + text.replace(/"/g, "\"\"") + "\"";
    }
    return text;
  }

  function exportTableCsv(input) {
    var table = parseTable(input);
    var rows = list(table.rows).map(function (row) {
      return list(row.cells).map(quoteCsvCell).join(",");
    }).join("\n");
    return {
      fileName: csvFileName(input.document && input.document.fileName),
      mimeType: "text/csv",
      content: rows
    };
  }

  function exportJson(input) {
    var value = parseJsonText(input.text || "");
    return {
      fileName: jsonFileName(input.document && input.document.fileName),
      mimeType: "application/json",
      content: JSON.stringify(value, null, 2)
    };
  }

  function lintJsonFormat(input, expectedFormat, source) {
    try {
      var value = parseJsonText(input.text || "");
      if (expectedFormat && value.format !== expectedFormat) {
        return [{
          source: source,
          severity: "error",
          message: "Expected format: " + expectedFormat + ".",
          languageId: input.languageId
        }];
      }
      return [];
    } catch (error) {
      return [{
        source: source,
        severity: "error",
        message: error && error.message ? error.message : String(error),
        languageId: input.languageId
      }];
    }
  }

  global.EditorWorkbenchFoundation = {
    jsonToTree: jsonToTree,
    xmlToTree: xmlToTree,
    indentedTreeToJson: indentedTreeToJson,
    indentedTreeJsonToTree: indentedTreeJsonToTree,
    indentedTreeJsonToModelGraph: indentedTreeJsonToModelGraph,
    modelGraphToCytoscape: modelGraphToCytoscape,
    treeToCytoscape: treeToCytoscape,
    csvToTable: csvToTable,
    renderTree: renderTree,
    renderTable: renderTable
  };

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "foundation-dialects",
    name: "Foundation Dialects",
    version: "0.1.0",
    description: "Shared tree, table, model graph, and JSON dialect foundations.",
    contributes: {
      languages: [
        {
          id: "json.tree",
          name: "JSON Tree",
          parentLanguageId: "text.json",
          fileExtensions: [".tree.json"],
          mediaType: "application/json",
          description: "Reusable JSON tree dialect for structured previews."
        },
        {
          id: "json.table",
          name: "JSON Table",
          parentLanguageId: "text.json",
          fileExtensions: [".table.json"],
          mediaType: "application/json",
          description: "Reusable JSON table dialect for tabular previews and exports."
        },
        {
          id: "json.indented-tree",
          name: "Indented Tree JSON",
          parentLanguageId: "text.json",
          fileExtensions: [".indented-tree.json"],
          mediaType: "application/json",
          description: "Parsed Indented Tree document encoded as JSON."
        },
        {
          id: "json.model-graph",
          name: "JSON Model Graph",
          parentLanguageId: "text.json",
          fileExtensions: [".model-graph.json"],
          mediaType: "application/json",
          description: "Reusable semantic graph dialect."
        },
        {
          id: "json.openapi",
          name: "OpenAPI JSON",
          parentLanguageId: "text.json",
          fileExtensions: [".openapi.json"],
          mediaType: "application/vnd.oai.openapi+json",
          description: "OpenAPI documents normalized as JSON."
        }
      ],
      editors: [],
      editorExtensions: [],
      transformers: [
        {
          id: "json-to-tree",
          name: "JSON to Tree",
          inputLanguage: "text.json",
          outputLanguage: "json.tree",
          visibility: "internal",
          parameters: {},
          transform: jsonToTree
        },
        {
          id: "xml-to-tree",
          name: "XML to Tree",
          inputLanguage: "text.xml",
          outputLanguage: "json.tree",
          visibility: "internal",
          lossy: true,
          parameters: {},
          transform: xmlToTree
        },
        {
          id: "indented-tree-to-json",
          name: "Indented Tree to JSON",
          inputLanguage: "text.indented-tree",
          outputLanguage: "json.indented-tree",
          visibility: "internal",
          parameters: {},
          transform: indentedTreeToJson
        },
        {
          id: "indented-tree-json-to-tree",
          name: "Indented Tree JSON to Tree",
          inputLanguage: "json.indented-tree",
          outputLanguage: "json.tree",
          visibility: "internal",
          parameters: {},
          transform: indentedTreeJsonToTree
        },
        {
          id: "indented-tree-json-to-model-graph",
          name: "Indented Tree JSON to Model Graph",
          inputLanguage: "json.indented-tree",
          outputLanguage: "json.model-graph",
          visibility: "internal",
          parameters: {},
          transform: indentedTreeJsonToModelGraph
        },
        {
          id: "model-graph-to-cytoscape",
          name: "Model Graph to Cytoscape JSON",
          inputLanguage: "json.model-graph",
          outputLanguage: "json.cytoscape",
          visibility: "internal",
          parameters: {},
          transform: modelGraphToCytoscape
        },
        {
          id: "json-tree-to-cytoscape",
          name: "Tree to Cytoscape JSON",
          inputLanguage: "json.tree",
          outputLanguage: "json.cytoscape",
          visibility: "internal",
          lossy: true,
          parameters: {},
          transform: treeToCytoscape
        },
        {
          id: "csv-to-json-table",
          name: "CSV to JSON Table",
          inputLanguage: "text.csv",
          outputLanguage: "json.table",
          visibility: "internal",
          parameters: {},
          transform: csvToTable
        }
      ],
      renderers: [
        {
          id: "json-tree-renderer",
          name: "Tree Preview",
          accepts: ["json.tree"],
          outputKind: "html",
          parameters: {},
          render: renderTree
        },
        {
          id: "json-table-renderer",
          name: "Table Preview",
          accepts: ["json.table"],
          outputKind: "html",
          parameters: {},
          render: renderTable
        }
      ],
      exporters: [
        {
          id: "json-dialect-export",
          name: "JSON",
          accepts: ["text.json"],
          outputFileExtension: "json",
          mimeType: "application/json",
          parameters: {},
          export: exportJson
        },
        {
          id: "json-table-csv-export",
          name: "CSV",
          accepts: ["json.table"],
          outputFileExtension: "csv",
          mimeType: "text/csv",
          parameters: {},
          export: exportTableCsv
        }
      ],
      linters: [
        {
          id: "json-tree-linter",
          name: "JSON Tree shape",
          accepts: ["json.tree"],
          parameters: {},
          lint: function (input) {
            return lintJsonFormat(input, "json.tree", "JSON Tree");
          }
        },
        {
          id: "json-table-linter",
          name: "JSON Table shape",
          accepts: ["json.table"],
          parameters: {},
          lint: function (input) {
            return lintJsonFormat(input, "json.table", "JSON Table");
          }
        },
        {
          id: "json-model-graph-linter",
          name: "Model Graph shape",
          accepts: ["json.model-graph"],
          parameters: {},
          lint: function (input) {
            return lintJsonFormat(input, "json.model-graph", "Model Graph");
          }
        }
      ],
      pipelines: [
        {
          id: "view-json-as-tree",
          name: "View as Tree",
          inputLanguage: "text.json",
          steps: [
            { use: "json-to-tree", params: {} },
            { use: "json-tree-renderer", params: {} }
          ]
        },
        {
          id: "view-json-as-graph",
          name: "View as Graph",
          inputLanguage: "text.json",
          steps: [
            { use: "json-to-tree", params: {} },
            { use: "json-tree-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "view-xml-as-tree",
          name: "View as Tree",
          inputLanguage: "text.xml",
          steps: [
            { use: "xml-to-tree", params: {} },
            { use: "json-tree-renderer", params: {} }
          ]
        },
        {
          id: "view-csv-as-table",
          name: "View as Table",
          inputLanguage: "text.csv",
          steps: [
            { use: "csv-to-json-table", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "view-indented-tree-as-tree",
          name: "View as Tree",
          inputLanguage: "text.indented-tree",
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-tree", params: {} },
            { use: "json-tree-renderer", params: {} }
          ]
        },
        {
          id: "view-indented-tree-as-graph",
          name: "View as Graph",
          inputLanguage: "text.indented-tree",
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-model-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "export-indented-tree-json",
          name: "Export as Indented Tree JSON",
          inputLanguage: "text.indented-tree",
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "json-dialect-export", params: {} }
          ]
        },
        {
          id: "export-indented-tree-cytoscape-json",
          name: "Export as Cytoscape JSON",
          inputLanguage: "text.indented-tree",
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-model-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "json-dialect-export", params: {} }
          ]
        },
        {
          id: "export-csv-as-json-table",
          name: "Export as JSON Table",
          inputLanguage: "text.csv",
          steps: [
            { use: "csv-to-json-table", params: {} },
            { use: "json-dialect-export", params: {} }
          ]
        }
      ]
    }
  });
})(window);
