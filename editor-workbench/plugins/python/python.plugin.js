(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    codeMirror: "plugins/python/runtime/codemirror-python.bundle.js",
    ruff: "plugins/python/runtime/ruff-python.bundle.js"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.python) {
      throw new Error("CodeMirror Python runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function requireRuffTools() {
    if (!global.EditorWorkbenchRuffPython || typeof global.EditorWorkbenchRuffPython.formatPython !== "function") {
      throw new Error("Ruff Python runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchRuffPython;
  }

  async function formatPython(documentModel, context) {
    await requireRuntime(context).ensureScripts(RUNTIME_PATHS.ruff);
    return {
      text: await requireRuffTools().formatPython(documentModel.text || ""),
      languageId: "python",
      fileName: documentModel.fileName,
      mode: "replace-current"
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "python-core",
    name: "Python",
    version: "0.1.0",
    description: "Python syntax highlighting and Ruff formatting.",
    languages: ["python"],
    languageDefinitions: [
      {
        id: "python",
        label: "Python",
        extensions: ["py", "pyw"],
        mimeTypes: ["text/x-python"]
      }
    ],
    highlighters: [
      {
        id: "python-codemirror",
        name: "Python syntax",
        languages: ["python"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().python()];
        }
      }
    ],
    linters: [],
    transformers: [
      {
        id: "python-format",
        name: "Format Python",
        inputLanguages: ["python"],
        transform: formatPython
      }
    ],
    renderers: [],
    exporters: []
  });
})(window);
