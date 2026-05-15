(function (global) {
  "use strict";

  var GEXF_LANGUAGE = "xml.gexf";
  var GEXF_MIME_TYPE = "application/gexf+xml";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function removeXmlControlChars(value) {
    return String(value == null ? "" : value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }

  function escapeXml(value) {
    return removeXmlControlChars(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function cleanBaseFileName(sourceName) {
    var name = String(sourceName || "graph").trim() || "graph";
    return name
      .replace(/\.(process|architecture|dependency|traceability)?\.?model-graph\.json$/i, "")
      .replace(/\.(tree|cy|cytoscape|jm|jsmind|openapi|table|profile|chart)\.json$/i, "")
      .replace(/\.(bpmn20\.xml|archimate\.xml|gexf|json|xml|yaml|yml|csv|tsv|dot|gv|mmd|mermaid|itt|opml|bpmn|archimate|js|py|txt)$/i, "");
  }

  function gexfFileName(input) {
    var sourceName = input && input.document && input.document.fileName || input && input.fileName || "graph";
    var baseName = cleanBaseFileName(sourceName);
    return (baseName || "graph") + ".gexf";
  }

  function cloneAttributes(value, reserved) {
    var result = {};
    if (!isPlainObject(value)) {
      return result;
    }
    Object.keys(value).forEach(function (key) {
      if (!reserved[key] && value[key] != null && value[key] !== "") {
        result[key] = value[key];
      }
    });
    return result;
  }

  function scalarValue(value) {
    if (value == null) {
      return "";
    }
    if (Array.isArray(value)) {
      return value.map(scalarValue).filter(Boolean).join(", ");
    }
    if (isPlainObject(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  function compactLabel(value, fallback) {
    var text = String(value == null ? "" : value).trim();
    return text || fallback || "";
  }

  function sanitizeFallbackId(value, fallback) {
    var text = String(value == null ? "" : value).trim();
    if (!text) {
      text = fallback || "node";
    }
    return text.replace(/[\s]+/g, "-");
  }

  function attrValueType(value) {
    if (typeof value === "boolean") {
      return "boolean";
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return Number.isInteger(value) ? "integer" : "double";
    }
    return "string";
  }

  function mergeAttrType(current, next) {
    if (!current) {
      return next;
    }
    if (current === next) {
      return current;
    }
    if ((current === "integer" && next === "double") || (current === "double" && next === "integer")) {
      return "double";
    }
    return "string";
  }

  function sanitizeAttributeId(className, key, index) {
    var text = String(key || "").trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!text || /^[0-9]/.test(text)) {
      text = "attr_" + (index + 1);
    }
    return className + "_" + text;
  }

  function collectAttributeDefinitions(items, className) {
    var keys = new Map();
    list(items).forEach(function (item) {
      var attrs = isPlainObject(item.attributes) ? item.attributes : {};
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value == null || value === "") {
          return;
        }
        var entry = keys.get(key) || {
          key: key,
          title: key,
          type: ""
        };
        entry.type = mergeAttrType(entry.type, attrValueType(value));
        keys.set(key, entry);
      });
    });

    return Array.from(keys.values()).sort(function (a, b) {
      return a.title.localeCompare(b.title);
    }).map(function (entry, index) {
      return Object.assign({}, entry, {
        id: sanitizeAttributeId(className, entry.key, index),
        type: entry.type || "string"
      });
    });
  }

  function renderAttributeDefinitions(definitions, className, indent) {
    if (!definitions.length) {
      return [];
    }
    var lines = [indent + "<attributes class=\"" + className + "\">"];
    definitions.forEach(function (definition) {
      lines.push(
        indent + "  <attribute id=\"" + escapeXml(definition.id) + "\" title=\"" + escapeXml(definition.title) + "\" type=\"" + escapeXml(definition.type) + "\"/>"
      );
    });
    lines.push(indent + "</attributes>");
    return lines;
  }

  function renderAttValues(attributes, definitions, indent) {
    var lines = [];
    definitions.forEach(function (definition) {
      if (!Object.prototype.hasOwnProperty.call(attributes, definition.key)) {
        return;
      }
      var value = attributes[definition.key];
      if (value == null || value === "") {
        return;
      }
      lines.push(
        indent + "  <attvalue for=\"" + escapeXml(definition.id) + "\" value=\"" + escapeXml(scalarValue(value)) + "\"/>"
      );
    });
    if (!lines.length) {
      return [];
    }
    return [indent + "<attvalues>"].concat(lines, [indent + "</attvalues>"]);
  }

  function buildNormalizedGraph(rawGraph) {
    var nodes = [];
    var edges = [];
    var idMap = new Map();
    var usedIds = new Set();

    function makeUniqueId(rawId, fallback) {
      var base = sanitizeFallbackId(rawId, fallback);
      var candidate = base;
      var suffix = 2;
      while (usedIds.has(candidate)) {
        candidate = base + "-" + suffix;
        suffix += 1;
      }
      usedIds.add(candidate);
      return candidate;
    }

    function addNode(rawNode, fallback) {
      var originalId = rawNode && rawNode.id != null ? String(rawNode.id) : "";
      if (originalId && idMap.has(originalId)) {
        return idMap.get(originalId);
      }
      var id = makeUniqueId(originalId, fallback || "node-" + (nodes.length + 1));
      var label = compactLabel(rawNode && rawNode.label, originalId || id);
      var attributes = cloneAttributes(rawNode && rawNode.attributes, {});
      if (rawNode && rawNode.type) {
        attributes.type = rawNode.type;
      }
      if (rawNode && rawNode.kind) {
        attributes.kind = rawNode.kind;
      }
      if (rawNode && rawNode.tags) {
        attributes.tags = rawNode.tags;
      }
      if (rawNode && rawNode.source) {
        attributes.source = rawNode.source;
      }
      nodes.push({
        id: id,
        label: label,
        attributes: attributes
      });
      if (originalId) {
        idMap.set(originalId, id);
      }
      return id;
    }

    function endpointId(rawValue) {
      var originalId = String(rawValue == null ? "" : rawValue).trim();
      if (!originalId) {
        return "";
      }
      if (idMap.has(originalId)) {
        return idMap.get(originalId);
      }
      return addNode({
        id: originalId,
        label: originalId,
        attributes: {
          inferred: true
        }
      }, originalId);
    }

    list(rawGraph.nodes).forEach(function (rawNode, index) {
      addNode(rawNode || {}, "node-" + (index + 1));
    });

    list(rawGraph.edges).forEach(function (rawEdge, index) {
      var source = endpointId(rawEdge && rawEdge.source);
      var target = endpointId(rawEdge && rawEdge.target);
      if (!source || !target) {
        return;
      }
      var attributes = cloneAttributes(rawEdge && rawEdge.attributes, {});
      if (rawEdge && rawEdge.type) {
        attributes.relationship_type = rawEdge.type;
      }
      if (rawEdge && rawEdge.kind) {
        attributes.kind = rawEdge.kind;
      }
      if (rawEdge && rawEdge.label) {
        attributes.label = rawEdge.label;
      }
      edges.push({
        id: rawEdge && rawEdge.id ? String(rawEdge.id) : "edge-" + (index + 1),
        source: source,
        target: target,
        label: compactLabel(rawEdge && rawEdge.label, rawEdge && rawEdge.type || ""),
        directed: rawEdge && rawEdge.directed === false ? false : true,
        weight: rawEdge && rawEdge.weight,
        attributes: attributes
      });
    });

    return {
      metadata: rawGraph.metadata || {},
      nodes: nodes,
      edges: edges
    };
  }

  function buildGexf(rawGraph) {
    var graph = buildNormalizedGraph(rawGraph);
    var nodeAttributes = collectAttributeDefinitions(graph.nodes, "node");
    var edgeAttributes = collectAttributeDefinitions(graph.edges, "edge");
    var hasUndirected = graph.edges.some(function (edge) {
      return edge.directed === false;
    });
    var hasDirected = graph.edges.some(function (edge) {
      return edge.directed !== false;
    });
    var defaultEdgeType = hasUndirected && !hasDirected ? "undirected" : "directed";
    var description = graph.metadata.description || graph.metadata.title || "Converted by LocalEdit.";
    var lines = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<gexf xmlns=\"http://gexf.net/1.3\" xmlns:viz=\"http://gexf.net/1.3/viz\" version=\"1.3\">",
      "  <meta>",
      "    <creator>LocalEdit</creator>",
      "    <description>" + escapeXml(description) + "</description>",
      "  </meta>",
      "  <graph mode=\"static\" defaultedgetype=\"" + defaultEdgeType + "\">"
    ];

    lines = lines.concat(renderAttributeDefinitions(nodeAttributes, "node", "    "));
    lines = lines.concat(renderAttributeDefinitions(edgeAttributes, "edge", "    "));
    lines.push("    <nodes>");
    graph.nodes.forEach(function (node) {
      var header = "      <node id=\"" + escapeXml(node.id) + "\" label=\"" + escapeXml(node.label || node.id) + "\"";
      var attValues = renderAttValues(node.attributes || {}, nodeAttributes, "        ");
      if (!attValues.length) {
        lines.push(header + "/>");
        return;
      }
      lines.push(header + ">");
      lines = lines.concat(attValues);
      lines.push("      </node>");
    });
    lines.push("    </nodes>");
    lines.push("    <edges>");
    graph.edges.forEach(function (edge) {
      var header = "      <edge id=\"" + escapeXml(edge.id) + "\" source=\"" + escapeXml(edge.source) + "\" target=\"" + escapeXml(edge.target) + "\"";
      if (edge.label) {
        header += " label=\"" + escapeXml(edge.label) + "\"";
      }
      if (edge.directed === false && defaultEdgeType !== "undirected") {
        header += " type=\"undirected\"";
      } else if (edge.directed !== false && defaultEdgeType !== "directed") {
        header += " type=\"directed\"";
      }
      if (edge.weight != null && edge.weight !== "" && Number.isFinite(Number(edge.weight))) {
        header += " weight=\"" + escapeXml(Number(edge.weight)) + "\"";
      }
      var attValues = renderAttValues(edge.attributes || {}, edgeAttributes, "        ");
      if (!attValues.length) {
        lines.push(header + "/>");
        return;
      }
      lines.push(header + ">");
      lines = lines.concat(attValues);
      lines.push("      </edge>");
    });
    lines.push("    </edges>");
    lines.push("  </graph>");
    lines.push("</gexf>");
    return lines.join("\n");
  }

  function toTransformResult(input, rawGraph) {
    return {
      text: buildGexf(rawGraph),
      languageId: GEXF_LANGUAGE,
      fileName: gexfFileName(input),
      mimeType: GEXF_MIME_TYPE
    };
  }

  function modelGraphToRawGraph(input) {
    var value = parseJson(input.text || "");
    if (!value || value.format !== "json.model-graph") {
      throw new Error("Expected json.model-graph input.");
    }
    return {
      metadata: Object.assign({}, value.metadata || {}, {
        title: value.metadata && value.metadata.title || value.profile && value.profile + " graph" || "Model graph",
        profile: value.profile || ""
      }),
      nodes: list(value.nodes).map(function (node) {
        return {
          id: node && node.id,
          label: node && (node.label || node.name || node.id),
          type: node && node.type,
          tags: node && node.tags,
          attributes: Object.assign({}, node && node.attributes || {})
        };
      }),
      edges: list(value.edges).map(function (edge, index) {
        return {
          id: edge && (edge.id || "edge-" + (index + 1)),
          source: edge && edge.source,
          target: edge && edge.target,
          label: edge && (edge.label || edge.type || edge.kind || ""),
          type: edge && edge.type,
          kind: edge && edge.kind,
          weight: edge && edge.weight,
          attributes: Object.assign({}, edge && edge.attributes || {})
        };
      })
    };
  }

  function modelGraphToGexf(input) {
    return toTransformResult(input, modelGraphToRawGraph(input));
  }

  function normalizeCytoscapeElements(value) {
    var source = value;
    if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, "elements")) {
      source = value.elements;
    }
    var nodes = [];
    var edges = [];

    function addElement(element) {
      if (!isPlainObject(element)) {
        return;
      }
      var data = isPlainObject(element.data) ? element.data : element;
      var isEdge = element.group === "edges" || data.source != null || data.target != null;
      if (isEdge) {
        edges.push({
          id: data.id,
          source: data.source,
          target: data.target,
          label: data.label || data.name || data.type || "",
          type: data.type,
          kind: data.kind,
          weight: data.weight,
          attributes: cloneAttributes(data, {
            id: true,
            source: true,
            target: true,
            label: true,
            name: true,
            type: true,
            kind: true,
            weight: true
          })
        });
        return;
      }
      nodes.push({
        id: data.id,
        label: data.label || data.name || data.id,
        type: data.type,
        kind: data.kind,
        tags: data.tags,
        attributes: cloneAttributes(data, {
          id: true,
          label: true,
          name: true,
          type: true,
          kind: true,
          tags: true
        })
      });
    }

    if (Array.isArray(source)) {
      source.forEach(addElement);
    } else if (isPlainObject(source)) {
      list(source.nodes).forEach(addElement);
      list(source.edges).forEach(addElement);
    }

    return {
      metadata: isPlainObject(value) && isPlainObject(value.metadata) ? value.metadata : {
        title: "Cytoscape graph"
      },
      nodes: nodes,
      edges: edges
    };
  }

  function cytoscapeToGexf(input) {
    return toTransformResult(input, normalizeCytoscapeElements(parseJson(input.text || "")));
  }

  function treeToRawGraph(input) {
    var value = parseJson(input.text || "");
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
      nodes.push({
        id: nodeId,
        label: node.label || nodeId,
        type: node.kind || "node",
        attributes: {
          kind: node.kind || "",
          summary: node.summary || ""
        }
      });
      if (parentId) {
        edges.push({
          id: "contains-" + parentId + "-" + nodeId,
          source: parentId,
          target: nodeId,
          label: "contains",
          type: "contains",
          kind: "hierarchy"
        });
      }
      list(node.children).forEach(function (child) {
        visit(child, nodeId);
      });
    }
    visit(value.root, "");
    return {
      metadata: Object.assign({}, value.metadata || {}, {
        title: value.metadata && value.metadata.title || "Tree graph"
      }),
      nodes: nodes,
      edges: edges
    };
  }

  function treeToGexf(input) {
    return toTransformResult(input, treeToRawGraph(input));
  }

  function jsmindToRawGraph(input) {
    var value = parseJson(input.text || "");
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
      nodes.push({
        id: nodeId,
        label: node.topic || nodeId,
        type: "mind-map-node",
        attributes: {
          direction: node.direction || "",
          expanded: node.expanded != null ? Boolean(node.expanded) : ""
        }
      });
      if (parentId) {
        edges.push({
          id: "mind-" + parentId + "-" + nodeId,
          source: parentId,
          target: nodeId,
          label: "contains",
          type: "contains",
          kind: "hierarchy"
        });
      }
      list(node.children).forEach(function (child) {
        visit(child, nodeId);
      });
    }
    visit(value.data, "");
    return {
      metadata: {
        title: value.meta && value.meta.name || "jsMind graph",
        sourceLanguage: "json.jsmind"
      },
      nodes: nodes,
      edges: edges
    };
  }

  function jsmindToGexf(input) {
    return toTransformResult(input, jsmindToRawGraph(input));
  }

  function decodeQuoted(value) {
    var text = String(value || "").trim();
    if ((text.charAt(0) === "\"" && text.charAt(text.length - 1) === "\"") || (text.charAt(0) === "'" && text.charAt(text.length - 1) === "'")) {
      text = text.slice(1, -1);
    }
    return text.replace(/\\"/g, "\"").replace(/\\'/g, "'");
  }

  function parseAttributeBlock(block) {
    var attrs = {};
    var regex = /([A-Za-z_][\w.-]*)\s*=\s*("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^,\]\s]+)/g;
    var match;
    while ((match = regex.exec(block || ""))) {
      attrs[match[1]] = decodeQuoted(match[2]);
    }
    return attrs;
  }

  function splitDotStatements(text) {
    var cleaned = String(text || "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "")
      .replace(/^\s*#.*$/gm, "");
    var statements = [];
    var current = "";
    var quote = "";
    var bracketDepth = 0;
    for (var index = 0; index < cleaned.length; index += 1) {
      var character = cleaned.charAt(index);
      if (quote) {
        current += character;
        if (character === "\\" && index + 1 < cleaned.length) {
          current += cleaned.charAt(index + 1);
          index += 1;
          continue;
        }
        if (character === quote) {
          quote = "";
        }
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        current += character;
        continue;
      }
      if (character === "[") {
        bracketDepth += 1;
      } else if (character === "]" && bracketDepth > 0) {
        bracketDepth -= 1;
      }
      if ((character === ";" || character === "\n") && bracketDepth === 0) {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = "";
        continue;
      }
      current += character;
    }
    if (current.trim()) {
      statements.push(current.trim());
    }
    return statements;
  }

  function trimDotGraphSyntax(statement) {
    return statement
      .replace(/^\s*(strict\s+)?(di)?graph\b[^{]*\{/i, "")
      .replace(/\}\s*$/g, "")
      .trim();
  }

  function extractDotAttributes(statement) {
    var body = trimDotGraphSyntax(statement);
    var attrMatch = /\[([\s\S]*)\]\s*$/.exec(body);
    if (!attrMatch) {
      return {
        body: body,
        attributes: {}
      };
    }
    return {
      body: body.slice(0, attrMatch.index).trim(),
      attributes: parseAttributeBlock(attrMatch[1])
    };
  }

  function dotId(token) {
    var text = decodeQuoted(String(token || "").trim());
    if (!text || /^[{}\[\]]+$/.test(text)) {
      return "";
    }
    return text.replace(/^\{|\}$/g, "").trim();
  }

  function graphvizToRawGraph(input) {
    var text = input.text || "";
    var directedByDefault = /\bdigraph\b/i.test(text) || text.indexOf("->") !== -1;
    var nodesById = new Map();
    var edges = [];

    function ensureNode(id, attrs) {
      if (!id || /^(graph|node|edge)$/i.test(id)) {
        return;
      }
      var existing = nodesById.get(id) || {
        id: id,
        label: attrs && attrs.label || id,
        type: "dot-node",
        attributes: {}
      };
      if (attrs) {
        existing.label = attrs.label || existing.label;
        existing.attributes = Object.assign(existing.attributes || {}, cloneAttributes(attrs, {
          label: true
        }));
      }
      nodesById.set(id, existing);
    }

    splitDotStatements(text).forEach(function (statement) {
      var parsed = extractDotAttributes(statement);
      var body = parsed.body;
      if (!body || /^(graph|node|edge)\b/i.test(body) || body.indexOf("=") !== -1 && body.indexOf("->") === -1 && body.indexOf("--") === -1) {
        return;
      }
      var operator = body.indexOf("->") !== -1 ? "->" : (body.indexOf("--") !== -1 ? "--" : "");
      if (operator) {
        var parts = body.split(/\s*(?:->|--)\s*/).map(dotId).filter(Boolean);
        for (var index = 0; index < parts.length - 1; index += 1) {
          ensureNode(parts[index], null);
          ensureNode(parts[index + 1], null);
          edges.push({
            id: parsed.attributes.id || "dot-edge-" + (edges.length + 1),
            source: parts[index],
            target: parts[index + 1],
            label: parsed.attributes.label || "",
            type: parsed.attributes.type || "dot-edge",
            kind: operator === "--" ? "undirected" : "directed",
            weight: parsed.attributes.weight,
            directed: operator !== "--",
            attributes: cloneAttributes(parsed.attributes, {
              id: true,
              label: true,
              type: true,
              weight: true
            })
          });
        }
        return;
      }
      var id = dotId(body);
      ensureNode(id, parsed.attributes);
    });

    return {
      metadata: {
        title: "Graphviz DOT graph",
        sourceLanguage: "text.graphviz-dot",
        lossy: true
      },
      defaultEdgeType: directedByDefault ? "directed" : "undirected",
      nodes: Array.from(nodesById.values()),
      edges: edges
    };
  }

  function graphvizToGexf(input) {
    return toTransformResult(input, graphvizToRawGraph(input));
  }

  function normalizeMermaidLabel(value) {
    var text = String(value || "").trim();
    if ((text.charAt(0) === "\"" && text.charAt(text.length - 1) === "\"") || (text.charAt(0) === "'" && text.charAt(text.length - 1) === "'")) {
      return text.slice(1, -1);
    }
    return text;
  }

  function mermaidNodeToken(token) {
    var text = String(token || "").trim().replace(/:::[A-Za-z0-9_-]+$/, "").trim();
    var idMatch = /^([A-Za-z0-9_:-]+)/.exec(text);
    var id = idMatch ? idMatch[1] : sanitizeFallbackId(text, "node");
    var rest = idMatch ? text.slice(id.length) : "";
    var label = "";
    var labelMatch = /[\[\(\{]+([^)\]\}]+)[\]\)\}]+/.exec(rest);
    if (labelMatch) {
      label = normalizeMermaidLabel(labelMatch[1]);
    }
    return {
      id: id,
      label: label || id
    };
  }

  function parseMermaidEdge(line) {
    var patterns = [
      { regex: /^(.+?)\s*-->\|([^|]*)\|\s*(.+)$/, directed: true, labelIndex: 2 },
      { regex: /^(.+?)\s*--\s*([^->]+?)\s*-->\s*(.+)$/, directed: true, labelIndex: 2 },
      { regex: /^(.+?)\s*-->\s*(.+)$/, directed: true },
      { regex: /^(.+?)\s*-\.-?>\|([^|]*)\|\s*(.+)$/, directed: true, labelIndex: 2 },
      { regex: /^(.+?)\s*-\.\s*([^-.]+?)\s*\.->\s*(.+)$/, directed: true, labelIndex: 2 },
      { regex: /^(.+?)\s*-\.-?>\s*(.+)$/, directed: true },
      { regex: /^(.+?)\s*==>\|([^|]*)\|\s*(.+)$/, directed: true, labelIndex: 2 },
      { regex: /^(.+?)\s*==\s*([^=>]+?)\s*==>\s*(.+)$/, directed: true, labelIndex: 2 },
      { regex: /^(.+?)\s*==>\s*(.+)$/, directed: true },
      { regex: /^(.+?)\s*---\|([^|]*)\|\s*(.+)$/, directed: false, labelIndex: 2 },
      { regex: /^(.+?)\s*---\s*(.+)$/, directed: false },
      { regex: /^(.+?)\s*->\s*(.+)$/, directed: true }
    ];
    for (var index = 0; index < patterns.length; index += 1) {
      var pattern = patterns[index];
      var match = pattern.regex.exec(line);
      if (!match) {
        continue;
      }
      return {
        source: mermaidNodeToken(match[1]),
        target: mermaidNodeToken(pattern.labelIndex ? match[3] : match[2]),
        label: pattern.labelIndex ? normalizeMermaidLabel(match[2]) : "",
        directed: pattern.directed
      };
    }
    return null;
  }

  function mermaidToRawGraph(input) {
    var nodesById = new Map();
    var edges = [];

    function ensureNode(node) {
      if (!node || !node.id) {
        return;
      }
      if (!nodesById.has(node.id)) {
        nodesById.set(node.id, {
          id: node.id,
          label: node.label || node.id,
          type: "mermaid-node",
          attributes: {}
        });
      } else if (node.label && node.label !== node.id) {
        nodesById.get(node.id).label = node.label;
      }
    }

    String(input.text || "").split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.replace(/%%.*$/, "").trim();
      if (!line || /^(flowchart|graph)\b/i.test(line) || /^subgraph\b/i.test(line) || /^end$/i.test(line)) {
        return;
      }
      var edge = parseMermaidEdge(line);
      if (edge) {
        ensureNode(edge.source);
        ensureNode(edge.target);
        edges.push({
          id: "mermaid-edge-" + (edges.length + 1),
          source: edge.source.id,
          target: edge.target.id,
          label: edge.label,
          type: edge.directed ? "flow" : "association",
          kind: "mermaid-flowchart",
          directed: edge.directed
        });
        return;
      }
      if (/^[A-Za-z0-9_:-]+[\[\(\{]/.test(line)) {
        ensureNode(mermaidNodeToken(line));
      }
    });

    return {
      metadata: {
        title: "Mermaid flowchart graph",
        sourceLanguage: "text.mermaid",
        lossy: true
      },
      nodes: Array.from(nodesById.values()),
      edges: edges
    };
  }

  function mermaidToGexf(input) {
    return toTransformResult(input, mermaidToRawGraph(input));
  }

  function lintGexf(input) {
    var text = input.text || "";
    var diagnostics = [];
    if (!/<gexf\b/i.test(text)) {
      diagnostics.push({
        source: "Gephi GEXF",
        severity: "error",
        message: "GEXF document must contain a <gexf> root element.",
        languageId: input.languageId
      });
    }
    if (!/<graph\b/i.test(text)) {
      diagnostics.push({
        source: "Gephi GEXF",
        severity: "error",
        message: "GEXF document must contain a <graph> element.",
        languageId: input.languageId
      });
    }
    if (!/<node\b/i.test(text)) {
      diagnostics.push({
        source: "Gephi GEXF",
        severity: "warning",
        message: "No GEXF nodes were found.",
        languageId: input.languageId
      });
    }
    var edgeRegex = /<edge\b([^>]*)>/gi;
    var match;
    while ((match = edgeRegex.exec(text))) {
      if (!/\bsource\s*=/.test(match[1] || "") || !/\btarget\s*=/.test(match[1] || "")) {
        diagnostics.push({
          source: "Gephi GEXF",
          severity: "error",
          message: "Each GEXF edge must declare source and target attributes.",
          languageId: input.languageId
        });
        break;
      }
    }
    return diagnostics;
  }

  function exportGexf(input) {
    return {
      fileName: gexfFileName(input),
      mimeType: GEXF_MIME_TYPE,
      content: input.text || ""
    };
  }

  function pipeline(id, name, inputLanguage, steps, menuGroup, menuLeaf) {
    return {
      id: id,
      name: name,
      inputLanguage: inputLanguage,
      category: "Convert",
      menuPath: ["Convert", "Gephi GEXF", menuGroup || menuLeaf || name],
      steps: steps.map(function (step) {
        return typeof step === "string" ? { use: step, params: {} } : step;
      })
    };
  }

  var pipelines = [
    pipeline("convert-model-graph-to-gephi-gexf", "Model Graph to Gephi GEXF", "json.model-graph", [
      "model-graph-to-gephi-gexf"
    ], "Model Graph"),
    pipeline("convert-cytoscape-to-gephi-gexf", "Cytoscape JSON to Gephi GEXF", "json.cytoscape", [
      "cytoscape-to-gephi-gexf"
    ], "Cytoscape"),
    pipeline("convert-json-tree-to-gephi-gexf", "JSON Tree to Gephi GEXF", "json.tree", [
      "json-tree-to-gephi-gexf"
    ], "Tree"),
    pipeline("convert-jsmind-to-gephi-gexf", "jsMind to Gephi GEXF", "json.jsmind", [
      "jsmind-to-gephi-gexf"
    ], "Mind Map"),
    pipeline("convert-graphviz-to-gephi-gexf", "Graphviz DOT to Gephi GEXF", "text.graphviz-dot", [
      "graphviz-to-gephi-gexf"
    ], "Graphviz DOT"),
    pipeline("convert-mermaid-flowchart-to-gephi-gexf", "Mermaid Flowchart to Gephi GEXF", "text.mermaid", [
      "mermaid-flowchart-to-gephi-gexf"
    ], "Mermaid"),
    pipeline("convert-indented-tree-to-gephi-gexf", "Indented Tree to Gephi GEXF", "text.indented-tree", [
      "indented-tree-to-json",
      "indented-tree-json-to-model-graph",
      "model-graph-to-gephi-gexf"
    ], "Indented Tree"),
    pipeline("convert-opml-to-gephi-gexf", "OPML to Gephi GEXF", "xml.opml", [
      "opml-to-tree",
      "json-tree-to-gephi-gexf"
    ], "OPML"),
    pipeline("convert-json-to-gephi-gexf", "JSON Tree Projection to Gephi GEXF", "text.json", [
      "json-to-tree",
      "json-tree-to-gephi-gexf"
    ], "JSON"),
    pipeline("convert-yaml-to-gephi-gexf", "YAML Tree Projection to Gephi GEXF", "text.yaml", [
      "yaml-to-tree",
      "json-tree-to-gephi-gexf"
    ], "YAML"),
    pipeline("convert-markdown-outline-to-gephi-gexf", "Markdown Outline to Gephi GEXF", "text.markdown", [
      "markdown-to-outline-tree",
      "json-tree-to-gephi-gexf"
    ], "Markdown"),
    pipeline("convert-json-table-relations-to-gephi-gexf", "JSON Table Relations to Gephi GEXF", "json.table", [
      "json-table-to-architecture-graph",
      "model-graph-to-gephi-gexf"
    ], "Tables"),
    pipeline("convert-csv-relations-to-gephi-gexf", "CSV Relations to Gephi GEXF", "text.csv", [
      "csv-to-json-table",
      "json-table-to-architecture-graph",
      "model-graph-to-gephi-gexf"
    ], "CSV"),
    pipeline("convert-openapi-to-gephi-gexf", "OpenAPI to Gephi GEXF", "json.openapi", [
      "openapi-to-dependency-graph",
      "model-graph-to-gephi-gexf"
    ], "OpenAPI"),
    pipeline("convert-openapi-yaml-to-gephi-gexf", "OpenAPI YAML to Gephi GEXF", "yaml.openapi", [
      "yaml-openapi-to-json-openapi",
      "openapi-to-dependency-graph",
      "model-graph-to-gephi-gexf"
    ], "OpenAPI YAML"),
    pipeline("convert-package-json-to-gephi-gexf", "package.json Dependencies to Gephi GEXF", "text.json", [
      "package-json-to-dependency-graph",
      "model-graph-to-gephi-gexf"
    ], "Package JSON"),
    pipeline("convert-javascript-imports-to-gephi-gexf", "JavaScript Imports to Gephi GEXF", "text.javascript", [
      "javascript-imports-to-dependency-graph",
      "model-graph-to-gephi-gexf"
    ], "JavaScript"),
    pipeline("convert-python-imports-to-gephi-gexf", "Python Imports to Gephi GEXF", "text.python", [
      "python-imports-to-dependency-graph",
      "model-graph-to-gephi-gexf"
    ], "Python"),
    pipeline("convert-bpmn-to-gephi-gexf", "BPMN to Gephi GEXF", "xml.bpmn", [
      "bpmn-to-process-graph",
      "model-graph-to-gephi-gexf"
    ], "BPMN"),
    pipeline("convert-archimate-to-gephi-gexf", "ArchiMate to Gephi GEXF", "xml.archimate-exchange", [
      "archimate-to-architecture-graph",
      "model-graph-to-gephi-gexf"
    ], "ArchiMate")
  ];

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "gephi-gexf",
    name: "Gephi GEXF",
    version: "0.1.0",
    description: "Gephi GEXF language support plus conversion pipelines from graph, tree, table, process, architecture, and dependency formats.",
    contributes: {
      languages: [
        {
          id: GEXF_LANGUAGE,
          name: "Gephi GEXF",
          parentLanguageId: "text.xml",
          aliases: ["gephi", "gexf"],
          fileExtensions: [".gexf"],
          mediaType: GEXF_MIME_TYPE,
          mediaTypes: [GEXF_MIME_TYPE, "application/xml", "text/xml"],
          description: "Gephi Graph Exchange XML Format."
        }
      ],
      editors: [],
      editorExtensions: [],
      transformers: [
        {
          id: "model-graph-to-gephi-gexf",
          name: "Model Graph to Gephi GEXF",
          inputLanguage: "json.model-graph",
          outputLanguage: GEXF_LANGUAGE,
          visibility: "internal",
          transform: modelGraphToGexf
        },
        {
          id: "cytoscape-to-gephi-gexf",
          name: "Cytoscape JSON to Gephi GEXF",
          inputLanguage: "json.cytoscape",
          outputLanguage: GEXF_LANGUAGE,
          visibility: "internal",
          transform: cytoscapeToGexf
        },
        {
          id: "json-tree-to-gephi-gexf",
          name: "JSON Tree to Gephi GEXF",
          inputLanguage: "json.tree",
          outputLanguage: GEXF_LANGUAGE,
          visibility: "internal",
          transform: treeToGexf
        },
        {
          id: "jsmind-to-gephi-gexf",
          name: "jsMind to Gephi GEXF",
          inputLanguage: "json.jsmind",
          outputLanguage: GEXF_LANGUAGE,
          visibility: "internal",
          transform: jsmindToGexf
        },
        {
          id: "graphviz-to-gephi-gexf",
          name: "Graphviz DOT to Gephi GEXF",
          inputLanguage: "text.graphviz-dot",
          outputLanguage: GEXF_LANGUAGE,
          visibility: "internal",
          lossy: true,
          transform: graphvizToGexf
        },
        {
          id: "mermaid-flowchart-to-gephi-gexf",
          name: "Mermaid Flowchart to Gephi GEXF",
          inputLanguage: "text.mermaid",
          outputLanguage: GEXF_LANGUAGE,
          visibility: "internal",
          lossy: true,
          transform: mermaidToGexf
        }
      ],
      renderers: [],
      exporters: [
        {
          id: "gephi-gexf-source-export",
          name: "Gephi GEXF",
          accepts: [GEXF_LANGUAGE],
          outputFileExtension: "gexf",
          mimeType: GEXF_MIME_TYPE,
          category: "Export",
          menuPath: ["Export", "Gephi GEXF"],
          export: exportGexf
        }
      ],
      linters: [
        {
          id: "gephi-gexf-linter",
          name: "Gephi GEXF shape",
          accepts: [GEXF_LANGUAGE],
          lint: lintGexf
        }
      ],
      pipelines: pipelines
    }
  });
})(window);
