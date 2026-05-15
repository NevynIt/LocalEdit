(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function fileName(input, suffix, extension) {
    var sourceName = input && input.document && input.document.fileName || "document";
    return sourceName.replace(/\.[^.]+$/, "") + suffix + extension;
  }

  function sanitizeId(value, fallback) {
    var text = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return text || fallback;
  }

  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseIndentedTreeJson(text) {
    var value = parseJson(text || "");
    if (!value || value.format !== "indented-tree" || !Array.isArray(value.nodes)) {
      throw new Error("Expected json.indented-tree input.");
    }
    return value;
  }

  function makeTable(format, columns, rows, metadata) {
    return {
      format: "json.table",
      profile: format && format !== "json.table" ? format : undefined,
      version: "1.0",
      metadata: metadata || {},
      columns: columns.map(function (column, index) {
        return {
          id: sanitizeId(column, "column-" + (index + 1)),
          label: column || "Column " + (index + 1)
        };
      }),
      rows: rows.map(function (row, rowIndex) {
        return {
          id: "row-" + (rowIndex + 1),
          cells: columns.map(function (_, columnIndex) {
            return row[columnIndex] == null ? "" : String(row[columnIndex]);
          })
        };
      })
    };
  }

  function tableResult(input, format, columns, rows, suffix, metadata) {
    return {
      text: JSON.stringify(makeTable(format, columns, rows, metadata), null, 2),
      languageId: format || "json.table",
      fileName: fileName(input, suffix, ".json"),
      mimeType: "application/json"
    };
  }

  function makeTree(root, metadata) {
    return {
      format: "json.tree",
      version: "1.0",
      root: root,
      metadata: metadata || {}
    };
  }

  function markdownHeadings(text) {
    var headings = [];
    String(text || "").split(/\r?\n/).forEach(function (line, index) {
      var match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (match) {
        headings.push({
          level: match[1].length,
          title: match[2].replace(/\s+#+$/, "").trim(),
          line: index + 1
        });
      }
    });
    return headings;
  }

  function markdownToOutlineTree(input) {
    var headings = markdownHeadings(input.text || "");
    var root = {
      id: "markdown-outline",
      label: input.document && input.document.fileName || "Markdown Outline",
      kind: "document",
      summary: headings.length + " headings",
      children: []
    };
    var stack = [{ level: 0, node: root }];
    headings.forEach(function (heading, index) {
      while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }
      var id = sanitizeId(heading.title, "heading-" + (index + 1)) + "-" + heading.line;
      var node = {
        id: id,
        label: heading.title,
        kind: "heading-" + heading.level,
        summary: "line " + heading.line,
        attributes: {
          level: heading.level,
          line: heading.line
        },
        children: []
      };
      stack[stack.length - 1].node.children.push(node);
      stack.push({ level: heading.level, node: node });
    });
    return {
      text: JSON.stringify(makeTree(root, {
        sourceLanguage: "text.markdown"
      }), null, 2),
      languageId: "json.tree",
      fileName: fileName(input, ".outline.tree", ".json")
    };
  }

  function markdownToOutlineIndentedTree(input) {
    var headings = markdownHeadings(input.text || "");
    var lines = ["@title " + (input.document && input.document.fileName || "Markdown Outline")];
    headings.forEach(function (heading) {
      lines.push(new Array(heading.level).join("  ") + heading.title + " @heading level=" + heading.level + " line=" + heading.line);
    });
    return {
      text: lines.join("\n"),
      languageId: "text.indented-tree",
      fileName: fileName(input, ".outline", ".itt"),
      mimeType: "text/x-indented-tree"
    };
  }

  function parseMarkdownTableRow(line) {
    var value = String(line || "").trim();
    if (value.charAt(0) === "|") {
      value = value.slice(1);
    }
    if (value.charAt(value.length - 1) === "|") {
      value = value.slice(0, -1);
    }
    return value.split("|").map(function (cell) {
      return cell.trim();
    });
  }

  function isMarkdownTableSeparator(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || "");
  }

  function extractFirstMarkdownTable(text) {
    var lines = String(text || "").split(/\r?\n/);
    for (var index = 0; index < lines.length - 1; index += 1) {
      if (lines[index].indexOf("|") === -1 || !isMarkdownTableSeparator(lines[index + 1])) {
        continue;
      }
      var columns = parseMarkdownTableRow(lines[index]);
      var rows = [];
      var rowIndex = index + 2;
      while (rowIndex < lines.length && lines[rowIndex].indexOf("|") !== -1 && String(lines[rowIndex]).trim()) {
        rows.push(parseMarkdownTableRow(lines[rowIndex]));
        rowIndex += 1;
      }
      return {
        columns: columns,
        rows: rows,
        line: index + 1
      };
    }
    return null;
  }

  function markdownToFirstTable(input) {
    var table = extractFirstMarkdownTable(input.text || "");
    if (!table) {
      return tableResult(input, "json.table", ["Message"], [["No Markdown table found."]], ".table", {
        sourceLanguage: "text.markdown",
        empty: true
      });
    }
    return tableResult(input, "json.table", table.columns, table.rows, ".table", {
      sourceLanguage: "text.markdown",
      sourceLine: table.line
    });
  }

  function currentHeadingForLine(lines, lineIndex) {
    for (var index = lineIndex; index >= 0; index -= 1) {
      var match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
      if (match) {
        return match[2].replace(/\s+#+$/, "").trim();
      }
    }
    return "";
  }

  function markdownToActionList(input) {
    var lines = String(input.text || "").split(/\r?\n/);
    var rows = [];
    lines.forEach(function (line, index) {
      var match = /^\s*[-*+]\s+\[([ xX-])\]\s+(.+?)\s*$/.exec(line);
      if (!match) {
        return;
      }
      var body = match[2];
      var ownerMatch = /(?:^|\s)@([A-Za-z0-9_.-]+)/.exec(body);
      var dueMatch = /\b(?:due:?)\s*(\d{4}-\d{2}-\d{2})\b/i.exec(body) || /\b(\d{4}-\d{2}-\d{2})\b/.exec(body);
      var status = /x/i.test(match[1]) ? "Done" : (match[1] === "-" ? "Blocked" : "Open");
      rows.push([
        body.replace(/\s+@[A-Za-z0-9_.-]+/g, "").replace(/\s+due:?\s*\d{4}-\d{2}-\d{2}/ig, "").trim(),
        status,
        ownerMatch ? ownerMatch[1] : "",
        dueMatch ? dueMatch[1] : "",
        currentHeadingForLine(lines, index),
        String(index + 1)
      ]);
    });
    return tableResult(input, "json.table.action-list", ["Action", "Status", "Owner", "Due", "Section", "Line"], rows, ".actions.table", {
      sourceLanguage: "text.markdown"
    });
  }

  function indentedTreeJsonToActionList(input) {
    var parsed = parseIndentedTreeJson(input.text || "");
    var rows = parsed.nodes.filter(function (node) {
      return !node.children || node.children.length === 0 || list(node.tags).indexOf("action") !== -1 || list(node.tags).indexOf("todo") !== -1;
    }).map(function (node) {
      var attrs = node.attributes || {};
      var status = attrs.status || (list(node.tags).indexOf("done") !== -1 ? "Done" : "Open");
      return [
        node.label || node.id || node.internalId,
        status,
        attrs.owner || attrs.assignee || "",
        attrs.due || attrs.date || "",
        node.type || "",
        String(node.line || "")
      ];
    });
    return tableResult(input, "json.table.action-list", ["Action", "Status", "Owner", "Due", "Type", "Line"], rows, ".actions.table", {
      sourceLanguage: "json.indented-tree"
    });
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

  function opmlNodes(text) {
    var root = {
      label: "OPML",
      children: []
    };
    var stack = [root];
    var regex = /<\/outline\s*>|<outline\b([^>]*?)(\/?)>/gi;
    var match;
    while ((match = regex.exec(text || ""))) {
      var token = match[0];
      if (/^<\//.test(token)) {
        if (stack.length > 1) {
          stack.pop();
        }
        continue;
      }
      var attrs = parseAttributes(match[1] || "");
      var node = {
        label: attrs.text || attrs.title || attrs.name || "outline",
        attributes: attrs,
        children: []
      };
      stack[stack.length - 1].children.push(node);
      if (match[2] !== "/" && !/\/\s*>$/.test(token)) {
        stack.push(node);
      }
    }
    return root.children;
  }

  function opmlToIndentedTree(input) {
    var nodes = opmlNodes(input.text || "");
    var lines = ["@title OPML Outline"];
    function visit(node, depth) {
      var attrs = Object.keys(node.attributes || {}).filter(function (key) {
        return key !== "text" && key !== "title";
      }).map(function (key) {
        return key + "=" + JSON.stringify(node.attributes[key]);
      }).join(" ");
      lines.push(new Array(depth + 1).join("  ") + node.label + (attrs ? " " + attrs : ""));
      list(node.children).forEach(function (child) {
        visit(child, depth + 1);
      });
    }
    nodes.forEach(function (node) {
      visit(node, 0);
    });
    return {
      text: lines.join("\n"),
      languageId: "text.indented-tree",
      fileName: fileName(input, ".outline", ".itt"),
      mimeType: "text/x-indented-tree"
    };
  }

  function opmlToTree(input) {
    var counter = 0;
    function visit(node) {
      counter += 1;
      return {
        id: "opml-" + counter,
        label: node.label,
        kind: "outline",
        summary: node.attributes && node.attributes.type || "",
        attributes: node.attributes || {},
        children: list(node.children).map(visit)
      };
    }
    var children = opmlNodes(input.text || "").map(visit);
    return {
      text: JSON.stringify(makeTree({
        id: "opml-root",
        label: "OPML",
        kind: "document",
        summary: children.length + " root outlines",
        children: children
      }, {
        sourceLanguage: "xml.opml"
      }), null, 2),
      languageId: "json.tree",
      fileName: fileName(input, ".tree", ".json")
    };
  }

  function indentedTreeJsonToOpml(input) {
    var parsed = parseIndentedTreeJson(input.text || "");
    var byId = new Map();
    parsed.nodes.forEach(function (node) {
      byId.set(node.internalId, node);
    });
    function renderNode(node, depth) {
      var attrs = Object.assign({}, node.attributes || {});
      attrs.text = node.label || node.id || node.internalId;
      if (node.type) {
        attrs.type = node.type;
      }
      var indent = new Array(depth + 1).join("  ");
      var attrText = Object.keys(attrs).map(function (key) {
        return key + "=\"" + escapeXml(attrs[key]) + "\"";
      }).join(" ");
      var children = list(node.children).map(function (childId) {
        return renderNode(byId.get(childId), depth + 1);
      }).filter(Boolean);
      if (!children.length) {
        return indent + "<outline " + attrText + "/>";
      }
      return [indent + "<outline " + attrText + ">", children.join("\n"), indent + "</outline>"].join("\n");
    }
    var body = list(parsed.roots).map(function (rootId) {
      return renderNode(byId.get(rootId), 2);
    }).filter(Boolean).join("\n");
    var title = parsed.metadata && parsed.metadata.title || "Indented Tree";
    return {
      text: [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<opml version=\"2.0\">",
        "  <head>",
        "    <title>" + escapeXml(title) + "</title>",
        "  </head>",
        "  <body>",
        body,
        "  </body>",
        "</opml>"
      ].join("\n"),
      languageId: "xml.opml",
      fileName: fileName(input, "", ".opml"),
      mimeType: "text/x-opml"
    };
  }

  function tableToMarkdownReport(input) {
    var table = parseJson(input.text || "");
    var columns = list(table.columns).map(function (column, index) {
      return column.label || column.id || "Column " + (index + 1);
    });
    var rows = list(table.rows).map(function (row) {
      return list(row.cells);
    });
    var divider = columns.map(function () { return "---"; });
    var lines = [
      "# Table Report",
      "",
      "- Rows: " + rows.length,
      "- Columns: " + columns.length,
      "- Profile: " + (table.profile || input.languageId || "json.table"),
      "",
      "| " + columns.join(" | ") + " |",
      "| " + divider.join(" | ") + " |"
    ];
    rows.forEach(function (row) {
      lines.push("| " + columns.map(function (_, index) {
        return String(row[index] == null ? "" : row[index]).replace(/\|/g, "\\|");
      }).join(" | ") + " |");
    });
    return {
      text: lines.join("\n"),
      languageId: "text.markdown",
      fileName: fileName(input, ".report", ".md"),
      mimeType: "text/markdown"
    };
  }

  function modelGraphToMarkdownReport(input) {
    var graph = parseJson(input.text || "");
    var nodes = list(graph.nodes);
    var edges = list(graph.edges);
    var lines = [
      "# Model Graph Report",
      "",
      "- Nodes: " + nodes.length,
      "- Edges: " + edges.length,
      "- Profile: " + (graph.profile || input.languageId || "json.model-graph"),
      "",
      "## Nodes",
      "",
      "| ID | Label | Type |",
      "| --- | --- | --- |"
    ];
    nodes.forEach(function (node) {
      lines.push("| " + [node.id, node.label, node.type].map(function (value) {
        return String(value == null ? "" : value).replace(/\|/g, "\\|");
      }).join(" | ") + " |");
    });
    lines.push("", "## Edges", "", "| Source | Target | Type |", "| --- | --- | --- |");
    edges.forEach(function (edge) {
      lines.push("| " + [edge.source, edge.target, edge.type || edge.label].map(function (value) {
        return String(value == null ? "" : value).replace(/\|/g, "\\|");
      }).join(" | ") + " |");
    });
    return {
      text: lines.join("\n"),
      languageId: "text.markdown",
      fileName: fileName(input, ".graph-report", ".md"),
      mimeType: "text/markdown"
    };
  }

  function validateColumns(input, required, source) {
    try {
      var table = parseJson(input.text || "");
      var labels = list(table.columns).map(function (column) {
        return String(column.label || column.id || "").toLowerCase();
      });
      var missing = required.filter(function (name) {
        return labels.indexOf(name.toLowerCase()) === -1;
      });
      return missing.map(function (name) {
        return {
          source: source,
          severity: "warning",
          message: "Missing expected column: " + name + ".",
          languageId: input.languageId
        };
      });
    } catch (error) {
      return [{
        source: source,
        severity: "error",
        message: error && error.message ? error.message : String(error),
        languageId: input.languageId
      }];
    }
  }

  function exportOpml(input) {
    return {
      fileName: fileName(input, "", ".opml"),
      mimeType: "text/x-opml",
      content: input.text || ""
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "structured-docs",
    name: "Structured Docs",
    version: "0.1.0",
    description: "Structured Markdown extraction, business table profiles, OPML conversion, and Markdown reports.",
    contributes: {
      languages: [],
      editors: [],
      editorExtensions: [],
      transformers: [
        {
          id: "markdown-to-outline-tree",
          name: "Markdown Outline to Tree",
          inputLanguage: "text.markdown",
          outputLanguage: "json.tree",
          visibility: "internal",
          transform: markdownToOutlineTree
        },
        {
          id: "markdown-to-outline-indented-tree",
          name: "Markdown Outline to Indented Tree",
          inputLanguage: "text.markdown",
          outputLanguage: "text.indented-tree",
          visibility: "internal",
          transform: markdownToOutlineIndentedTree
        },
        {
          id: "markdown-to-json-table",
          name: "Markdown Table to JSON Table",
          inputLanguage: "text.markdown",
          outputLanguage: "json.table",
          visibility: "internal",
          transform: markdownToFirstTable
        },
        {
          id: "markdown-tasks-to-action-list",
          name: "Markdown Tasks to Action List",
          inputLanguage: "text.markdown",
          outputLanguage: "json.table.action-list",
          visibility: "internal",
          transform: markdownToActionList
        },
        {
          id: "indented-tree-json-to-action-list",
          name: "Indented Tree JSON to Action List",
          inputLanguage: "json.indented-tree",
          outputLanguage: "json.table.action-list",
          visibility: "internal",
          transform: indentedTreeJsonToActionList
        },
        {
          id: "opml-to-indented-tree",
          name: "OPML to Indented Tree",
          inputLanguage: "xml.opml",
          outputLanguage: "text.indented-tree",
          visibility: "internal",
          transform: opmlToIndentedTree
        },
        {
          id: "opml-to-tree",
          name: "OPML to Tree",
          inputLanguage: "xml.opml",
          outputLanguage: "json.tree",
          visibility: "internal",
          transform: opmlToTree
        },
        {
          id: "indented-tree-json-to-opml",
          name: "Indented Tree JSON to OPML",
          inputLanguage: "json.indented-tree",
          outputLanguage: "xml.opml",
          visibility: "internal",
          transform: indentedTreeJsonToOpml
        },
        {
          id: "json-table-to-markdown-report",
          name: "JSON Table to Markdown Report",
          inputLanguage: "json.table",
          outputLanguage: "text.markdown",
          visibility: "internal",
          transform: tableToMarkdownReport
        },
        {
          id: "model-graph-to-markdown-report",
          name: "Model Graph to Markdown Report",
          inputLanguage: "json.model-graph",
          outputLanguage: "text.markdown",
          visibility: "internal",
          transform: modelGraphToMarkdownReport
        }
      ],
      renderers: [],
      exporters: [
        {
          id: "opml-source-export",
          name: "OPML",
          accepts: ["xml.opml"],
          outputFileExtension: "opml",
          mimeType: "text/x-opml",
          category: "Export",
          menuPath: ["Export", "OPML"],
          export: exportOpml
        }
      ],
      linters: [
        {
          id: "action-list-table-linter",
          name: "Action List columns",
          accepts: ["json.table.action-list"],
          lint: function (input) {
            return validateColumns(input, ["Action", "Status"], "Action List");
          }
        },
        {
          id: "risk-register-table-linter",
          name: "Risk Register columns",
          accepts: ["json.table.risk-register"],
          lint: function (input) {
            return validateColumns(input, ["Risk", "Impact", "Likelihood", "Owner"], "Risk Register");
          }
        },
        {
          id: "traceability-matrix-linter",
          name: "Traceability Matrix columns",
          accepts: ["json.table.traceability-matrix"],
          lint: function (input) {
            return validateColumns(input, ["Source", "Target"], "Traceability Matrix");
          }
        }
      ],
      pipelines: [
        {
          id: "view-markdown-outline-as-tree",
          name: "View Markdown Outline as Tree",
          inputLanguage: "text.markdown",
          category: "Preview",
          menuPath: ["Preview", "Markdown", "Outline Tree"],
          steps: [
            { use: "markdown-to-outline-tree", params: {} },
            { use: "json-tree-renderer", params: {} }
          ]
        },
        {
          id: "view-markdown-table",
          name: "View Markdown Table",
          inputLanguage: "text.markdown",
          category: "Tables",
          menuPath: ["Tables", "Markdown", "First Table"],
          steps: [
            { use: "markdown-to-json-table", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "view-markdown-tasks-as-action-list",
          name: "View Markdown Tasks as Action List",
          inputLanguage: "text.markdown",
          category: "Tables",
          menuPath: ["Tables", "Markdown", "Tasks as Actions"],
          steps: [
            { use: "markdown-tasks-to-action-list", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "markdown-actions-report",
          name: "Markdown Tasks Report",
          inputLanguage: "text.markdown",
          category: "Reports",
          menuPath: ["Reports", "Markdown", "Tasks"],
          steps: [
            { use: "markdown-tasks-to-action-list", params: {} },
            { use: "json-table-to-markdown-report", params: {} }
          ]
        },
        {
          id: "convert-markdown-outline-to-opml",
          name: "Convert Markdown Outline to OPML",
          inputLanguage: "text.markdown",
          category: "Convert",
          menuPath: ["Convert", "Markdown", "Outline to OPML"],
          steps: [
            { use: "markdown-to-outline-indented-tree", params: {} },
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-opml", params: {} }
          ]
        },
        {
          id: "view-indented-tree-as-action-list",
          name: "View Indented Tree as Action List",
          inputLanguage: "text.indented-tree",
          category: "Tables",
          menuPath: ["Tables", "Indented Tree", "Action List"],
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-action-list", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "indented-tree-actions-report",
          name: "Indented Tree Actions Report",
          inputLanguage: "text.indented-tree",
          category: "Reports",
          menuPath: ["Reports", "Indented Tree", "Actions"],
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-action-list", params: {} },
            { use: "json-table-to-markdown-report", params: {} }
          ]
        },
        {
          id: "export-indented-tree-as-opml",
          name: "Export Indented Tree as OPML",
          inputLanguage: "text.indented-tree",
          category: "Export",
          menuPath: ["Export", "Indented Tree", "OPML"],
          steps: [
            { use: "indented-tree-to-json", params: {} },
            { use: "indented-tree-json-to-opml", params: {} },
            { use: "opml-source-export", params: {} }
          ]
        },
        {
          id: "convert-opml-to-indented-tree",
          name: "Convert OPML to Indented Tree",
          inputLanguage: "xml.opml",
          category: "Convert",
          menuPath: ["Convert", "OPML", "Indented Tree"],
          steps: [
            { use: "opml-to-indented-tree", params: {} }
          ]
        },
        {
          id: "view-opml-as-tree",
          name: "View OPML as Tree",
          inputLanguage: "xml.opml",
          category: "Preview",
          menuPath: ["Preview", "OPML", "Tree"],
          steps: [
            { use: "opml-to-tree", params: {} },
            { use: "json-tree-renderer", params: {} }
          ]
        },
        {
          id: "view-opml-as-mind-map",
          name: "View OPML as Mind Map",
          inputLanguage: "xml.opml",
          category: "Graphs",
          menuPath: ["Graphs", "OPML", "Mind Map"],
          steps: [
            { use: "opml-to-indented-tree", params: {} },
            { use: "indented-tree-to-jsmind-json", params: {} },
            { use: "jsmind-renderer", params: {} }
          ]
        },
        {
          id: "json-table-markdown-report",
          name: "Table Markdown Report",
          inputLanguage: "json.table",
          category: "Reports",
          menuPath: ["Reports", "Tables", "Markdown"],
          steps: [
            { use: "json-table-to-markdown-report", params: {} }
          ]
        },
        {
          id: "model-graph-markdown-report",
          name: "Model Graph Markdown Report",
          inputLanguage: "json.model-graph",
          category: "Reports",
          menuPath: ["Reports", "Graphs", "Markdown"],
          steps: [
            { use: "model-graph-to-markdown-report", params: {} }
          ]
        }
      ]
    }
  });
})(window);
