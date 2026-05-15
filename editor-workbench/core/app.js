(function (global) {
  "use strict";

  class App {
    constructor(host) {
      this.host = host;
      this.layout = null;
      this.storage = null;
      this.editor = null;
      this.languageRegistry = null;
      this.pluginRegistry = null;
      this.runtimeLoader = null;
      this.pluginLoader = null;
      this.pluginManager = null;
      this.diagnosticsManager = null;
      this.transformManager = null;
      this.renderManager = null;
      this.exportManager = null;
      this.pipelineRegistry = null;
      this.pipelineExecutor = null;
      this.toolbar = null;
      this.pluginPanel = null;
      this.diagnosticsPanel = null;
      this.document = new DocumentModel({ text: "", languageId: "plain-text" });
      this.autosaveTimer = 0;
      this.autoRefreshTimer = 0;
      this.autoRefreshEnabled = false;
      this.renderRefreshDelayMs = 3000;
      this.renderSessions = [];
    }

    async start() {
      try {
        this.layout = new EditorLayout();
        this.layout.setStatus("Starting " + this.host.mode + " mode.");

        this.storage = new WorkbenchStorage();
        await this.storage.init();

        this.languageRegistry = new LanguageRegistry();
        this.pluginRegistry = new ContributionRegistry();
        this.runtimeLoader = new RuntimeLoader(this.host);
        this.registerCoreContributions();
        this.registerPluginLanguages();

        this.pluginLoader = new PluginLoader(this.host, this.pluginRegistry);
        this.pluginManager = new PluginManager(this.host, this.storage, this.pluginLoader, this.pluginRegistry);
        this.diagnosticsManager = new DiagnosticsService(this.pluginRegistry, this.runtimeLoader);
        this.transformManager = new TransformManager(this.pluginRegistry, this.runtimeLoader);
        this.renderManager = new RenderManager(this.pluginRegistry, this.host);
        this.exportManager = new ExportManager(this.pluginRegistry, this.runtimeLoader);
        this.pipelineRegistry = new PipelineRegistry(this.pluginRegistry);
        this.pipelineExecutor = new PipelineExecutor(this.pluginRegistry, this.pipelineRegistry, {
          app: this,
          diagnostics: this.diagnosticsManager,
          runtime: this.runtimeLoader,
          renderManager: this.renderManager,
          exportManager: this.exportManager,
          editorManager: null,
          storage: this.storage,
          download: {
            text: downloadText,
            blob: downloadBlob
          }
        });

        this.editor = new EditorManager(this.pluginRegistry, this.runtimeLoader);
        this.pipelineExecutor.services.editorManager = this.editor;
        await this.editor.mount(this.layout.editorContainer, this.document.languageId);
        this.editor.onDidChange((text) => {
          this.document = this.document.cloneWith({ text: text });
          this.scheduleAutosave();
          this.scheduleAutoRefresh();
          this.updateStatus("Editing " + this.displayFileName() + ".");
        });

        this.toolbar = new Toolbar(this.layout, this);
        this.pluginPanel = new PluginManagerPanel(this.layout, this);
        this.diagnosticsPanel = new DiagnosticsPanel(this.layout, {
          onClose: () => {
            this.closeDiagnosticsPanel();
          },
          onSelectDiagnostic: (diagnostic) => {
            this.goToDiagnostic(diagnostic);
          }
        });

        this.pluginManager.onChange(() => {
          this.registerPluginLanguages();
          this.updateUi();
        });

        await this.restoreState();
        await this.pluginManager.loadKnownPlugins();
        await this.pluginManager.loadStartupPlugins();
        await this.loadUserPipelines();
        this.registerPluginLanguages();
        this.updateUi();
        this.editor.focus();
        this.updateStatus("Ready in " + this.host.mode + " mode.");
      } catch (error) {
        this.updateStatus("Startup failed: " + (error && error.message ? error.message : String(error)));
      }
    }

    registerCoreContributions() {
      this.pluginRegistry.registerPlugin({
        id: "localedit-core",
        name: "LocalEdit Core",
        version: "0.2.0",
        description: "Core languages, editors, and terminal pipeline steps.",
        contributes: {
          languages: [
            {
              id: "plain-text",
              name: "Plain Text",
              fileExtensions: [".txt", ".text", ".log"],
              mediaType: "text/plain",
              description: "Unstructured plain text."
            }
          ],
          editors: [
            {
              id: "codemirror",
              name: "CodeMirror",
              accepts: ["*"],
              createEditor: function () {
                return new CodeMirrorEditor();
              }
            },
            {
              id: "textarea",
              name: "Textarea",
              accepts: ["*"],
              createEditor: function () {
                return new TextareaEditor();
              }
            }
          ],
          editorExtensions: [],
          transformers: [],
          renderers: [],
          exporters: [],
          linters: [],
          terminalSteps: [
            {
              id: "replace-current-text",
              name: "Replace Current Text",
              accepts: ["*"],
              run: function (input) {
                var app = input.context.services.app;
                app.setDocument(input.sourceDocument.cloneWith({
                  text: input.text,
                  languageId: input.languageId
                }));
                return { action: "replace-current-text", diagnostics: input.diagnostics || [] };
              }
            },
            {
              id: "open-new-document",
              name: "Open New Document",
              accepts: ["*"],
              run: function (input) {
                var app = input.context.services.app;
                app.setDocument(new DocumentModel({
                  text: input.text,
                  languageId: input.languageId,
                  fileName: "pipeline-output.txt",
                  mimeType: "text/plain"
                }));
                return { action: "open-new-document", diagnostics: input.diagnostics || [] };
              }
            },
            {
              id: "copy-to-clipboard",
              name: "Copy To Clipboard",
              accepts: ["*"],
              run: async function (input) {
                if (!global.navigator || !global.navigator.clipboard || typeof global.navigator.clipboard.writeText !== "function") {
                  throw new Error("Clipboard API is not available.");
                }
                await global.navigator.clipboard.writeText(input.text || "");
                return { action: "copy-to-clipboard", diagnostics: input.diagnostics || [] };
              }
            },
            {
              id: "open-editor",
              name: "Open Editor",
              accepts: ["*"],
              parameters: {
                editorId: { type: "string", default: "codemirror" }
              },
              run: async function (input) {
                var editorManager = input.context.services.editorManager;
                await editorManager.switchEditor(input.params.editorId, input.text, input.languageId);
                return { action: "open-editor", diagnostics: input.diagnostics || [] };
              }
            }
          ],
          pipelines: []
        }
      }, { path: "" });
    }

    async restoreState() {
      var savedDocument = await this.storage.get("autosaveDocument");
      var selectedLanguage = await this.storage.get("selectedLanguage");

      if (savedDocument) {
        this.setDocument(new DocumentModel(savedDocument));
      }

      if (selectedLanguage) {
        this.setLanguage(selectedLanguage);
      }
    }

    async loadUserPipelines() {
      var stored = await this.storage.get("userPipelines");
      if (!Array.isArray(stored)) {
        return;
      }
      stored.forEach((pipeline) => {
        try {
          this.pipelineRegistry.registerUserPipeline(pipeline);
        } catch (error) {
          // Invalid saved pipelines are ignored until the user edits them.
        }
      });
    }

    async registerUserPipeline(pipeline) {
      this.pipelineRegistry.registerUserPipeline(pipeline);
      await this.storage.set("userPipelines", this.pipelineRegistry.list().filter(function (item) {
        return !item.pluginId;
      }));
      this.updateUi();
    }

    async openFile() {
      try {
        var nextDocument = await openTextFile();
        var inferredLanguage = this.languageRegistry.inferFromFileName(nextDocument.fileName) || "plain-text";
        this.setDocument(nextDocument.cloneWith({ languageId: inferredLanguage }));
        await this.persistDocument();
        this.updateStatus("Opened " + this.displayFileName() + ".");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async saveSourceAsDownload() {
      var fileName = this.document.fileName || "untitled.txt";
      downloadText(fileName, this.editor.getText(), this.document.mimeType || "text/plain");
      this.updateStatus("Downloaded " + fileName + ".");
    }

    getDocument() {
      return this.document;
    }

    setDocument(documentModel) {
      this.document = new DocumentModel(documentModel);
      this.editor.setText(this.document.text, this.document.languageId);
      this.updateUi();
      this.scheduleAutosave();
    }

    setLanguage(languageId) {
      var language = this.languageRegistry.get(languageId);
      var nextLanguageId = language ? language.id : languageId || "plain-text";
      this.document = this.document.cloneWith({ languageId: nextLanguageId });
      if (this.editor) {
        this.editor.applyLanguage(nextLanguageId);
      }
      if (this.storage) {
        this.storage.set("selectedLanguage", nextLanguageId);
      }
      this.updateUi();
    }

    async switchEditor(editorId) {
      try {
        await this.editor.switchEditor(editorId, this.editor.getText(), this.document.languageId);
        this.updateUi();
        this.updateStatus("Editor changed.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async runLinters() {
      var diagnostics = await this.diagnosticsManager.runLinters(this.document);
      this.editor.setDiagnostics(diagnostics);
      this.diagnosticsPanel.render(diagnostics, this.document);
      this.layout.setDiagnosticsPanelOpen(true);
      this.updateStatus("Diagnostics complete: " + diagnostics.length + " result" + (diagnostics.length === 1 ? "." : "s."));
    }

    closeDiagnosticsPanel() {
      this.layout.setDiagnosticsPanelOpen(false);
    }

    goToDiagnostic(diagnostic) {
      if (!diagnostic) {
        return;
      }
      var start = diagnostic.range && diagnostic.range.start;
      var end = diagnostic.range && diagnostic.range.end;
      var from = start && Number.isFinite(start.offset) ? start.offset : 0;
      var to = end && Number.isFinite(end.offset) ? end.offset : from;
      this.editor.selectRange(from, to);
    }

    async runTransformer(transformerId) {
      if (!transformerId) {
        return;
      }

      try {
        await this.executePipeline({
          id: "direct-transform-" + transformerId,
          name: "Run " + transformerId,
          inputLanguage: this.document.languageId,
          steps: [
            { use: transformerId, params: {} },
            { use: "replace-current-text", params: {} }
          ]
        });
        this.updateStatus("Transformer complete.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async openRenderer(rendererId) {
      if (!rendererId) {
        return;
      }

      try {
        var result = await this.executePipeline({
          id: "direct-render-" + rendererId,
          name: "Render " + rendererId,
          inputLanguage: this.document.languageId,
          steps: [
            { use: rendererId, params: {} }
          ]
        });
        if (result && result.session) {
          this.renderSessions.push(result.session);
          this.pruneRenderSessions();
        }
        this.updateUi();
        this.updateStatus("Render window opened.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    refreshRenderers() {
      this.pruneRenderSessions();
      if (this.renderSessions.length === 0) {
        this.updateStatus("No open render windows to refresh.");
        this.updateUi();
        return;
      }

      this.renderSessions.forEach((session) => {
        session.refresh(this.document);
      });
      this.updateStatus("Refreshed " + this.renderSessions.length + " render window" + (this.renderSessions.length === 1 ? "." : "s."));
      this.updateUi();
    }

    setAutoRefresh(enabled) {
      this.autoRefreshEnabled = Boolean(enabled);
      if (this.autoRefreshEnabled) {
        this.scheduleAutoRefresh();
        this.updateStatus("Auto-refresh enabled after " + this.renderRefreshDelayMs / 1000 + "s of stable source.");
      } else {
        global.clearTimeout(this.autoRefreshTimer);
        this.updateStatus("Auto-refresh disabled.");
      }
      this.updateUi();
    }

    async runExporter(exporterId) {
      if (!exporterId) {
        return;
      }

      try {
        var result = await this.executePipeline({
          id: "direct-export-" + exporterId,
          name: "Export " + exporterId,
          inputLanguage: this.document.languageId,
          steps: [
            { use: exporterId, params: {} }
          ]
        });
        if (result && result.action === "export") {
          this.downloadExportResult(result.result);
        }
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async runPipeline(pipelineId) {
      if (!pipelineId) {
        return;
      }

      try {
        var result = await this.executePipeline(pipelineId);
        if (result && result.action === "export") {
          this.downloadExportResult(result.result);
        }
        if (result && result.action === "copy-to-clipboard") {
          this.updateStatus("Copied pipeline output.");
          return;
        }
        this.updateUi();
        this.updateStatus("Pipeline complete.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async executePipeline(pipelineOrId) {
      return this.pipelineExecutor.execute(pipelineOrId, this.document);
    }

    downloadExportResult(result) {
      if (!result) {
        throw new Error("Exporter returned no result.");
      }
      var content = result.content || result.blob;
      var fileName = result.fileName || "export.bin";
      var blob = content instanceof Blob ? content : new Blob([content], { type: result.mimeType || "application/octet-stream" });
      downloadBlob(fileName, blob);
      this.updateStatus("Exported " + fileName + ".");
    }

    togglePluginManagerPanel(open) {
      var nextOpen = typeof open === "boolean" ? open : !this.layout.isPluginPanelOpen();
      this.layout.setPluginPanelOpen(nextOpen);
      this.updateUi();
    }

    async addKnownPlugin(path) {
      try {
        await this.pluginManager.addKnownPlugin(path);
        this.updateStatus("Added " + path + ".");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async uploadPluginFile(file) {
      try {
        var result = await this.pluginManager.loadUploadedPluginFile(file);
        this.updateStatus(result.status === "loaded" ? "Uploaded plugin loaded." : result.error);
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async loadKnownPlugin(pluginId) {
      try {
        var result = await this.pluginManager.loadPlugin(pluginId);
        this.updateStatus(result.status === "loaded" ? "Plugin loaded." : result.error);
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async loadPluginExample(pluginId) {
      try {
        var plugin = this.pluginRegistry.getPlugin(pluginId);
        if (!plugin || !plugin.plugin || typeof plugin.plugin.getExampleDocument !== "function") {
          throw new Error("Example file is not available for this plugin.");
        }

        var example = plugin.plugin.getExampleDocument();
        if (!example || typeof example.text !== "string") {
          throw new Error("Plugin example file is invalid.");
        }

        this.setDocument(new DocumentModel({
          text: example.text,
          languageId: example.languageId || plugin.languages[0] || "plain-text",
          fileName: example.fileName || "example.txt",
          mimeType: example.mimeType || "text/plain"
        }));
        await this.persistDocument();
        this.updateStatus("Example file loaded.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    disablePlugin(pluginId) {
      this.pluginManager.disablePlugin(pluginId);
      this.updateStatus("Plugin disabled.");
    }

    async setPluginAutoLoad(pluginId, autoLoad) {
      try {
        await this.pluginManager.setAutoLoad(pluginId, autoLoad);
        this.updateStatus("Plugin auto-load updated.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async removeKnownPlugin(pluginId) {
      await this.pluginManager.removeKnownPlugin(pluginId);
      this.updateStatus("Plugin removed.");
    }

    updateUi() {
      if (!this.toolbar || !this.pluginPanel || !this.pluginManager) {
        return;
      }

      var languageId = this.document.languageId;
      if (this.editor) {
        this.editor.applyLanguage(languageId);
      }
      this.toolbar.update({
        languageId: languageId,
        languages: this.languageRegistry.list(),
        editorId: this.editor ? this.editor.getActiveEditorId() : "",
        editors: this.editor ? this.editor.listEditors(languageId) : [],
        transformers: this.transformManager.list(languageId),
        renderers: this.renderManager.list(languageId),
        exporters: this.exportManager.list(languageId),
        pipelines: this.pipelineRegistry.list(languageId),
        autoRefreshEnabled: this.autoRefreshEnabled,
        hasRenderSessions: this.hasOpenRenderSessions()
      });

      this.pluginPanel.render({
        canAddPluginPath: this.host.canAddPluginPath(),
        canUploadPluginFile: this.host.canUploadPluginFile(),
        items: this.pluginManager.getPanelItems()
      });
    }

    registerPluginLanguages() {
      if (!this.pluginRegistry || !this.languageRegistry) {
        return;
      }

      this.pluginRegistry.getLanguages().forEach((definition) => {
        if (definition && definition.id && !this.languageRegistry.get(definition.id)) {
          this.languageRegistry.register(definition);
        }
      });
    }

    scheduleAutosave() {
      global.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = global.setTimeout(() => {
        this.persistDocument();
      }, 300);
    }

    scheduleAutoRefresh() {
      global.clearTimeout(this.autoRefreshTimer);
      if (!this.autoRefreshEnabled) {
        return;
      }

      this.autoRefreshTimer = global.setTimeout(() => {
        this.refreshRenderers();
      }, this.renderRefreshDelayMs);
    }

    pruneRenderSessions() {
      this.renderSessions = this.renderSessions.filter(function (session) {
        return session.isOpen();
      });
    }

    hasOpenRenderSessions() {
      this.pruneRenderSessions();
      return this.renderSessions.length > 0;
    }

    async persistDocument() {
      if (!this.storage) {
        return;
      }

      await this.storage.set("autosaveDocument", this.document);
      await this.storage.set("selectedLanguage", this.document.languageId);
    }

    displayFileName() {
      return this.document.fileName || "untitled.txt";
    }

    updateStatus(message) {
      if (this.layout) {
        this.layout.setStatus(message);
      }
    }
  }

  global.App = App;
})(window);
