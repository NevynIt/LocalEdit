(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    cytoscape: "plugins/mermaid/runtime/mermaid.bundle.js",
    viewer: "plugins/shared/cytoscape-viewer/cytoscape-viewer.js"
  };

  var ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
  var DEFAULT_LINK_TYPE = "related-to";

  var CYTOSCAPE_LAYOUT = {
    name: "breadthfirst",
    directed: true,
    animate: false,
    padding: 32,
    spacingFactor: 1.1
  };

  var CYTOSCAPE_STYLE = [
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
        "target-arrow-color": "#94a3b8",
        "target-arrow-shape": "triangle",
        "width": 1.4
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
        "text-background-opacity": 0.85,
        "text-background-padding": 2,
        "text-rotation": "autorotate"
      }
    }
  ];

  var OUTLINE_PREVIEW_STYLE = [
    "<style>",
    ".tree-node summary { cursor: pointer; user-select: none; }",
    ".tree-children { margin-left: 18px; border-left: 1px solid var(--border, #cbd3df); padding-left: 10px; }",
    ".tree-key { color: var(--accent-strong, #0b5f59); font-weight: 700; }",
    ".tree-meta { color: var(--muted, #5d6b7c); }",
    ".indented-tree-preview { display: grid; gap: 10px; max-height: calc(100vh - 32px); overflow: auto; }",
    ".indented-tree-preview-header { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; color: var(--muted, #5d6b7c); }",
    ".indented-tree-preview-header strong { color: var(--text, #17202c); }",
    ".indented-tree-metadata { display: grid; gap: 4px; margin: 0; font-family: Consolas, \"Courier New\", monospace; font-size: 12px; }",
    ".indented-tree-metadata div { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px; }",
    ".indented-tree-metadata dt { color: var(--muted, #5d6b7c); font-weight: 700; }",
    ".indented-tree-metadata dd { margin: 0; overflow-wrap: anywhere; }",
    ".indented-tree-details { margin: 6px 0 6px 18px; border-left: 2px solid var(--border, #cbd3df); padding: 4px 0 4px 10px; color: var(--muted, #5d6b7c); font-family: Consolas, \"Courier New\", monospace; font-size: 12px; white-space: pre-wrap; }",
    "</style>"
  ].join("\n");

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireCodeMirrorLanguageTools() {
    var modules = global.EditorWorkbenchCodeMirror && global.EditorWorkbenchCodeMirror.modules;
    var languageTools = modules && modules["@codemirror/language"];
    if (!languageTools || !languageTools.StreamLanguage) {
      throw new Error("CodeMirror language runtime is not available.");
    }
    return languageTools;
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

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isIdentifier(value) {
    return ID_PATTERN.test(value || "");
  }

  function isIdentifierStart(character) {
    return /[A-Za-z]/.test(character || "");
  }

  function isIdentifierPart(character) {
    return /[A-Za-z0-9_-]/.test(character || "");
  }

  function splitLines(source) {
    var text = source || "";
    var lines = [];
    var start = 0;
    for (var index = 0; index < text.length; index += 1) {
      if (text[index] === "\n") {
        var lineText = text.slice(start, index);
        if (lineText.endsWith("\r")) {
          lineText = lineText.slice(0, -1);
        }
        lines.push({
          text: lineText,
          offset: start,
          lineNumber: lines.length + 1
        });
        start = index + 1;
      }
    }
    if (start < text.length || text.length === 0) {
      var tail = text.slice(start);
      if (tail.endsWith("\r")) {
        tail = tail.slice(0, -1);
      }
      lines.push({
        text: tail,
        offset: start,
        lineNumber: lines.length + 1
      });
    }
    return lines;
  }

  function makeRange(line, startColumn, endColumn) {
    var from = line.offset + Math.max(0, startColumn || 0);
    var to = line.offset + Math.max(startColumn || 0, endColumn == null ? startColumn || 0 : endColumn);
    return {
      from: from,
      to: Math.max(from + 1, to),
      line: line.lineNumber,
      column: Math.max(0, startColumn || 0)
    };
  }

  function addDiagnostic(result, line, startColumn, endColumn, severity, message, source) {
    var range = makeRange(line || { offset: 0, lineNumber: 1 }, startColumn || 0, endColumn || startColumn || 1);
    result.diagnostics.push({
      from: range.from,
      to: range.to,
      line: range.line,
      column: range.column,
      severity: severity,
      message: message,
      source: source || "Indented Tree"
    });
  }

  function readIndent(text) {
    var count = 0;
    var hasTab = false;
    while (count < text.length) {
      if (text[count] === " ") {
        count += 1;
        continue;
      }
      if (text[count] === "\t") {
        hasTab = true;
        count += 1;
        continue;
      }
      break;
    }
    return {
      count: count,
      hasTab: hasTab
    };
  }

  function trimRight(value) {
    return String(value || "").replace(/\s+$/, "");
  }

  function parseScalar(value) {
    var text = String(value == null ? "" : value).trim();
    if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    if (/^(true|false)$/i.test(text)) {
      return text.toLowerCase() === "true";
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return text;
  }

  function parseFrontMatter(lines, startIndex, result) {
    var index = startIndex + 1;
    while (index < lines.length) {
      var line = lines[index];
      var text = line.text.trim();
      if (text === "---") {
        return index + 1;
      }
      if (!text) {
        index += 1;
        continue;
      }
      var colonIndex = text.indexOf(":");
      if (colonIndex === -1) {
        addDiagnostic(result, line, 0, line.text.length, "warning", "Metadata line should use key: value syntax.");
        index += 1;
        continue;
      }
      var key = text.slice(0, colonIndex).trim();
      if (!key) {
        addDiagnostic(result, line, 0, colonIndex + 1, "error", "Metadata key is empty.");
      } else {
        result.metadata[key] = parseScalar(text.slice(colonIndex + 1));
      }
      index += 1;
    }
    addDiagnostic(result, lines[startIndex], 0, lines[startIndex].text.length, "error", "Front matter block is missing a closing --- line.");
    return lines.length;
  }

  function skipSpaces(text, index) {
    var cursor = index;
    while (cursor < text.length && /\s/.test(text[cursor])) {
      cursor += 1;
    }
    return cursor;
  }

  function readIdentifier(text, index) {
    var cursor = index;
    if (!isIdentifierStart(text[cursor])) {
      return null;
    }
    cursor += 1;
    while (cursor < text.length && isIdentifierPart(text[cursor])) {
      cursor += 1;
    }
    return {
      value: text.slice(index, cursor),
      end: cursor
    };
  }

  function parseLinkToken(text, index) {
    var cursor = index;
    if (text[cursor] !== "@") {
      return null;
    }
    cursor += 1;
    var first = readIdentifier(text, cursor);
    if (!first) {
      return null;
    }
    cursor = first.end;

    var type = "";
    var target = first.value;
    if (text[cursor] === ":") {
      type = first.value;
      cursor += 1;
      var targetToken = readIdentifier(text, cursor);
      if (!targetToken) {
        return null;
      }
      target = targetToken.value;
      cursor = targetToken.end;
    }

    return {
      link: {
        type: type || DEFAULT_LINK_TYPE,
        target: target,
        raw: text.slice(index, cursor),
        range: {
          start: index,
          end: cursor
        }
      },
      end: cursor
    };
  }

  function parseLinkListAt(text, index) {
    var links = [];
    var cursor = index;
    while (cursor < text.length) {
      cursor = skipSpaces(text, cursor);
      var token = parseLinkToken(text, cursor);
      if (!token) {
        return null;
      }
      links.push(token.link);
      cursor = skipSpaces(text, token.end);
      if (cursor >= text.length) {
        return {
          links: links,
          end: cursor
        };
      }
      if (text[cursor] !== ",") {
        return null;
      }
      cursor += 1;
    }
    return links.length ? { links: links, end: cursor } : null;
  }

  function parseTrailingLinks(text, result, line, baseColumn) {
    for (var index = 0; index < text.length; index += 1) {
      if (text[index] !== "@") {
        continue;
      }
      if (index > 0 && !/\s/.test(text[index - 1])) {
        continue;
      }
      var parsed = parseLinkListAt(text, index);
      if (parsed && skipSpaces(text, parsed.end) === text.length) {
        parsed.links.forEach(function (link) {
          link.range = {
            from: line.offset + baseColumn + link.range.start,
            to: line.offset + baseColumn + link.range.end
          };
        });
        return {
          text: trimRight(text.slice(0, index)),
          links: parsed.links
        };
      }
    }

    var possibleAt = text.lastIndexOf("@");
    if (possibleAt !== -1 && possibleAt > 0 && /\s/.test(text[possibleAt - 1])) {
      addDiagnostic(result, line, baseColumn + possibleAt, baseColumn + text.length, "error", "Malformed trailing link list.");
    }

    return {
      text: text,
      links: []
    };
  }

  function splitCommaParts(text) {
    var parts = [];
    var start = 0;
    var quote = "";
    for (var index = 0; index < text.length; index += 1) {
      var character = text[index];
      if (quote) {
        if (character === quote) {
          quote = "";
        }
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        continue;
      }
      if (character === ",") {
        parts.push(text.slice(start, index));
        start = index + 1;
      }
    }
    parts.push(text.slice(start));
    return parts;
  }

  function parseAttributesBody(body, result, line, baseColumn) {
    var attributes = {};
    if (!body.trim()) {
      addDiagnostic(result, line, baseColumn, baseColumn + 1, "warning", "Attribute block is empty.");
      return attributes;
    }
    splitCommaParts(body).forEach(function (part) {
      var text = part.trim();
      if (!text) {
        return;
      }
      var colonIndex = text.indexOf(":");
      if (colonIndex === -1) {
        addDiagnostic(result, line, baseColumn, baseColumn + part.length, "error", "Attribute entry is missing a colon.");
        return;
      }
      var key = text.slice(0, colonIndex).trim();
      var value = text.slice(colonIndex + 1).trim();
      if (!isIdentifier(key)) {
        addDiagnostic(result, line, baseColumn, baseColumn + key.length, "error", "Attribute key is invalid: " + key + ".");
        return;
      }
      attributes[key] = parseScalar(value);
    });
    return attributes;
  }

  function findTrailingAttributeStart(text) {
    var end = trimRight(text).length;
    if (end === 0 || text[end - 1] !== "}") {
      return -1;
    }
    var quote = "";
    for (var index = end - 2; index >= 0; index -= 1) {
      var character = text[index];
      if (quote) {
        if (character === quote) {
          quote = "";
        }
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        continue;
      }
      if (character === "{") {
        return index;
      }
    }
    return -1;
  }

  function parseTrailingAttributes(text, result, line, baseColumn) {
    var end = trimRight(text).length;
    var start = findTrailingAttributeStart(text);
    if (start === -1) {
      return {
        text: text,
        attributes: {}
      };
    }
    if (start > 0 && !/\s/.test(text[start - 1])) {
      return {
        text: text,
        attributes: {}
      };
    }
    return {
      text: trimRight(text.slice(0, start)),
      attributes: parseAttributesBody(text.slice(start + 1, end - 1), result, line, baseColumn + start + 1)
    };
  }

  function parseTrailingTags(text, result, line, baseColumn) {
    var tags = [];
    var working = trimRight(text);
    while (working.length > 0) {
      var end = working.length;
      var start = end;
      while (start > 0 && !/\s/.test(working[start - 1])) {
        start -= 1;
      }
      var token = working.slice(start, end);
      if (!token.startsWith("#")) {
        break;
      }
      var tag = token.slice(1);
      if (!isIdentifier(tag)) {
        addDiagnostic(result, line, baseColumn + start, baseColumn + end, "error", "Invalid tag: " + token + ".");
        break;
      }
      tags.unshift(tag);
      working = trimRight(working.slice(0, start));
    }
    return {
      text: working,
      tags: tags
    };
  }

  function parseNodeContent(content, line, indent, result, nextInternalId) {
    var cursor = 0;
    var id = "";
    var idRange = null;
    var type = "";
    var typeRange = null;

    if (content[cursor] === "&") {
      var idToken = readIdentifier(content, cursor + 1);
      if (!idToken || (idToken.end < content.length && !/\s/.test(content[idToken.end]))) {
        addDiagnostic(result, line, indent, indent + Math.min(content.length, 16), "error", "Invalid node id declaration.");
      } else {
        id = idToken.value;
        idRange = {
          from: line.offset + indent,
          to: line.offset + indent + idToken.end
        };
        cursor = idToken.end;
        cursor = skipSpaces(content, cursor);
      }
    }

    if (content[cursor] === "[") {
      var close = content.indexOf("]", cursor + 1);
      if (close === -1) {
        addDiagnostic(result, line, indent + cursor, indent + content.length, "error", "Node type declaration is missing ].");
      } else {
        type = content.slice(cursor + 1, close).trim();
        if (!isIdentifier(type)) {
          addDiagnostic(result, line, indent + cursor, indent + close + 1, "error", "Invalid node type: " + type + ".");
          type = "";
        } else {
          typeRange = {
            from: line.offset + indent + cursor,
            to: line.offset + indent + close + 1
          };
        }
        cursor = close + 1;
        cursor = skipSpaces(content, cursor);
      }
    }

    var working = trimRight(content.slice(cursor));
    var linkResult = parseTrailingLinks(working, result, line, indent + cursor);
    working = linkResult.text;
    var attributeResult = parseTrailingAttributes(working, result, line, indent + cursor);
    working = attributeResult.text;
    var tagResult = parseTrailingTags(working, result, line, indent + cursor);
    working = tagResult.text;

    var label = working.trim();
    if (!label) {
      addDiagnostic(result, line, indent + cursor, indent + content.length, "error", "Node label is empty.");
    }

    return {
      internalId: "n" + nextInternalId,
      id: id || undefined,
      type: type || undefined,
      label: label,
      indent: indent,
      parent: null,
      children: [],
      tags: tagResult.tags,
      attributes: attributeResult.attributes,
      details: "",
      detailsLines: [],
      links: linkResult.links,
      sourceRange: makeRange(line, indent, line.text.length),
      line: line.lineNumber,
      idRange: idRange,
      typeRange: typeRange
    };
  }

  function attachNode(result, stack, node, line) {
    var parent = null;
    if (stack.length === 0) {
      stack.push({
        indent: node.indent,
        node: node
      });
    } else {
      var top = stack[stack.length - 1];
      if (node.indent > top.indent) {
        parent = top.node;
        stack.push({
          indent: node.indent,
          node: node
        });
      } else if (node.indent === top.indent) {
        parent = stack.length > 1 ? stack[stack.length - 2].node : null;
        stack[stack.length - 1] = {
          indent: node.indent,
          node: node
        };
      } else {
        while (stack.length > 0 && stack[stack.length - 1].indent > node.indent) {
          stack.pop();
        }
        if (stack.length > 0 && stack[stack.length - 1].indent === node.indent) {
          parent = stack.length > 1 ? stack[stack.length - 2].node : null;
          stack[stack.length - 1] = {
            indent: node.indent,
            node: node
          };
        } else {
          addDiagnostic(result, line, 0, node.indent + 1, "error", "Dedent does not match a previous indentation level.");
          parent = stack.length > 0 ? stack[stack.length - 1].node : null;
          stack.push({
            indent: node.indent,
            node: node
          });
        }
      }
    }

    if (parent) {
      node.parent = parent.internalId;
      parent.children.push(node.internalId);
    } else {
      result.roots.push(node.internalId);
    }
    result.nodes.push(node);
  }

  function stripOptionalQuotes(value) {
    var text = String(value || "").trim();
    if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    return text;
  }

  function startsDirective(content, keyword) {
    return content === keyword || (content.startsWith(keyword) && /\s/.test(content[keyword.length] || ""));
  }

  function validateSelector(selector) {
    var text = String(selector || "").trim();
    if (!text) {
      return false;
    }
    if (text === "*" || text === "->" || text === "=>") {
      return true;
    }
    if (text.startsWith("&")) {
      return isIdentifier(text.slice(1));
    }
    if (text.startsWith("#")) {
      return isIdentifier(text.slice(1));
    }
    if (text.startsWith("[") && text.endsWith("]")) {
      return isIdentifier(text.slice(1, -1).trim());
    }
    if (text.startsWith("{") && text.endsWith("}")) {
      var body = text.slice(1, -1).trim();
      var equals = body.indexOf("=");
      return equals > 0 && isIdentifier(body.slice(0, equals).trim()) && body.slice(equals + 1).trim().length > 0;
    }
    if (text.startsWith("->[") && text.endsWith("]")) {
      return isIdentifier(text.slice(3, -1).trim());
    }
    return false;
  }

  function collectBraceBlockFromOpen(lines, startIndex, content, result, line, directiveName, open) {
    if (open === -1) {
      addDiagnostic(result, line, 0, content.length, "error", directiveName + " directive is missing an opening {.");
      return {
        prefix: content,
        body: "",
        nextIndex: startIndex + 1,
        closed: false
      };
    }

    var close = content.indexOf("}", open + 1);
    if (close !== -1) {
      return {
        prefix: content.slice(0, open),
        body: content.slice(open + 1, close),
        nextIndex: startIndex + 1,
        closed: true
      };
    }

    var bodyLines = [content.slice(open + 1)];
    var index = startIndex + 1;
    while (index < lines.length) {
      var nextLine = lines[index];
      var closeIndex = nextLine.text.indexOf("}");
      if (closeIndex !== -1) {
        bodyLines.push(nextLine.text.slice(0, closeIndex));
        return {
          prefix: content.slice(0, open),
          body: bodyLines.join("\n"),
          nextIndex: index + 1,
          closed: true
        };
      }
      bodyLines.push(nextLine.text);
      index += 1;
    }

    addDiagnostic(result, line, 0, content.length, "error", directiveName + " directive is missing a closing }.");
    return {
      prefix: content.slice(0, open),
      body: bodyLines.join("\n"),
      nextIndex: lines.length,
      closed: false
    };
  }

  function collectBraceBlock(lines, startIndex, content, result, line, directiveName) {
    return collectBraceBlockFromOpen(lines, startIndex, content, result, line, directiveName, content.indexOf("{"));
  }

  function parseStyleProperties(body) {
    var properties = {};
    body.split(";").forEach(function (part) {
      var text = part.trim();
      if (!text) {
        return;
      }
      var colon = text.indexOf(":");
      if (colon === -1) {
        return;
      }
      properties[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
    });
    return properties;
  }

  function parseStyleDirective(lines, index, content, result, line) {
    var block = collectBraceBlockFromOpen(lines, index, content, result, line, "%style", content.lastIndexOf("{"));
    var selector = block.prefix.slice("%style".length).trim();
    if (!validateSelector(selector)) {
      addDiagnostic(result, line, 0, content.length, "warning", "Unsupported style selector: " + selector + ".");
    }
    result.styles.push({
      selector: selector,
      properties: parseStyleProperties(block.body),
      rawBody: block.body,
      sourceRange: makeRange(line, 0, content.length)
    });
    return block.nextIndex;
  }

  function parseViewBody(body, result, line) {
    var rules = [];
    body.split(/\r?\n/).forEach(function (bodyLine) {
      var text = bodyLine.trim();
      if (!text) {
        return;
      }
      var colon = text.indexOf(":");
      if (colon === -1) {
        addDiagnostic(result, line, 0, line.text.length, "error", "View rule is missing a colon.");
        return;
      }
      var action = text.slice(0, colon).trim();
      if (action !== "include" && action !== "exclude") {
        addDiagnostic(result, line, 0, line.text.length, "error", "View rule must be include or exclude.");
        return;
      }
      var selectors = splitCommaParts(text.slice(colon + 1)).map(function (selector) {
        return selector.trim();
      }).filter(Boolean);
      selectors.forEach(function (selector) {
        if (!validateSelector(selector)) {
          addDiagnostic(result, line, 0, line.text.length, "warning", "Unsupported view selector: " + selector + ".");
        }
      });
      rules.push({
        action: action,
        selectors: selectors
      });
    });
    return rules;
  }

  function parseViewDirective(lines, index, content, result, line) {
    var block = collectBraceBlock(lines, index, content, result, line, "%view");
    var name = block.prefix.slice("%view".length).trim();
    if (!isIdentifier(name)) {
      addDiagnostic(result, line, 0, content.length, "error", "View name is invalid.");
    }
    result.views.push({
      name: name,
      rules: parseViewBody(block.body, result, line),
      rawBody: block.body,
      sourceRange: makeRange(line, 0, content.length)
    });
    return block.nextIndex;
  }

  function parseDirective(lines, index, content, result, line) {
    if (startsDirective(content, "%include")) {
      var includePath = stripOptionalQuotes(content.slice("%include".length));
      if (!includePath) {
        addDiagnostic(result, line, 0, content.length, "error", "%include directive is missing a path.");
      }
      result.includes.push({
        path: includePath,
        resolved: false,
        sourceRange: makeRange(line, 0, content.length)
      });
      return index + 1;
    }

    if (startsDirective(content, "%style")) {
      return parseStyleDirective(lines, index, content, result, line);
    }

    if (startsDirective(content, "%view")) {
      return parseViewDirective(lines, index, content, result, line);
    }

    addDiagnostic(result, line, 0, content.length, "warning", "Unknown directive: " + content.split(/\s+/)[0] + ".");
    return index + 1;
  }

  function appendDetailLine(node, text) {
    node.detailsLines.push(text);
    node.details = node.detailsLines.join("\n");
  }

  function resolveLinks(result) {
    var idMap = new Map();
    result.nodes.forEach(function (node) {
      if (!node.id) {
        return;
      }
      if (!idMap.has(node.id)) {
        idMap.set(node.id, []);
      }
      idMap.get(node.id).push(node);
    });

    idMap.forEach(function (nodes, id) {
      if (nodes.length <= 1) {
        return;
      }
      nodes.forEach(function (node) {
        result.diagnostics.push({
          from: node.idRange ? node.idRange.from : node.sourceRange.from,
          to: node.idRange ? node.idRange.to : node.sourceRange.to,
          line: node.line,
          column: 0,
          severity: "error",
          message: "Duplicate node id: " + id + ".",
          source: "Indented Tree"
        });
      });
    });

    result.nodes.forEach(function (node) {
      var seen = new Set();
      node.links.forEach(function (link) {
        var key = link.type + "|" + link.target;
        if (seen.has(key)) {
          result.diagnostics.push({
            from: link.range ? link.range.from : node.sourceRange.from,
            to: link.range ? link.range.to : node.sourceRange.to,
            line: node.line,
            column: 0,
            severity: "warning",
            message: "Duplicate link declaration to " + link.target + ".",
            source: "Indented Tree"
          });
        }
        seen.add(key);

        var targets = idMap.get(link.target) || [];
        if (targets.length === 1) {
          link.targetInternalId = targets[0].internalId;
        } else if (targets.length > 1) {
          result.diagnostics.push({
            from: link.range ? link.range.from : node.sourceRange.from,
            to: link.range ? link.range.to : node.sourceRange.to,
            line: node.line,
            column: 0,
            severity: "warning",
            message: "Link target is not unique: " + link.target + ".",
            source: "Indented Tree"
          });
        } else {
          result.diagnostics.push({
            from: link.range ? link.range.from : node.sourceRange.from,
            to: link.range ? link.range.to : node.sourceRange.to,
            line: node.line,
            column: 0,
            severity: "warning",
            message: "Unresolved link target: " + link.target + ".",
            source: "Indented Tree"
          });
        }
      });
    });
  }

  function parseIndentedTree(source) {
    var result = {
      format: "indented-tree",
      version: "1.0",
      source: source || "",
      metadata: {},
      includes: [],
      styles: [],
      views: [],
      roots: [],
      nodes: [],
      diagnostics: []
    };
    var lines = splitLines(source || "");
    var index = 0;
    var stack = [];
    var nextInternalId = 1;
    var lastNode = null;
    var detailNode = null;
    var detailIndent = 0;
    var previousKind = "";

    if (lines.length > 0 && lines[0].text.trim() === "---") {
      index = parseFrontMatter(lines, 0, result);
      previousKind = "metadata";
    }

    while (index < lines.length) {
      var line = lines[index];
      var raw = line.text;
      if (!raw.trim()) {
        detailNode = null;
        previousKind = "blank";
        index += 1;
        continue;
      }

      var indent = readIndent(raw);
      if (indent.hasTab) {
        addDiagnostic(result, line, 0, indent.count, "error", "Tabs are not allowed in indentation.");
      }
      var content = trimRight(raw.slice(indent.count));

      if (content.startsWith("|")) {
        if (!lastNode || (previousKind !== "node" && previousKind !== "detail")) {
          addDiagnostic(result, line, indent.count, raw.length, "error", "Detail lines must immediately follow a node.");
          previousKind = "detail";
          index += 1;
          continue;
        }
        if (!detailNode) {
          detailNode = lastNode;
          detailIndent = indent.count;
          if (detailIndent < detailNode.indent) {
            addDiagnostic(result, line, 0, indent.count + 1, "error", "Detail block indentation must be equal to or greater than the node indentation.");
          }
        }
        if (indent.count !== detailIndent) {
          addDiagnostic(result, line, 0, indent.count + 1, "error", "Detail block indentation is inconsistent.");
        } else {
          var detailText = content.slice(1);
          if (detailText.startsWith(" ")) {
            detailText = detailText.slice(1);
          }
          appendDetailLine(detailNode, detailText);
        }
        previousKind = "detail";
        index += 1;
        continue;
      }

      detailNode = null;
      if (content.startsWith("%")) {
        index = parseDirective(lines, index, content, result, line);
        previousKind = "directive";
        continue;
      }

      var node = parseNodeContent(content, line, indent.count, result, nextInternalId);
      nextInternalId += 1;
      attachNode(result, stack, node, line);
      lastNode = node;
      previousKind = "node";
      index += 1;
    }

    resolveLinks(result);
    result.nodes.forEach(function (node) {
      delete node.detailsLines;
      if (!node.idRange) {
        delete node.idRange;
      }
      if (!node.typeRange) {
        delete node.typeRange;
      }
    });
    return result;
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

  function sanitizeClassName(value) {
    return String(value || "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function buildCytoscapeDocument(parsed) {
    var idCounts = uniqueNodeIdCounts(parsed);
    var nodeIdMap = new Map();
    var nodes = parsed.nodes.map(function (node) {
      var cytoscapeId = node.id && idCounts.get(node.id) === 1 ? node.id : node.internalId;
      nodeIdMap.set(node.internalId, cytoscapeId);
      var classes = [];
      if (node.type) {
        classes.push("type-" + sanitizeClassName(node.type));
      }
      node.tags.forEach(function (tag) {
        classes.push("tag-" + sanitizeClassName(tag));
      });
      return {
        group: "nodes",
        classes: classes.join(" "),
        data: {
          id: cytoscapeId,
          label: node.label || node.internalId,
          internalId: node.internalId,
          declaredId: node.id || "",
          type: node.type || "",
          tags: node.tags,
          attributes: node.attributes,
          details: node.details || "",
          indent: node.indent,
          sourceLine: node.line,
          parentInternalId: node.parent || ""
        }
      };
    });

    var edges = [];
    parsed.nodes.forEach(function (node) {
      var sourceId = node.parent ? nodeIdMap.get(node.parent) : "";
      var targetId = nodeIdMap.get(node.internalId);
      if (sourceId && targetId) {
        edges.push({
          group: "edges",
          data: {
            id: "hierarchy-" + sourceId + "-" + targetId,
            source: sourceId,
            target: targetId,
            kind: "hierarchy",
            type: "contains",
            label: "contains"
          }
        });
      }
      node.links.forEach(function (link, index) {
        if (!link.targetInternalId) {
          return;
        }
        var linkedTarget = nodeIdMap.get(link.targetInternalId);
        var linkedSource = nodeIdMap.get(node.internalId);
        if (!linkedSource || !linkedTarget) {
          return;
        }
        edges.push({
          group: "edges",
          data: {
            id: "link-" + linkedSource + "-" + linkedTarget + "-" + index,
            source: linkedSource,
            target: linkedTarget,
            kind: "link",
            type: link.type || DEFAULT_LINK_TYPE,
            label: link.type || DEFAULT_LINK_TYPE,
            targetId: link.target
          }
        });
      });
    });

    return {
      format: "cytoscape-js-document",
      version: "1.0",
      metadata: {
        sourceFormat: parsed.format,
        sourceVersion: parsed.version,
        document: parsed.metadata,
        includes: parsed.includes,
        styles: parsed.styles,
        views: parsed.views
      },
      layout: Object.assign({}, CYTOSCAPE_LAYOUT),
      style: [],
      elements: {
        nodes: nodes,
        edges: edges
      }
    };
  }

  function renderMetadata(parsed) {
    var keys = Object.keys(parsed.metadata || {});
    if (keys.length === 0) {
      return "";
    }
    return "<dl class=\"indented-tree-metadata\">" + keys.map(function (key) {
      return "<div><dt>" + escapeHtml(key) + "</dt><dd>" + escapeHtml(JSON.stringify(parsed.metadata[key])) + "</dd></div>";
    }).join("") + "</dl>";
  }

  function nodeById(parsed) {
    var map = new Map();
    parsed.nodes.forEach(function (node) {
      map.set(node.internalId, node);
    });
    return map;
  }

  function renderOutlineNode(node, map) {
    var children = node.children.map(function (childId) {
      return renderOutlineNode(map.get(childId), map);
    }).join("");
    var meta = [];
    if (node.id) {
      meta.push("&" + node.id);
    }
    if (node.type) {
      meta.push("[" + node.type + "]");
    }
    node.tags.forEach(function (tag) {
      meta.push("#" + tag);
    });
    var details = node.details
      ? "<pre class=\"indented-tree-details\">" + escapeHtml(node.details) + "</pre>"
      : "";
    return [
      "<details open class=\"tree-node indented-tree-node\">",
      "<summary>",
      "<span class=\"tree-key\">" + escapeHtml(node.label || node.internalId) + "</span>",
      meta.length ? " <span class=\"tree-meta\">" + escapeHtml(meta.join(" ")) + "</span>" : "",
      "</summary>",
      details,
      children ? "<div class=\"tree-children\">" + children + "</div>" : "",
      "</details>"
    ].join("");
  }

  function renderOutline(documentModel) {
    var parsed = parseIndentedTree(documentModel.text || "");
    var map = nodeById(parsed);
    var roots = parsed.roots.map(function (id) {
      return renderOutlineNode(map.get(id), map);
    }).join("");
    var summary = parsed.nodes.length + " nodes, " + parsed.diagnostics.length + " diagnostics";
    return [
      OUTLINE_PREVIEW_STYLE,
      "<section class=\"indented-tree-preview\">",
      "<header class=\"indented-tree-preview-header\"><strong>Indented Tree</strong><span>" + escapeHtml(summary) + "</span></header>",
      renderMetadata(parsed),
      roots || "<p class=\"empty-state\">No nodes found.</p>",
      "</section>"
    ].join("");
  }

  async function renderCytoscapePreview(documentModel, context) {
    var parsed = parseIndentedTree(documentModel.text || "");
    var graph = buildCytoscapeDocument(parsed);
    await requireRuntime(context).ensureScripts([RUNTIME_PATHS.cytoscape, RUNTIME_PATHS.viewer]);
    var cytoscapeFactory = requireCytoscapeTools();
    var viewer = requireCytoscapeViewer();
    return {
      kind: "custom",
      content: {
        mount: function (target) {
          return viewer.mount(target, cytoscapeFactory, graph, {
            title: "Indented tree graph",
            style: CYTOSCAPE_STYLE
          });
        }
      },
      mimeType: "application/x.editor-workbench.custom+indented-tree-graph"
    };
  }

  function baseName(sourceName, fallback) {
    var name = sourceName || fallback;
    var withoutTreeExtension = name.replace(/\.(itt|itree)$/i, "");
    if (withoutTreeExtension !== name) {
      return withoutTreeExtension;
    }
    return name.replace(/\.[^.]+$/, "");
  }

  function createFullJsonExport(sourceDocument) {
    var parsed = parseIndentedTree(sourceDocument.text || "");
    return {
      fileName: baseName(sourceDocument.fileName, "untitled.itt") + ".indented-tree.json",
      mimeType: "application/json",
      content: JSON.stringify(parsed, null, 2)
    };
  }

  function createCytoscapeExport(sourceDocument) {
    var parsed = parseIndentedTree(sourceDocument.text || "");
    var graph = buildCytoscapeDocument(parsed);
    return {
      fileName: baseName(sourceDocument.fileName, "untitled.itt") + ".cy.json",
      mimeType: "application/vnd.cytoscape+json",
      content: JSON.stringify(graph, null, 2)
    };
  }

  function createCodeMirrorExtensions() {
    var tools = requireCodeMirrorLanguageTools();
    var streamLanguage = tools.StreamLanguage.define({
      startState: function () {
        return {};
      },
      token: function (stream) {
        if (stream.sol()) {
          stream.eatWhile(/[ \t]/);
          if (stream.current()) {
            return null;
          }
        }
        if (stream.eol()) {
          return null;
        }
        if (stream.match("---")) {
          return "meta";
        }
        if (stream.peek() === "|") {
          stream.skipToEnd();
          return "string";
        }
        if (stream.peek() === "%") {
          stream.next();
          stream.eatWhile(/[A-Za-z-]/);
          return "keyword";
        }
        if (stream.peek() === "&") {
          stream.next();
          stream.eatWhile(/[A-Za-z0-9_-]/);
          return "variableName";
        }
        if (stream.peek() === "[") {
          stream.next();
          stream.eatWhile(/[A-Za-z0-9_-]/);
          if (stream.peek() === "]") {
            stream.next();
          }
          return "typeName";
        }
        if (stream.peek() === "#") {
          stream.next();
          stream.eatWhile(/[A-Za-z0-9_-]/);
          return "labelName";
        }
        if (stream.peek() === "@") {
          stream.next();
          stream.eatWhile(/[A-Za-z0-9_:-]/);
          return "link";
        }
        if (stream.peek() === "{") {
          stream.next();
          while (!stream.eol() && stream.peek() !== "}") {
            stream.next();
          }
          if (stream.peek() === "}") {
            stream.next();
          }
          return "string";
        }
        if (stream.match(/[,}:]/)) {
          return "punctuation";
        }
        stream.next();
        while (!stream.eol() && !/[&[#@{}%,:]/.test(stream.peek())) {
          stream.next();
        }
        return null;
      }
    });

    if (!tools.HighlightStyle || !tools.syntaxHighlighting || !tools.tags) {
      return [streamLanguage];
    }

    var tags = tools.tags;
    var highlightStyle = tools.HighlightStyle.define([
      { tag: tags.keyword, color: "#0f766e", fontWeight: "700" },
      { tag: tags.variableName, color: "#1d4ed8", fontWeight: "700" },
      { tag: tags.typeName, color: "#7c3aed" },
      { tag: tags.labelName, color: "#b45309" },
      { tag: tags.string, color: "#047857" },
      { tag: tags.link, color: "#be123c" },
      { tag: tags.meta, color: "#64748b" }
    ]);
    return [streamLanguage, tools.syntaxHighlighting(highlightStyle)];
  }

  global.EditorWorkbenchIndentedTree = {
    parse: parseIndentedTree,
    buildCytoscapeDocument: buildCytoscapeDocument
  };

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push(global.EditorPluginContracts.fromLegacy({
    id: "indented-tree-core",
    name: "Indented Tree",
    version: "0.1.0",
    description: "Indented tree syntax, linting, previews, and JSON/Cytoscape exports.",
    documentationUrl: "indented_tree_text_format.md",
    getExampleDocument: function () {
      return {
        fileName: "example.itt",
        languageId: "text.indented-tree",
        mimeType: "text/x-indented-tree",
        text: [
          "---",
          "title: Plugin security model",
          "defaultLinkType: related-to",
          "---",
          "%style [requirement] { shape: rectangle; fill: #e8f1ff; stroke: #3b73d9; }",
          "%include shared-controls.itt",
          "%view requirements {",
          "  include: [requirement]",
          "  include: ->[verified-by], ->[satisfies]",
          "  exclude: #draft",
          "}",
          "&req1 [requirement] System shall log events #security {priority: high} @verified-by:test1, @risk7",
          " | Events include authentication, configuration, and export actions.",
          " &test1 [test] Audit log integration test #qa",
          "&risk7 [risk] Log storage may become unavailable #ops {severity: medium}"
        ].join("\n")
      };
    },
    languages: ["text.indented-tree"],
    languageDefinitions: [
      {
        id: "text.indented-tree",
        label: "Indented Tree",
        aliases: ["indented-tree"],
        extensions: ["itt", "itree"],
        mimeTypes: ["text/x-indented-tree"]
      }
    ],
    highlighters: [
      {
        id: "indented-tree-codemirror",
        name: "Indented Tree syntax",
        languages: ["text.indented-tree"],
        getCodeMirrorExtensions: function () {
          return createCodeMirrorExtensions();
        }
      }
    ],
    linters: [
      {
        id: "indented-tree-linter",
        name: "Indented Tree parser",
        languages: ["text.indented-tree"],
        lint: function (documentModel) {
          return parseIndentedTree(documentModel.text || "").diagnostics.map(function (diagnostic) {
            return {
              from: diagnostic.from,
              to: diagnostic.to,
              severity: diagnostic.severity,
              message: diagnostic.message,
              source: diagnostic.source
            };
          });
        }
      }
    ],
    transformers: [],
    renderers: [],
    exporters: []
  }));
})(window);
