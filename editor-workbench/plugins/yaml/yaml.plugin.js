(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    yaml: "plugins/yaml/runtime/yaml.bundle.js",
    codeMirror: "plugins/yaml/runtime/codemirror-yaml.bundle.js"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireYamlTools() {
    if (!global.EditorWorkbenchYaml || typeof global.EditorWorkbenchYaml.parseYaml !== "function") {
      throw new Error("YAML runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchYaml;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.yaml) {
      throw new Error("CodeMirror YAML runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function yamlFileName(sourceName) {
    var baseName = sourceName || "untitled.json";
    return baseName.replace(/\.[^.]+$/, "") + ".yaml";
  }

  function jsonFileName(sourceName, suffix) {
    var baseName = sourceName || "untitled.yaml";
    return baseName.replace(/\.[^.]+$/, "") + (suffix || "") + ".json";
  }

  function treeFileName(sourceName) {
    return jsonFileName(sourceName, ".tree");
  }

  async function lintYaml(input) {
    await requireRuntime(input.context).ensureScripts(RUNTIME_PATHS.yaml);
    return requireYamlTools().lintYaml(input.text || "").map(function (diagnostic) {
      return Object.assign({ languageId: input.languageId }, diagnostic);
    });
  }

  async function yamlToJson(input) {
    await requireRuntime(input.context).ensureScripts(RUNTIME_PATHS.yaml);
    return {
      text: requireYamlTools().toJsonText(input.text || "", 2),
      languageId: "text.json",
      fileName: jsonFileName(input.document && input.document.fileName)
    };
  }

  async function yamlOpenApiToJsonOpenApi(input) {
    await requireRuntime(input.context).ensureScripts(RUNTIME_PATHS.yaml);
    return {
      text: requireYamlTools().toJsonText(input.text || "", 2),
      languageId: "json.openapi",
      fileName: jsonFileName(input.document && input.document.fileName, ".openapi")
    };
  }

  async function jsonToYaml(input) {
    await requireRuntime(input.context).ensureScripts(RUNTIME_PATHS.yaml);
    return {
      text: requireYamlTools().fromJsonText(input.text || ""),
      languageId: "text.yaml",
      fileName: yamlFileName(input.document && input.document.fileName)
    };
  }

  async function yamlToTree(input) {
    await requireRuntime(input.context).ensureScripts(RUNTIME_PATHS.yaml);
    var value = requireYamlTools().parseYaml(input.text || "");
    if (!global.EditorWorkbenchFoundation || typeof global.EditorWorkbenchFoundation.jsonToTree !== "function") {
      throw new Error("Foundation tree transformer is not available.");
    }
    var result = global.EditorWorkbenchFoundation.jsonToTree({
      text: JSON.stringify(value),
      languageId: input.languageId,
      document: input.document
    });
    return Object.assign({}, result, {
      fileName: treeFileName(input.document && input.document.fileName)
    });
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "yaml-core",
    name: "YAML",
    version: "0.1.0",
    description: "YAML syntax, linting, JSON conversion, and shared tree pipelines.",
    documentationUrl: "https://yaml.org/spec/1.2.2/",
    getExampleDocument: function () {
      return {
        fileName: "example.yaml",
        languageId: "text.yaml",
        mimeType: "application/yaml",
        text: [
          "name: LocalEdit",
          "enabled: true",
          "plugins:",
          "  - markdown",
          "  - json",
          "  - yaml",
          "limits:",
          "  previewRows: 50"
        ].join("\n")
      };
    },
    contributes: {
      languages: [
        {
          id: "text.yaml",
          name: "YAML",
          parentLanguageId: "text",
          aliases: ["yaml"],
          fileExtensions: [".yaml", ".yml"],
          mediaTypes: ["application/yaml", "text/yaml", "application/x-yaml"],
          description: "YAML structured text documents."
        },
        {
          id: "yaml.openapi",
          name: "OpenAPI YAML",
          parentLanguageId: "text.yaml",
          fileExtensions: [".openapi.yaml", ".openapi.yml"],
          mediaType: "application/vnd.oai.openapi+yaml",
          description: "OpenAPI documents serialized as YAML."
        },
        {
          id: "yaml.frontmatter",
          name: "YAML Front Matter",
          parentLanguageId: "text.yaml",
          fileExtensions: [".frontmatter.yaml", ".frontmatter.yml"],
          mediaType: "application/yaml",
          description: "YAML front matter blocks."
        },
        {
          id: "yaml.config",
          name: "YAML Config",
          parentLanguageId: "text.yaml",
          fileExtensions: [".config.yaml", ".config.yml"],
          mediaType: "application/yaml",
          description: "Configuration-oriented YAML documents."
        }
      ],
      editors: [],
      editorExtensions: [
        {
          id: "yaml-codemirror",
          name: "YAML syntax",
          editor: "codemirror",
          languages: ["text.yaml"],
          createExtension: async function (context) {
            await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
            return [requireCodeMirrorTools().yaml()];
          }
        }
      ],
      linters: [
        {
          id: "yaml-parse-linter",
          name: "YAML parser",
          accepts: ["text.yaml"],
          parameters: {},
          lint: lintYaml
        }
      ],
      transformers: [
        {
          id: "yaml-to-json",
          name: "YAML to JSON",
          inputLanguage: "text.yaml",
          outputLanguage: "text.json",
          parameters: {},
          transform: yamlToJson
        },
        {
          id: "json-to-yaml",
          name: "JSON to YAML",
          inputLanguage: "text.json",
          outputLanguage: "text.yaml",
          parameters: {},
          transform: jsonToYaml
        },
        {
          id: "yaml-to-tree",
          name: "YAML to Tree",
          inputLanguage: "text.yaml",
          outputLanguage: "json.tree",
          visibility: "internal",
          lossy: true,
          parameters: {},
          transform: yamlToTree
        },
        {
          id: "yaml-openapi-to-json-openapi",
          name: "OpenAPI YAML to OpenAPI JSON",
          inputLanguage: "yaml.openapi",
          outputLanguage: "json.openapi",
          parameters: {},
          transform: yamlOpenApiToJsonOpenApi
        }
      ],
      renderers: [],
      exporters: [],
      pipelines: [
        {
          id: "view-yaml-as-tree",
          name: "View as Tree",
          inputLanguage: "text.yaml",
          steps: [
            { use: "yaml-to-tree", params: {} },
            { use: "json-tree-renderer", params: {} }
          ]
        },
        {
          id: "convert-yaml-to-json",
          name: "Convert to JSON",
          inputLanguage: "text.yaml",
          steps: [
            { use: "yaml-to-json", params: {} }
          ]
        },
        {
          id: "convert-json-to-yaml",
          name: "Convert to YAML",
          inputLanguage: "text.json",
          steps: [
            { use: "json-to-yaml", params: {} }
          ]
        },
        {
          id: "normalize-openapi-yaml-to-json",
          name: "Normalize OpenAPI YAML to JSON",
          inputLanguage: "yaml.openapi",
          steps: [
            { use: "yaml-openapi-to-json-openapi", params: {} }
          ]
        }
      ]
    }
  });
})(window);
