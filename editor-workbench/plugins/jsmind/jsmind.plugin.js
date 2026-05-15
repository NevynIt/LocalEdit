(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    jsmind: "plugins/jsmind/runtime/jsmind.bundle.js",
    css: "plugins/jsmind/runtime/jsmind.css"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireIndentedTreeTools() {
    if (!global.EditorWorkbenchIndentedTree || typeof global.EditorWorkbenchIndentedTree.parse !== "function") {
      throw new Error("Indented Tree parser is not available.");
    }
    return global.EditorWorkbenchIndentedTree;
  }

  function requireJsMind() {
    var tools = global.EditorWorkbenchJsMind;
    var jsMind = tools && tools.jsMind || global.jsMind;
    if (typeof jsMind !== "function") {
      throw new Error("jsMind runtime bundle is not loaded.");
    }
    return jsMind;
  }

  function ensureJsMindStyles() {
    if (document.getElementById("editor-workbench-jsmind-css")) {
      return;
    }
    var link = document.createElement("link");
    link.id = "editor-workbench-jsmind-css";
    link.rel = "stylesheet";
    link.href = RUNTIME_PATHS.css;
    document.head.appendChild(link);
  }

  function ensureShellStyles() {
    if (document.getElementById("editor-workbench-jsmind-shell-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "editor-workbench-jsmind-shell-style";
    style.textContent = [
      ".jsmind-render-shell { height: calc(100vh - 32px); min-height: 360px; overflow: hidden; border: 1px solid var(--border, #cbd3df); border-radius: 6px; background: #fff; }",
      ".jsmind-render-shell .jsmind-inner { width: 100%; height: 100%; }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function sanitizeId(value, fallback) {
    var text = String(value || "").trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!text || !/^[A-Za-z]/.test(text)) {
      text = fallback;
    }
    return text;
  }

  function buildTreeNode(node, nodeByInternalId, usedIds) {
    var baseId = sanitizeId(node.id || node.internalId, node.internalId);
    var id = baseId;
    var suffix = 2;
    while (usedIds.has(id)) {
      id = baseId + "-" + suffix;
      suffix += 1;
    }
    usedIds.add(id);

    var data = {};
    if (node.type) {
      data.type = node.type;
    }
    if (node.tags && node.tags.length) {
      data.tags = node.tags.slice();
    }
    if (node.details) {
      data.details = node.details;
    }
    if (node.attributes && Object.keys(node.attributes).length) {
      data.attributes = node.attributes;
    }

    var output = {
      id: id,
      topic: node.label || id,
      expanded: true
    };
    if (Object.keys(data).length) {
      output.data = data;
    }

    var children = (node.children || []).map(function (childId) {
      return buildTreeNode(nodeByInternalId.get(childId), nodeByInternalId, usedIds);
    }).filter(Boolean);
    if (children.length) {
      output.children = children;
    }
    return output;
  }

  function indentedTreeToJsMind(input) {
    var parser = requireIndentedTreeTools();
    var parsed = parser.parse(input.text || "");
    var nodeByInternalId = new Map();
    parsed.nodes.forEach(function (node) {
      nodeByInternalId.set(node.internalId, node);
    });

    var usedIds = new Set(["root"]);
    var rootChildren = parsed.roots.map(function (rootId) {
      return buildTreeNode(nodeByInternalId.get(rootId), nodeByInternalId, usedIds);
    }).filter(Boolean);

    var rootTopic = parsed.metadata && parsed.metadata.title ? String(parsed.metadata.title) : "Mind Map";
    var data = rootChildren.length === 1
      ? rootChildren[0]
      : {
          id: "root",
          topic: rootTopic,
          expanded: true,
          children: rootChildren
        };

    return {
      text: JSON.stringify({
        meta: {
          name: rootTopic,
          author: "LocalEdit",
          version: "1.0"
        },
        format: "node_tree",
        data: data
      }, null, 2),
      languageId: "jsmind-json",
      diagnostics: parsed.diagnostics || []
    };
  }

  function renderJsMind(input) {
    var mind = JSON.parse(input.text || "");
    return requireRuntime(input.context).ensureScripts(RUNTIME_PATHS.jsmind).then(function () {
      var jsMind = requireJsMind();
      return {
        kind: "custom",
        content: {
          mount: function (target) {
            ensureJsMindStyles();
            ensureShellStyles();
            var shell = document.createElement("div");
            shell.className = "jsmind-render-shell";
            var inner = document.createElement("div");
            inner.className = "jsmind-inner";
            inner.id = "jsmind-" + Date.now() + "-" + Math.random().toString(36).slice(2);
            shell.appendChild(inner);
            target.appendChild(shell);
            var instance = new jsMind({
              container: inner.id,
              editable: false,
              theme: input.params.theme,
              mode: input.params.mode,
              support_html: false,
              view: {
                engine: "canvas",
                draggable: true,
                hide_scrollbars_when_draggable: false,
                hmargin: 80,
                vmargin: 40
              }
            });
            instance.show(mind);
            return function () {
              shell.remove();
            };
          }
        },
        mimeType: "application/x.editor-workbench.custom+jsmind"
      };
    });
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "jsmind-core",
    name: "jsMind",
    version: "0.1.0",
    description: "jsMind JSON language, Indented Tree conversion, and read-only mind-map rendering.",
    contributes: {
      languages: [
        {
          id: "jsmind-json",
          name: "jsMind JSON",
          fileExtensions: [".jm.json", ".jsmind.json"],
          mediaType: "application/vnd.jsmind+json",
          description: "jsMind node_tree JSON documents."
        }
      ],
      editors: [],
      editorExtensions: [
        {
          id: "jsmind-json-codemirror",
          name: "jsMind JSON syntax",
          editor: "codemirror",
          languages: ["jsmind-json"],
          createExtension: async function (context) {
            await requireRuntime(context).ensureScripts("plugins/json/runtime/codemirror-json.bundle.js");
            return [global.EditorWorkbenchCodeMirror.json()];
          }
        }
      ],
      transformers: [
        {
          id: "indented-tree-to-jsmind-json",
          name: "Indented Tree to jsMind JSON",
          inputLanguage: "indented-tree",
          outputLanguage: "jsmind-json",
          parameters: {},
          transform: indentedTreeToJsMind
        }
      ],
      renderers: [
        {
          id: "jsmind-renderer",
          name: "jsMind Mind Map",
          accepts: ["jsmind-json"],
          outputKind: "custom",
          parameters: {
            theme: { type: "string", default: "primary" },
            mode: { type: "enum", values: ["full", "side"], default: "full" }
          },
          render: renderJsMind
        }
      ],
      exporters: [],
      linters: [
        {
          id: "jsmind-json-linter",
          name: "jsMind JSON parser",
          accepts: ["jsmind-json"],
          lint: function (input) {
            try {
              var value = JSON.parse(input.text || "");
              if (!value || value.format !== "node_tree" || !value.data || !value.data.id || !value.data.topic) {
                return [{
                  source: "jsMind JSON",
                  severity: "error",
                  message: "jsMind JSON must be a node_tree document with root data.id and data.topic.",
                  languageId: input.languageId
                }];
              }
              return [];
            } catch (error) {
              return [{
                source: "jsMind JSON",
                severity: "error",
                message: error && error.message ? error.message : String(error),
                languageId: input.languageId
              }];
            }
          }
        }
      ],
      terminalSteps: [],
      pipelines: [
        {
          id: "view-indented-tree-as-mindmap",
          name: "View as Mind Map",
          inputLanguage: "indented-tree",
          steps: [
            { use: "indented-tree-to-jsmind-json", params: {} },
            { use: "jsmind-renderer", params: {} }
          ]
        }
      ]
    }
  });
})(window);
