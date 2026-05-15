(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    codeMirror: "plugins/javascript/runtime/codemirror-javascript.bundle.js",
    prettier: "plugins/javascript/runtime/prettier-javascript.bundle.js"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.javascript) {
      throw new Error("CodeMirror JavaScript runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function requirePrettierTools() {
    if (!global.EditorWorkbenchPrettierJavaScript || typeof global.EditorWorkbenchPrettierJavaScript.formatJavaScript !== "function") {
      throw new Error("Prettier JavaScript runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchPrettierJavaScript;
  }

  async function formatJavaScript(documentModel, context) {
    await requireRuntime(context).ensureScripts(RUNTIME_PATHS.prettier);
    return {
      text: await requirePrettierTools().formatJavaScript(documentModel.text || ""),
      languageId: "text.javascript",
      fileName: documentModel.fileName,
      mode: "replace-current"
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push(global.EditorPluginContracts.fromLegacy({
    id: "javascript-core",
    name: "JavaScript",
    version: "0.1.0",
    description: "JavaScript syntax highlighting and formatting.",
    documentationUrl: "https://developer.mozilla.org/docs/Web/JavaScript/Guide",
    getExampleDocument: function () {
      return {
        fileName: "example.js",
        languageId: "text.javascript",
        mimeType: "text/javascript",
        text: [
          "const plugins = [\"markdown\", \"json\", \"xml\"];",
          "",
          "function describePlugins(values) {",
          "  return values.map((value) => value.toUpperCase()).join(\", \");",
          "}",
          "",
          "console.log(describePlugins(plugins));"
        ].join("\n")
      };
    },
    languages: ["text.javascript"],
    languageDefinitions: [
      {
        id: "text.javascript",
        label: "JavaScript",
        aliases: ["javascript"],
        extensions: ["js", "mjs", "cjs"],
        mimeTypes: ["text/javascript", "application/javascript"]
      }
    ],
    highlighters: [
      {
        id: "javascript-codemirror",
        name: "JavaScript syntax",
        languages: ["text.javascript"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().javascript()];
        }
      }
    ],
    linters: [],
    transformers: [
      {
        id: "javascript-format",
        name: "Format JavaScript",
        inputLanguages: ["text.javascript"],
        outputLanguage: "text.javascript",
        transform: formatJavaScript
      }
    ],
    renderers: [],
    exporters: []
  }));
})(window);
