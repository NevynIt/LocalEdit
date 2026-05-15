const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const context = {
  console,
  window: {},
  Blob: class Blob {},
  setTimeout,
  clearTimeout
};
context.window = context;
vm.createContext(context);

function load(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

[
  "editor-workbench/core/document-model.js",
  "editor-workbench/core/workspace-manager.js",
  "editor-workbench/core/language-registry.js",
  "editor-workbench/core/plugin-types.js",
  "editor-workbench/core/parameter-schema.js",
  "editor-workbench/core/contribution-registry.js",
  "editor-workbench/core/diagnostics-service.js",
  "editor-workbench/core/editor-manager.js",
  "editor-workbench/core/pipeline-registry.js",
  "editor-workbench/core/pipeline-executor.js"
].forEach(load);

context.EditorPlugins = [];
function walkPluginFiles(dir, files = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPluginFiles(relative, files);
    } else if (entry.isFile() && entry.name.endsWith(".plugin.js")) {
      files.push(relative);
    }
  }
  return files;
}

const packagedRegistry = new context.ContributionRegistry();
for (const pluginFile of walkPluginFiles("editor-workbench/plugins")) {
  const before = context.EditorPlugins.length;
  load(pluginFile);
  const loaded = context.EditorPlugins.slice(before);
  assert.ok(loaded.length > 0, `${pluginFile} did not register a plugin`);
  for (const plugin of loaded) {
    assert.ok(plugin.contributes, `${plugin.id} must expose contributes`);
    for (const legacyField of ["languageDefinitions", "highlighters", "linters", "transformers", "renderers", "exporters"]) {
      assert.equal(Object.prototype.hasOwnProperty.call(plugin, legacyField), false, `${plugin.id} exposes legacy ${legacyField}`);
    }
    packagedRegistry.registerPlugin(plugin, { path: pluginFile.replace(/\\/g, "/").replace("editor-workbench/", "") });
  }
}
assert.ok(packagedRegistry.getLanguages().some((language) => language.id === "localedit-pipeline-json"));
assert.ok(packagedRegistry.getLanguages().some((language) => language.id === "jsmind-json"));

const languageRegistry = new context.LanguageRegistry();
languageRegistry.register({
  id: "text",
  name: "Text",
  parentLanguageId: null,
  mediaType: "text/plain"
});
languageRegistry.register({
  id: "text.plain",
  name: "Plain Text",
  parentLanguageId: "text",
  aliases: ["plain-text"],
  fileExtensions: ["txt", ".log"],
  mediaType: "text/plain"
});
languageRegistry.register({
  id: "json",
  name: "JSON",
  parentLanguageId: "text",
  fileExtensions: ["json"],
  mediaType: "application/json"
});
languageRegistry.register({
  id: "json.table",
  name: "JSON Table",
  parentLanguageId: "json",
  fileExtensions: ["table.json"],
  mediaType: "application/json"
});

assert.equal(languageRegistry.getCanonicalId("plain-text"), "text.plain");
assert.equal(languageRegistry.get("plain-text").id, "text.plain");
assert.deepEqual(Array.from(languageRegistry.getAncestors("json.table")), ["json", "text"]);
assert.equal(languageRegistry.isSameOrDescendantOf("json.table", "json"), true);
assert.equal(languageRegistry.isSameOrDescendantOf("json.table", "text"), true);
assert.equal(languageRegistry.getSpecificityDistance("json.table", "json"), 1);
assert.deepEqual(Array.from(languageRegistry.listApplicableLanguages("json.table")), ["json.table", "json", "text"]);
assert.equal(languageRegistry.inferFromFileName("report.table.json"), "json.table");
assert.equal(languageRegistry.inferFromFileName("notes.txt"), "text.plain");
const listedLanguages = Array.from(languageRegistry.list()).map((language) => language.id);
assert.equal(listedLanguages[0], "text");
assert.ok(listedLanguages.indexOf("json") < listedLanguages.indexOf("json.table"));
assert.ok(listedLanguages.indexOf("text") < listedLanguages.indexOf("text.plain"));

const workspace = new context.WorkspaceManager();
const firstRecord = workspace.openDocument(new context.DocumentModel({
  text: "one",
  languageId: "text.plain",
  fileName: "notes.txt"
}), { source: "test" });
assert.equal(workspace.getActiveDocumentId(), firstRecord.id);
assert.equal(workspace.getActiveDocument().text, "one");
workspace.updateText(firstRecord.id, "two");
assert.equal(workspace.getActiveDocument().text, "two");
const secondRecord = workspace.openDocument(new context.DocumentModel({
  text: "three",
  languageId: "text.plain",
  fileName: "notes.txt"
}), { source: "test" });
assert.equal(workspace.getActiveRecord().displayName, "notes.txt (2)");
workspace.setActiveDocument(firstRecord.id);
assert.equal(workspace.getActiveRecord().displayName, "notes.txt");
workspace.replaceDocument(firstRecord.id, new context.DocumentModel({
  text: "four",
  languageId: "text.plain",
  fileName: "renamed.txt"
}), { preserveClean: true });
assert.equal(workspace.getRecord(firstRecord.id).document.text, "four");
assert.equal(workspace.getRecord(firstRecord.id).displayName, "renamed.txt");
workspace.renameDocument(firstRecord.id, "final.txt");
assert.equal(workspace.getRecord(firstRecord.id).document.fileName, "final.txt");
assert.equal(workspace.getRecord(firstRecord.id).displayName, "final.txt");
assert.equal(workspace.closeDocument(secondRecord.id).id, secondRecord.id);
assert.equal(workspace.listRecords().length, 1);

languageRegistry.register({
  id: "alpha",
  name: "Alpha",
  parentLanguageId: "text",
  fileExtensions: ["a"],
  mediaType: "text/x-alpha"
});
languageRegistry.register({
  id: "alpha.child",
  name: "Alpha Child",
  parentLanguageId: "alpha",
  fileExtensions: ["child.a"],
  mediaType: "text/x-alpha-child"
});
languageRegistry.register({
  id: "beta",
  name: "Beta",
  parentLanguageId: "text",
  fileExtensions: ["b"],
  mediaType: "text/x-beta"
});

const registry = new context.ContributionRegistry(languageRegistry);
registry.registerPlugin({
  id: "test-plugin",
  name: "Test Plugin",
  version: "1.0.0",
  contributes: {
    languages: [
      { id: "alpha", name: "Alpha", parentLanguageId: "text", fileExtensions: [".a"], mediaType: "text/x-alpha" },
      { id: "alpha.child", name: "Alpha Child", parentLanguageId: "alpha", fileExtensions: [".child.a"], mediaType: "text/x-alpha-child" },
      { id: "beta", name: "Beta", parentLanguageId: "text", fileExtensions: [".b"], mediaType: "text/x-beta" }
    ],
    editors: [
      {
        id: "fake-a",
        name: "Fake A",
        accepts: ["*"],
        createEditor() {
          let text = "";
          let changeHandler = () => {};
          return {
            mount(container) {
              container.mounted = "fake-a";
            },
            onTextChanged(handler) {
              changeHandler = handler;
            },
            setText(nextText) {
              text = nextText;
            },
            getText() {
              return text;
            },
            setLanguage(languageId, options) {
              this.languageId = languageId;
              this.extensions = options.extensions;
            },
            setDiagnostics(items) {
              this.diagnostics = items;
            },
            trigger(nextText) {
              text = nextText;
              changeHandler(nextText);
            },
            destroy() {
              this.destroyed = true;
            },
            focus() {}
          };
        }
      },
      {
        id: "fake-b",
        name: "Fake B",
        accepts: ["*"],
        createEditor() {
          let text = "";
          let changeHandler = () => {};
          return {
            mount(container) {
              container.mounted = "fake-b";
            },
            onTextChanged(handler) {
              changeHandler = handler;
            },
            setText(nextText) {
              text = nextText;
            },
            getText() {
              return text;
            },
            setLanguage(languageId, options) {
              this.languageId = languageId;
              this.extensions = options.extensions;
            },
            setDiagnostics(items) {
              this.diagnostics = items;
            },
            trigger(nextText) {
              text = nextText;
              changeHandler(nextText);
            },
            destroy() {
              this.destroyed = true;
            },
            focus() {}
          };
        }
      }
    ],
    editorExtensions: [],
    transformers: [
      {
        id: "alpha-to-beta",
        name: "Alpha to Beta",
        inputLanguage: "alpha",
        outputLanguage: "beta",
        parameters: {
          suffix: { type: "string", default: "!" }
        },
        transform(input) {
          return {
            text: input.text + input.params.suffix,
            languageId: "beta",
            diagnostics: [
              { source: "alpha-to-beta", severity: "information", message: "converted", languageId: "beta" }
            ]
          };
        }
      }
    ],
    renderers: [
      {
        id: "alpha-renderer",
        name: "Alpha Renderer",
        accepts: ["alpha"],
        render() {
          return { kind: "text", content: "alpha", mimeType: "text/plain" };
        }
      },
      {
        id: "alpha-child-renderer",
        name: "Alpha Child Renderer",
        accepts: ["alpha.child"],
        render() {
          return { kind: "text", content: "alpha child", mimeType: "text/plain" };
        }
      },
      {
        id: "beta-renderer",
        name: "Beta Renderer",
        accepts: ["beta"],
        render() {
          return { kind: "text", content: "rendered", mimeType: "text/plain" };
        }
      }
    ],
    exporters: [
      {
        id: "beta-exporter",
        name: "Beta Exporter",
        accepts: ["beta"],
        outputFileExtension: ".beta",
        mimeType: "text/plain",
        parameters: {
          prefix: { type: "string", default: "" }
        },
        export(input) {
          return {
            fileName: "out.beta",
            mimeType: "text/plain",
            content: input.params.prefix + input.text
          };
        }
      }
    ],
    linters: [
      {
        id: "alpha-linter",
        name: "Alpha Linter",
        accepts: ["alpha"],
        lint(input) {
          return [
            { source: "alpha-linter", severity: "warning", message: "warn", languageId: input.languageId, from: 0, to: 1 }
          ];
        }
      }
    ],
    terminalSteps: [
      {
        id: "capture",
        name: "Capture",
        accepts: ["beta"],
        run(input) {
          return { action: "capture", text: input.text, languageId: input.languageId, diagnostics: input.diagnostics };
        }
      }
    ],
    pipelines: [
      {
        id: "alpha-capture",
        name: "Alpha Capture",
        inputLanguage: "alpha",
        steps: [
          { use: "alpha-to-beta", params: { suffix: "?" } },
          { use: "capture", params: {} }
        ]
      },
      {
        id: "alpha-child-capture",
        name: "Alpha Child Capture",
        inputLanguage: "alpha.child",
        steps: [
          { use: "alpha-to-beta", params: { suffix: "!" } },
          { use: "capture", params: {} }
        ]
      }
    ]
  }
});

assert.equal(registry.getLanguages().length, 3);
assert.equal(registry.getEditors("alpha").length, 2);
assert.equal(registry.getTransformers("alpha")[0].id, "alpha-to-beta");
assert.equal(registry.getRenderers("beta")[0].id, "beta-renderer");
assert.deepEqual(Array.from(registry.getRenderers("alpha.child")).map((renderer) => renderer.id), ["alpha-child-renderer", "alpha-renderer"]);
assert.equal(registry.getExporters("beta")[0].id, "beta-exporter");
assert.equal(registry.getLinters("alpha")[0].id, "alpha-linter");
assert.equal(
  context.ParameterSchema.applyDefaults({ mode: { type: "enum", values: ["a", "b"], default: "a" } }, {}, "owner").mode,
  "a"
);
registry.registerPlugin({
  id: "missing-dependency-plugin",
  name: "Missing Dependency Plugin",
  version: "1.0.0",
  contributes: {
    transformers: [
      {
        id: "requires-missing-runtime",
        name: "Requires Missing Runtime",
        inputLanguage: "alpha",
        outputLanguage: "beta",
        requires: [{ kind: "transformer", id: "does-not-exist" }],
        transform() {
          return { text: "", languageId: "beta" };
        }
      }
    ]
  }
});
assert.equal(registry.getAvailability(registry.getContribution("transformer", "requires-missing-runtime")).state, "unavailable");

const diagnostics = new context.DiagnosticsService(registry, {});
const documentModel = new context.DocumentModel({ text: "abc", languageId: "alpha" });
diagnostics.runLinters(documentModel, "doc-1").then(async (items) => {
  assert.equal(items.length, 1);
  assert.equal(items[0].range.start.offset, 0);
  assert.equal(items[0].range.end.offset, 1);
  assert.equal(items[0].target.documentId, "doc-1");

  const secondItems = await diagnostics.runLinters(new context.DocumentModel({ text: "xyz", languageId: "alpha" }), "doc-2");
  assert.equal(secondItems.length, 1);
  assert.equal(diagnostics.list("doc-1").length, 1);
  assert.equal(diagnostics.list("doc-2").length, 1);
  assert.equal(diagnostics.list().length, 2);

  const pipelineRegistry = new context.PipelineRegistry(registry);
  const pipeline = pipelineRegistry.get("alpha-capture");
  assert.equal(pipelineRegistry.validate(pipeline), true);
  const childPipeline = pipelineRegistry.get("alpha-child-capture");
  assert.equal(pipelineRegistry.validate(childPipeline), true);
  const executor = new context.PipelineExecutor(registry, pipelineRegistry, {});
  const result = await executor.execute("alpha-capture", documentModel);
  assert.equal(result.action, "capture");
  assert.equal(result.text, "abc?");
  assert.equal(result.languageId, "beta");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.intermediateResults.length, 1);

  const preparedRenderInput = await executor.prepareTerminalInput({
    id: "alpha-preview",
    name: "Alpha Preview",
    inputLanguage: "alpha",
    steps: [
      { use: "alpha-to-beta", params: { suffix: "#" } },
      { use: "beta-renderer", params: {} }
    ]
  }, documentModel);
  assert.equal(preparedRenderInput.contribution.id, "beta-renderer");
  assert.equal(preparedRenderInput.input.text, "abc#");
  assert.equal(preparedRenderInput.input.languageId, "beta");

  const childDocumentModel = new context.DocumentModel({ text: "xyz", languageId: "alpha.child" });
  const childResult = await executor.execute("alpha-child-capture", childDocumentModel);
  assert.equal(childResult.action, "capture");
  assert.equal(childResult.text, "xyz!");
  assert.equal(childResult.languageId, "beta");

  const editorManager = new context.EditorManager(registry, {});
  const container = { textContent: "", mounted: "" };
  await editorManager.mount(container, "alpha");
  editorManager.setText("editor text", "alpha");
  assert.equal(editorManager.getText(), "editor text");
  await editorManager.switchEditor("fake-b", undefined, "alpha");
  assert.equal(container.mounted, "fake-b");
  assert.equal(editorManager.getText(), "editor text");
  let changedText = "";
  editorManager.onDidChange((text) => {
    changedText = text;
  });
  editorManager.activeEditor.trigger("changed");
  assert.equal(changedText, "changed");
  editorManager.setDiagnostics([{ message: "diagnostic" }]);
  assert.equal(editorManager.activeEditor.diagnostics.length, 1);

  console.log("Core contract checks passed.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
