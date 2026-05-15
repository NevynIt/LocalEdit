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
[
  "text.json",
  "json.tree",
  "json.table",
  "json.indented-tree",
  "json.model-graph",
  "json.cytoscape",
  "json.jsmind",
  "localedit.pipeline-json",
  "text.indented-tree",
  "text.csv",
  "text.xml",
  "text.yaml",
  "yaml.openapi",
  "yaml.frontmatter",
  "yaml.config",
  "text.mermaid",
  "text.graphviz-dot"
].forEach((languageId) => {
  assert.ok(packagedRegistry.getLanguages().some((language) => language.id === languageId), `${languageId} language is registered`);
});

[
  "json.table.action-list",
  "json.table.risk-register",
  "json.table.endpoint-list",
  "json.table.traceability-matrix",
  "json.table.role-activity",
  "json.model-graph.process",
  "json.model-graph.architecture",
  "json.model-graph.traceability",
  "json.model-graph.dependency",
  "json.profile",
  "json.chart",
  "xml.opml",
  "xml.bpmn",
  "xml.archimate-exchange"
].forEach((languageId) => {
  assert.ok(packagedRegistry.getLanguages().some((language) => language.id === languageId), `${languageId} profile language is registered`);
});

[
  "json-tree-preview",
  "json-cytoscape-tree-preview",
  "xml-tree-preview",
  "csv-table-preview",
  "indented-tree-outline-preview",
  "indented-tree-cytoscape-preview",
  "indented-tree-json-export",
  "indented-tree-cytoscape-export",
  "mermaid-svg-preview",
  "mermaid-svg-export",
  "graphviz-svg-preview",
  "graphviz-svg-export"
].forEach((contributionId) => {
  assert.equal(packagedRegistry.findContribution(contributionId), undefined, `${contributionId} should be replaced by pipelines`);
});

const replacementPipelineIds = [
  "view-json-as-tree",
  "view-json-as-graph",
  "view-xml-as-tree",
  "view-csv-as-table",
  "view-indented-tree-as-tree",
  "view-indented-tree-as-graph",
  "export-indented-tree-json",
  "export-indented-tree-cytoscape-json",
  "view-mermaid-as-svg",
  "export-mermaid-as-svg",
  "view-graphviz-as-svg",
  "export-graphviz-as-svg",
  "view-yaml-as-tree",
  "convert-yaml-to-json",
  "convert-json-to-yaml",
  "normalize-openapi-yaml-to-json",
  "view-markdown-outline-as-tree",
  "view-markdown-table",
  "view-markdown-tasks-as-action-list",
  "markdown-actions-report",
  "convert-markdown-outline-to-opml",
  "view-indented-tree-as-action-list",
  "indented-tree-actions-report",
  "export-indented-tree-as-opml",
  "convert-opml-to-indented-tree",
  "view-opml-as-tree",
  "view-opml-as-mind-map",
  "json-table-markdown-report",
  "model-graph-markdown-report",
  "profile-json-table",
  "json-table-profile-report",
  "view-json-table-chart",
  "export-json-table-chart-svg",
  "export-json-table-chart-png",
  "csv-profile-report",
  "view-csv-chart",
  "export-csv-chart-png",
  "view-json-chart-as-svg",
  "export-json-chart-as-svg",
  "view-indented-tree-as-process-graph",
  "indented-tree-process-mermaid",
  "view-process-graph",
  "view-process-as-mermaid-svg",
  "process-to-dot",
  "process-role-activity-table",
  "process-report",
  "export-process-bpmn",
  "view-bpmn-as-process-graph",
  "bpmn-role-activity-table",
  "bpmn-process-report",
  "table-to-architecture-graph",
  "csv-to-architecture-graph",
  "view-architecture-graph",
  "architecture-traceability-table",
  "architecture-traceability-graph",
  "architecture-report",
  "export-architecture-archimate",
  "view-archimate-as-architecture-graph",
  "archimate-architecture-report",
  "view-openapi-endpoints",
  "openapi-endpoint-report",
  "view-openapi-graph",
  "openapi-markdown-report",
  "view-openapi-yaml-endpoints",
  "view-openapi-yaml-graph",
  "package-dependency-graph",
  "package-dependency-report",
  "view-javascript-outline",
  "view-javascript-import-graph",
  "javascript-import-report",
  "view-python-outline",
  "view-python-import-graph",
  "python-import-report"
];
replacementPipelineIds.forEach((pipelineId) => {
  assert.ok(packagedRegistry.getContribution("pipeline", pipelineId), `${pipelineId} pipeline is registered`);
});
assert.equal(packagedRegistry.getContribution("transformer", "json-to-tree").visibility, "internal");
assert.equal(packagedRegistry.getContribution("transformer", "yaml-to-tree").visibility, "internal");
assert.equal(packagedRegistry.getContribution("transformer", "markdown-tasks-to-action-list").visibility, "internal");
assert.equal(packagedRegistry.getContribution("transformer", "json-table-to-profile").visibility, "internal");
assert.equal(packagedRegistry.getContribution("transformer", "process-graph-to-bpmn").visibility, "internal");
assert.equal(packagedRegistry.getContribution("transformer", "architecture-graph-to-archimate").visibility, "internal");
assert.equal(packagedRegistry.getContribution("transformer", "openapi-to-endpoint-table").visibility, "internal");
assert.deepEqual(Array.from(packagedRegistry.getContribution("pipeline", "view-openapi-endpoints").menuPath), ["Tables", "OpenAPI", "Endpoints"]);
assert.deepEqual(Array.from(packagedRegistry.getContribution("pipeline", "view-markdown-tasks-as-action-list").menuPath), ["Tables", "Markdown", "Tasks as Actions"]);

const packagedLanguageRegistry = new context.LanguageRegistry();
packagedLanguageRegistry.register({
  id: "text",
  name: "Text",
  parentLanguageId: null,
  mediaType: "text/plain"
});
packagedLanguageRegistry.register({
  id: "text.plain",
  name: "Plain Text",
  parentLanguageId: "text",
  aliases: ["plain-text"],
  fileExtensions: ["txt"],
  mediaType: "text/plain"
});
packagedRegistry.getLanguages().forEach((language) => {
  packagedLanguageRegistry.register(language);
});
const packagedPipelineRegistry = new context.PipelineRegistry(packagedRegistry, packagedLanguageRegistry);
replacementPipelineIds.forEach((pipelineId) => {
  assert.equal(packagedPipelineRegistry.validate(packagedPipelineRegistry.get(pipelineId)), true, `${pipelineId} pipeline validates`);
});

function transformResult(id, text, languageId, fileName) {
  const transformer = packagedRegistry.getContribution("transformer", id);
  assert.ok(transformer, `${id} transformer exists`);
  return transformer.transform({
    text,
    languageId,
    params: {},
    document: {
      text,
      languageId,
      fileName: fileName || "sample.txt",
      mimeType: ""
    },
    context: {}
  });
}

const markdownActions = transformResult(
  "markdown-tasks-to-action-list",
  "# Plan\n\n- [ ] Ship menu @alex due 2026-06-01\n- [x] Write tests",
  "text.markdown",
  "plan.md"
);
assert.equal(markdownActions.languageId, "json.table.action-list");
assert.equal(JSON.parse(markdownActions.text).rows.length, 2);

const opmlTree = transformResult(
  "opml-to-tree",
  "<?xml version=\"1.0\"?><opml><body><outline text=\"Root\"><outline text=\"Child\"/></outline></body></opml>",
  "xml.opml",
  "outline.opml"
);
assert.equal(opmlTree.languageId, "json.tree");
assert.equal(JSON.parse(opmlTree.text).root.children[0].label, "Root");

const sampleTable = JSON.stringify({
  format: "json.table",
  columns: [{ id: "name", label: "Name" }, { id: "value", label: "Value" }],
  rows: [
    { id: "row-1", cells: ["A", "10"] },
    { id: "row-2", cells: ["B", "20"] }
  ]
});
const profile = transformResult("json-table-to-profile", sampleTable, "json.table", "data.table.json");
assert.equal(profile.languageId, "json.profile");
assert.equal(JSON.parse(profile.text).summary.rows, 2);
const chart = transformResult("json-table-to-chart", sampleTable, "json.table", "data.table.json");
assert.equal(chart.languageId, "json.chart");
const chartSvg = transformResult("json-chart-to-svg", chart.text, "json.chart", "data.chart.json");
assert.equal(chartSvg.languageId, "xml.svg");
assert.match(chartSvg.text, /<svg/);

const bpmnGraph = transformResult(
  "bpmn-to-process-graph",
  "<bpmn:definitions><bpmn:process><bpmn:startEvent id=\"start\" name=\"Start\"/><bpmn:task id=\"task\" name=\"Do work\"/><bpmn:sequenceFlow id=\"flow\" sourceRef=\"start\" targetRef=\"task\"/></bpmn:process></bpmn:definitions>",
  "xml.bpmn",
  "process.bpmn"
);
assert.equal(bpmnGraph.languageId, "json.model-graph.process");
assert.equal(JSON.parse(bpmnGraph.text).edges.length, 1);

const archimateGraph = transformResult(
  "archimate-to-architecture-graph",
  "<model><elements><element identifier=\"app\" xsi:type=\"ApplicationComponent\"><name>App</name></element></elements><relationships><relationship identifier=\"r1\" source=\"app\" target=\"db\" xsi:type=\"ServingRelationship\"/></relationships></model>",
  "xml.archimate-exchange",
  "model.archimate"
);
assert.equal(archimateGraph.languageId, "json.model-graph.architecture");
assert.equal(JSON.parse(archimateGraph.text).nodes[0].label, "App");

const openapi = JSON.stringify({
  openapi: "3.1.0",
  info: { title: "API", version: "1" },
  paths: { "/users": { get: { operationId: "listUsers", responses: { "200": { description: "ok" } } } } },
  components: { schemas: { User: { type: "object" } } }
});
const endpoints = transformResult("openapi-to-endpoint-table", openapi, "json.openapi", "openapi.json");
assert.equal(endpoints.languageId, "json.table.endpoint-list");
assert.equal(JSON.parse(endpoints.text).rows[0].cells[1], "/users");

const packageGraph = transformResult(
  "package-json-to-dependency-graph",
  JSON.stringify({ name: "pkg", dependencies: { leftpad: "1.0.0" } }),
  "text.json",
  "package.json"
);
assert.equal(packageGraph.languageId, "json.model-graph.dependency");
assert.equal(JSON.parse(packageGraph.text).edges[0].label, "runtime");

const jsOutline = transformResult("javascript-to-outline-tree", "import x from 'x';\nexport function run() {}\nconst other = () => {}", "text.javascript", "app.js");
assert.equal(jsOutline.languageId, "json.tree");
assert.equal(JSON.parse(jsOutline.text).root.children.length, 2);
const pyImports = transformResult("python-imports-to-dependency-graph", "import os\nfrom pathlib import Path\n\ndef run():\n    pass", "text.python", "app.py");
assert.equal(pyImports.languageId, "json.model-graph.dependency");
assert.equal(JSON.parse(pyImports.text).edges.length, 2);

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
            fileName: "converted.beta",
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
    pipelines: [
      {
        id: "alpha-open",
        name: "Alpha Open",
        inputLanguage: "alpha",
        steps: [
          { use: "alpha-to-beta", params: { suffix: "?" } }
        ]
      },
      {
        id: "alpha-child-preview",
        name: "Alpha Child Preview",
        inputLanguage: "alpha.child",
        steps: [
          { use: "alpha-to-beta", params: { suffix: "!" } },
          { use: "beta-renderer", params: {} }
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

assert.throws(() => {
  registry.registerPlugin({
    id: "missing-output-language-plugin",
    name: "Missing Output Language Plugin",
    version: "1.0.0",
    contributes: {
      transformers: [
        {
          id: "alpha-missing-output",
          name: "Alpha Missing Output",
          inputLanguage: "alpha",
          transform() {
            return { text: "", languageId: "alpha" };
          }
        }
      ]
    }
  });
}, /must declare outputLanguage/);

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
  const pipeline = pipelineRegistry.get("alpha-open");
  assert.equal(pipelineRegistry.validate(pipeline), true);
  const childPipeline = pipelineRegistry.get("alpha-child-preview");
  assert.equal(pipelineRegistry.validate(childPipeline), true);
  const executor = new context.PipelineExecutor(registry, pipelineRegistry, {
    renderManager: {
      openContribution(contribution, previewDocument) {
        return {
          rendererId: contribution.id,
          previewDocument,
          isOpen() {
            return true;
          }
        };
      }
    }
  });
  const result = await executor.execute("alpha-open", documentModel);
  assert.equal(result.action, "open-new-document");
  assert.equal(result.document.text, "abc?");
  assert.equal(result.document.languageId, "beta");
  assert.equal(result.document.fileName, "converted.beta");
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
  assert.equal(preparedRenderInput.input.fileName, "converted.beta");

  const childDocumentModel = new context.DocumentModel({ text: "xyz", languageId: "alpha.child" });
  const childResult = await executor.execute("alpha-child-preview", childDocumentModel);
  assert.equal(childResult.action, "render");
  assert.equal(childResult.diagnostics.length, 1);

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
