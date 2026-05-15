(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function fileName(input, suffix, extension) {
    var sourceName = input && input.document && input.document.fileName || "analysis";
    return sourceName.replace(/\.[^.]+$/, "") + suffix + extension;
  }

  function sanitizeId(value, fallback) {
    var text = String(value || "").trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!text || !/^[A-Za-z_]/.test(text)) {
      text = fallback;
    }
    return text;
  }

  function makeTable(profile, columns, rows, metadata) {
    return {
      format: "json.table",
      profile: profile,
      version: "1.0",
      metadata: metadata || {},
      columns: columns.map(function (label) {
        return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: label };
      }),
      rows: rows.map(function (row, index) {
        return { id: "row-" + (index + 1), cells: row };
      })
    };
  }

  function makeGraph(profile, nodes, edges, metadata) {
    return {
      format: "json.model-graph",
      profile: profile,
      version: "1.0",
      metadata: metadata || {},
      nodes: nodes,
      edges: edges
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

  function parseOpenApi(input) {
    var api = parseJson(input.text || "");
    if (!api || !api.openapi && !api.swagger) {
      throw new Error("Expected OpenAPI JSON.");
    }
    return api;
  }

  function openApiOperations(api) {
    var rows = [];
    var methods = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];
    Object.keys(api.paths || {}).forEach(function (pathName) {
      var pathItem = api.paths[pathName] || {};
      methods.forEach(function (method) {
        if (!pathItem[method]) {
          return;
        }
        var operation = pathItem[method] || {};
        rows.push({
          path: pathName,
          method: method.toUpperCase(),
          operationId: operation.operationId || "",
          summary: operation.summary || operation.description || "",
          tags: list(operation.tags).join(", "),
          requestBody: operation.requestBody ? "yes" : "",
          responses: Object.keys(operation.responses || {}).join(", ")
        });
      });
    });
    return rows;
  }

  function openApiToEndpointTable(input) {
    var api = parseOpenApi(input);
    var rows = openApiOperations(api).map(function (operation) {
      return [operation.method, operation.path, operation.operationId, operation.summary, operation.tags, operation.requestBody, operation.responses];
    });
    return {
      text: JSON.stringify(makeTable("json.table.endpoint-list", ["Method", "Path", "Operation ID", "Summary", "Tags", "Request Body", "Responses"], rows, {
        sourceLanguage: input.languageId,
        title: api.info && api.info.title || "OpenAPI"
      }), null, 2),
      languageId: "json.table.endpoint-list",
      fileName: fileName(input, ".endpoints.table", ".json"),
      mimeType: "application/json"
    };
  }

  function schemaRefs(value, refs) {
    if (!value || typeof value !== "object") {
      return;
    }
    if (typeof value.$ref === "string") {
      refs.push(value.$ref);
    }
    Object.keys(value).forEach(function (key) {
      schemaRefs(value[key], refs);
    });
  }

  function refName(ref) {
    return String(ref || "").split("/").pop() || ref;
  }

  function openApiToDependencyGraph(input) {
    var api = parseOpenApi(input);
    var nodes = [];
    var edges = [];
    nodes.push({
      id: "openapi",
      label: api.info && api.info.title || "OpenAPI",
      type: "api",
      tags: [],
      attributes: {
        version: api.openapi || api.swagger || ""
      }
    });
    openApiOperations(api).forEach(function (operation, index) {
      var id = sanitizeId(operation.method + "-" + operation.path, "operation-" + (index + 1));
      nodes.push({
        id: id,
        label: operation.method + " " + operation.path,
        type: "endpoint",
        tags: operation.tags ? operation.tags.split(/\s*,\s*/) : [],
        attributes: {
          operationId: operation.operationId,
          summary: operation.summary
        }
      });
      edges.push({ id: "api-" + id, source: "openapi", target: id, type: "exposes", label: "exposes" });
    });
    var schemas = api.components && api.components.schemas || api.definitions || {};
    Object.keys(schemas).forEach(function (name) {
      var id = "schema-" + sanitizeId(name, "schema");
      nodes.push({
        id: id,
        label: name,
        type: "schema",
        tags: [],
        attributes: {}
      });
      var refs = [];
      schemaRefs(schemas[name], refs);
      refs.forEach(function (ref, index) {
        edges.push({
          id: id + "-ref-" + index,
          source: id,
          target: "schema-" + sanitizeId(refName(ref), "schema"),
          type: "references",
          label: "references"
        });
      });
    });
    return {
      text: JSON.stringify(makeGraph("dependency", nodes, edges, {
        sourceLanguage: input.languageId,
        sourceKind: "openapi"
      }), null, 2),
      languageId: "json.model-graph.dependency",
      fileName: fileName(input, ".openapi.dependency.model-graph", ".json"),
      mimeType: "application/json"
    };
  }

  function openApiToMarkdown(input) {
    var api = parseOpenApi(input);
    var operations = openApiOperations(api);
    var schemas = Object.keys(api.components && api.components.schemas || api.definitions || {});
    var lines = [
      "# OpenAPI Report",
      "",
      "- Title: " + (api.info && api.info.title || "OpenAPI"),
      "- Version: " + (api.info && api.info.version || api.openapi || api.swagger || ""),
      "- Endpoints: " + operations.length,
      "- Schemas: " + schemas.length,
      "",
      "| Method | Path | Operation ID | Summary |",
      "| --- | --- | --- | --- |"
    ];
    operations.forEach(function (operation) {
      lines.push("| " + [operation.method, operation.path, operation.operationId, operation.summary].map(function (value) {
        return String(value || "").replace(/\|/g, "\\|");
      }).join(" | ") + " |");
    });
    if (schemas.length) {
      lines.push("", "## Schemas", "");
      schemas.forEach(function (schema) {
        lines.push("- " + schema);
      });
    }
    return {
      text: lines.join("\n"),
      languageId: "text.markdown",
      fileName: fileName(input, ".openapi-report", ".md"),
      mimeType: "text/markdown"
    };
  }

  function packageJsonToDependencyGraph(input) {
    var pkg = parseJson(input.text || "");
    var rootName = pkg.name || "package";
    var nodes = [{
      id: "package",
      label: rootName,
      type: "package",
      tags: [],
      attributes: {
        version: pkg.version || ""
      }
    }];
    var edges = [];
    [
      ["dependencies", "runtime"],
      ["devDependencies", "development"],
      ["peerDependencies", "peer"],
      ["optionalDependencies", "optional"]
    ].forEach(function (entry) {
      var deps = pkg[entry[0]] || {};
      Object.keys(deps).forEach(function (name) {
        var id = "dep-" + sanitizeId(name, "dependency");
        nodes.push({
          id: id,
          label: name,
          type: "dependency",
          tags: [entry[1]],
          attributes: {
            versionRange: deps[name]
          }
        });
        edges.push({
          id: "package-" + id,
          source: "package",
          target: id,
          type: entry[1],
          label: entry[1]
        });
      });
    });
    return {
      text: JSON.stringify(makeGraph("dependency", nodes, edges, {
        sourceLanguage: input.languageId,
        sourceKind: "package.json"
      }), null, 2),
      languageId: "json.model-graph.dependency",
      fileName: fileName(input, ".dependencies.model-graph", ".json"),
      mimeType: "application/json"
    };
  }

  function sourceOutline(input, language) {
    var lines = String(input.text || "").split(/\r?\n/);
    var children = [];
    var regex = language === "python"
      ? /^\s*(class|def)\s+([A-Za-z_][\w]*)/ 
      : /^\s*(?:export\s+)?(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)|^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^=]*\)?\s*=>/;
    lines.forEach(function (line, index) {
      var match = regex.exec(line);
      if (!match) {
        return;
      }
      var kind = language === "python" ? match[1] : (/class/.test(line) ? "class" : "function");
      var name = language === "python" ? match[2] : match[1] || match[2];
      children.push({
        id: sanitizeId(name, "symbol-" + (children.length + 1)) + "-" + (index + 1),
        label: name,
        kind: kind,
        summary: "line " + (index + 1),
        attributes: {
          line: index + 1,
          language: language
        },
        children: []
      });
    });
    return {
      text: JSON.stringify(makeTree({
        id: language + "-outline",
        label: input.document && input.document.fileName || language + " outline",
        kind: "source",
        summary: children.length + " symbols",
        children: children
      }, {
        sourceLanguage: input.languageId
      }), null, 2),
      languageId: "json.tree",
      fileName: fileName(input, ".outline.tree", ".json"),
      mimeType: "application/json"
    };
  }

  function javascriptOutline(input) {
    return sourceOutline(input, "javascript");
  }

  function pythonOutline(input) {
    return sourceOutline(input, "python");
  }

  function sourceImportsGraph(input, language) {
    var sourceName = input.document && input.document.fileName || language + "-source";
    var nodes = [{
      id: "source",
      label: sourceName,
      type: "source",
      tags: [language],
      attributes: {}
    }];
    var edges = [];
    var imports = [];
    String(input.text || "").split(/\r?\n/).forEach(function (line) {
      if (language === "python") {
        var pyImport = /^\s*import\s+([A-Za-z_][\w.]*)(?:\s+as\s+\w+)?/.exec(line);
        var pyFrom = /^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+/.exec(line);
        if (pyImport) {
          imports.push(pyImport[1]);
        }
        if (pyFrom) {
          imports.push(pyFrom[1]);
        }
        return;
      }
      var jsFrom = /^\s*import(?:\s+[^'"]+\s+from)?\s+["']([^"']+)["']/.exec(line);
      var jsRequire = /require\(\s*["']([^"']+)["']\s*\)/.exec(line);
      if (jsFrom) {
        imports.push(jsFrom[1]);
      }
      if (jsRequire) {
        imports.push(jsRequire[1]);
      }
    });
    Array.from(new Set(imports)).forEach(function (name) {
      var id = "import-" + sanitizeId(name, "module");
      nodes.push({
        id: id,
        label: name,
        type: "module",
        tags: [],
        attributes: {}
      });
      edges.push({
        id: "source-" + id,
        source: "source",
        target: id,
        type: "imports",
        label: "imports"
      });
    });
    return {
      text: JSON.stringify(makeGraph("dependency", nodes, edges, {
        sourceLanguage: input.languageId,
        sourceKind: language
      }), null, 2),
      languageId: "json.model-graph.dependency",
      fileName: fileName(input, ".imports.model-graph", ".json"),
      mimeType: "application/json"
    };
  }

  function javascriptImports(input) {
    return sourceImportsGraph(input, "javascript");
  }

  function pythonImports(input) {
    return sourceImportsGraph(input, "python");
  }

  function lintOpenApi(input) {
    try {
      parseOpenApi(input);
      return [];
    } catch (error) {
      return [{
        source: "OpenAPI",
        severity: "error",
        message: error && error.message ? error.message : String(error),
        languageId: input.languageId
      }];
    }
  }

  function lintDependencyGraph(input) {
    try {
      var graph = parseJson(input.text || "");
      if (!graph || graph.format !== "json.model-graph") {
        throw new Error("Expected json.model-graph.");
      }
      return [];
    } catch (error) {
      return [{
        source: "Dependency Graph",
        severity: "error",
        message: error && error.message ? error.message : String(error),
        languageId: input.languageId
      }];
    }
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "code-analysis",
    name: "Code and API Analysis",
    version: "0.1.0",
    description: "OpenAPI endpoint/schema views, package dependency graphs, and lightweight source outline/import extraction.",
    contributes: {
      languages: [],
      editors: [],
      editorExtensions: [],
      transformers: [
        {
          id: "openapi-to-endpoint-table",
          name: "OpenAPI to Endpoint Table",
          inputLanguage: "json.openapi",
          outputLanguage: "json.table.endpoint-list",
          visibility: "internal",
          transform: openApiToEndpointTable
        },
        {
          id: "openapi-to-dependency-graph",
          name: "OpenAPI to Dependency Graph",
          inputLanguage: "json.openapi",
          outputLanguage: "json.model-graph.dependency",
          visibility: "internal",
          transform: openApiToDependencyGraph
        },
        {
          id: "openapi-to-markdown-report",
          name: "OpenAPI to Markdown Report",
          inputLanguage: "json.openapi",
          outputLanguage: "text.markdown",
          visibility: "internal",
          transform: openApiToMarkdown
        },
        {
          id: "package-json-to-dependency-graph",
          name: "package.json to Dependency Graph",
          inputLanguage: "text.json",
          outputLanguage: "json.model-graph.dependency",
          visibility: "internal",
          transform: packageJsonToDependencyGraph
        },
        {
          id: "javascript-to-outline-tree",
          name: "JavaScript Outline",
          inputLanguage: "text.javascript",
          outputLanguage: "json.tree",
          visibility: "internal",
          transform: javascriptOutline
        },
        {
          id: "javascript-imports-to-dependency-graph",
          name: "JavaScript Imports to Dependency Graph",
          inputLanguage: "text.javascript",
          outputLanguage: "json.model-graph.dependency",
          visibility: "internal",
          transform: javascriptImports
        },
        {
          id: "python-to-outline-tree",
          name: "Python Outline",
          inputLanguage: "text.python",
          outputLanguage: "json.tree",
          visibility: "internal",
          transform: pythonOutline
        },
        {
          id: "python-imports-to-dependency-graph",
          name: "Python Imports to Dependency Graph",
          inputLanguage: "text.python",
          outputLanguage: "json.model-graph.dependency",
          visibility: "internal",
          transform: pythonImports
        }
      ],
      renderers: [],
      exporters: [],
      linters: [
        {
          id: "openapi-json-linter",
          name: "OpenAPI JSON shape",
          accepts: ["json.openapi"],
          lint: lintOpenApi
        },
        {
          id: "dependency-graph-linter",
          name: "Dependency Graph shape",
          accepts: ["json.model-graph.dependency"],
          lint: lintDependencyGraph
        }
      ],
      pipelines: [
        {
          id: "view-openapi-endpoints",
          name: "View OpenAPI Endpoints",
          inputLanguage: "json.openapi",
          category: "Tables",
          menuPath: ["Tables", "OpenAPI", "Endpoints"],
          steps: [
            { use: "openapi-to-endpoint-table", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "openapi-endpoint-report",
          name: "OpenAPI Endpoint Report",
          inputLanguage: "json.openapi",
          category: "Reports",
          menuPath: ["Reports", "OpenAPI", "Endpoints"],
          steps: [
            { use: "openapi-to-endpoint-table", params: {} },
            { use: "json-table-to-markdown-report", params: {} }
          ]
        },
        {
          id: "view-openapi-graph",
          name: "View OpenAPI Graph",
          inputLanguage: "json.openapi",
          category: "Graphs",
          menuPath: ["Graphs", "OpenAPI", "Dependency"],
          steps: [
            { use: "openapi-to-dependency-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "openapi-markdown-report",
          name: "OpenAPI Markdown Report",
          inputLanguage: "json.openapi",
          category: "Reports",
          menuPath: ["Reports", "OpenAPI", "Summary"],
          steps: [
            { use: "openapi-to-markdown-report", params: {} }
          ]
        },
        {
          id: "view-openapi-yaml-endpoints",
          name: "View OpenAPI YAML Endpoints",
          inputLanguage: "yaml.openapi",
          category: "Tables",
          menuPath: ["Tables", "OpenAPI YAML", "Endpoints"],
          steps: [
            { use: "yaml-openapi-to-json-openapi", params: {} },
            { use: "openapi-to-endpoint-table", params: {} },
            { use: "json-table-renderer", params: {} }
          ]
        },
        {
          id: "view-openapi-yaml-graph",
          name: "View OpenAPI YAML Graph",
          inputLanguage: "yaml.openapi",
          category: "Graphs",
          menuPath: ["Graphs", "OpenAPI YAML", "Dependency"],
          steps: [
            { use: "yaml-openapi-to-json-openapi", params: {} },
            { use: "openapi-to-dependency-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "package-dependency-graph",
          name: "Package Dependency Graph",
          inputLanguage: "text.json",
          category: "Graphs",
          menuPath: ["Graphs", "Package JSON", "Dependencies"],
          steps: [
            { use: "package-json-to-dependency-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "package-dependency-report",
          name: "Package Dependency Report",
          inputLanguage: "text.json",
          category: "Reports",
          menuPath: ["Reports", "Package JSON", "Dependencies"],
          steps: [
            { use: "package-json-to-dependency-graph", params: {} },
            { use: "model-graph-to-markdown-report", params: {} }
          ]
        },
        {
          id: "view-javascript-outline",
          name: "View JavaScript Outline",
          inputLanguage: "text.javascript",
          category: "Analyze",
          menuPath: ["Analyze", "JavaScript", "Outline"],
          steps: [
            { use: "javascript-to-outline-tree", params: {} },
            { use: "json-tree-renderer", params: {} }
          ]
        },
        {
          id: "view-javascript-import-graph",
          name: "View JavaScript Import Graph",
          inputLanguage: "text.javascript",
          category: "Graphs",
          menuPath: ["Graphs", "JavaScript", "Imports"],
          steps: [
            { use: "javascript-imports-to-dependency-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "javascript-import-report",
          name: "JavaScript Import Report",
          inputLanguage: "text.javascript",
          category: "Reports",
          menuPath: ["Reports", "JavaScript", "Imports"],
          steps: [
            { use: "javascript-imports-to-dependency-graph", params: {} },
            { use: "model-graph-to-markdown-report", params: {} }
          ]
        },
        {
          id: "view-python-outline",
          name: "View Python Outline",
          inputLanguage: "text.python",
          category: "Analyze",
          menuPath: ["Analyze", "Python", "Outline"],
          steps: [
            { use: "python-to-outline-tree", params: {} },
            { use: "json-tree-renderer", params: {} }
          ]
        },
        {
          id: "view-python-import-graph",
          name: "View Python Import Graph",
          inputLanguage: "text.python",
          category: "Graphs",
          menuPath: ["Graphs", "Python", "Imports"],
          steps: [
            { use: "python-imports-to-dependency-graph", params: {} },
            { use: "model-graph-to-cytoscape", params: {} },
            { use: "cytoscape-graph-preview", params: {} }
          ]
        },
        {
          id: "python-import-report",
          name: "Python Import Report",
          inputLanguage: "text.python",
          category: "Reports",
          menuPath: ["Reports", "Python", "Imports"],
          steps: [
            { use: "python-imports-to-dependency-graph", params: {} },
            { use: "model-graph-to-markdown-report", params: {} }
          ]
        }
      ]
    }
  });
})(window);
