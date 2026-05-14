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
      this.toolbar = null;
      this.pluginPanel = null;
      this.diagnosticsPanel = null;
      this.document = new DocumentModel({ text: "", languageId: "plain-text" });
      this.autosaveTimer = 0;
      this.autoRefreshTimer = 0;
      this.autoRefreshEnabled = false;
      this.renderRefreshDelayMs = 3000;
      this.renderSessions = [];
      this.editorLanguageRequestId = 0;
    }

    async start() {
      try {
        this.layout = new EditorLayout();
        this.layout.setStatus("Starting " + this.host.mode + " mode.");

        this.storage = new WorkbenchStorage();
        await this.storage.init();

        this.languageRegistry = new LanguageRegistry();
        this.languageRegistry.register({
          id: "plain-text",
          label: "Plain Text",
          extensions: ["txt", "text", "log"],
          mimeTypes: ["text/plain"]
        });

        this.pluginRegistry = new PluginRegistry();
        this.runtimeLoader = new RuntimeLoader(this.host);
        this.pluginLoader = new PluginLoader(this.host, this.pluginRegistry);
        this.pluginManager = new PluginManager(this.host, this.storage, this.pluginLoader, this.pluginRegistry);
        this.diagnosticsManager = new DiagnosticsManager(this.pluginRegistry, this.runtimeLoader);
        this.transformManager = new TransformManager(this.pluginRegistry, this.runtimeLoader);
        this.renderManager = new RenderManager(this.pluginRegistry, this.host);
        this.exportManager = new ExportManager(this.pluginRegistry, this.runtimeLoader);

        this.editor = new EditorCore();
        this.editor.mount(this.layout.editorContainer);
        this.editor.onDidChange((text) => {
          this.document = this.document.cloneWith({ text: text });
          this.scheduleAutosave();
          this.scheduleAutoRefresh();
          this.updateStatus("Editing " + this.displayFileName() + ".");
        });

        this.toolbar = new Toolbar(this.layout, this);
        this.pluginPanel = new PluginManagerPanel(this.layout, this);
        this.diagnosticsPanel = new DiagnosticsPanel(this.layout);

        this.pluginManager.onChange(() => {
          this.registerPluginLanguages();
          this.updateUi();
        });

        await this.restoreState();
        await this.pluginManager.loadKnownPlugins();
        await this.pluginManager.loadStartupPlugins();
        this.updateUi();
        this.editor.focus();
        this.updateStatus("Ready in " + this.host.mode + " mode.");
      } catch (error) {
        this.updateStatus("Startup failed: " + (error && error.message ? error.message : String(error)));
      }
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
      this.editor.setText(this.document.text);
      this.applyEditorLanguage();
      this.updateUi();
      this.scheduleAutosave();
    }

    setLanguage(languageId) {
      var language = this.languageRegistry.get(languageId);
      var nextLanguageId = language ? language.id : languageId || "plain-text";
      this.document = this.document.cloneWith({ languageId: nextLanguageId });
      if (this.editor) {
        this.applyEditorLanguage();
      }
      if (this.storage) {
        this.storage.set("selectedLanguage", nextLanguageId);
      }
      this.updateUi();
    }

    async runLinters() {
      var diagnostics = await this.diagnosticsManager.run(this.document);
      this.editor.setDiagnostics(diagnostics);
      this.diagnosticsPanel.render(diagnostics);
      this.updateStatus("Diagnostics complete: " + diagnostics.length + " result" + (diagnostics.length === 1 ? "." : "s."));
    }

    async runTransformer(transformerId) {
      if (!transformerId) {
        return;
      }

      try {
        var result = await this.transformManager.run(transformerId, this.document);
        if (!result || typeof result.text !== "string") {
          throw new Error("Transformer returned no text.");
        }

        if (result.mode === "download") {
          downloadText(result.fileName || "transformed.txt", result.text, "text/plain");
        } else {
          this.setDocument(this.document.cloneWith({
            text: result.text,
            languageId: result.languageId || this.document.languageId,
            fileName: result.fileName || this.document.fileName
          }));
        }
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
        var session = this.renderManager.open(rendererId, this.document);
        this.renderSessions.push(session);
        this.pruneRenderSessions();
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
        var result = await this.exportManager.export(exporterId, {
          sourceDocument: this.document
        });
        var content = result.content;
        var blob = content instanceof Blob ? content : new Blob([content], { type: result.mimeType || "application/octet-stream" });
        downloadBlob(result.fileName, blob);
        this.updateStatus("Exported " + result.fileName + ".");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
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
      this.applyEditorLanguage();
      this.toolbar.update({
        languageId: languageId,
        languages: this.languageRegistry.list(),
        transformers: this.transformManager.list(languageId),
        renderers: this.renderManager.list(languageId),
        exporters: this.exportManager.list(languageId),
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

      this.pluginRegistry.getLanguageDefinitions().forEach((definition) => {
        if (definition && definition.id && !this.languageRegistry.get(definition.id)) {
          this.languageRegistry.register(definition);
        }
      });
    }

    async applyEditorLanguage() {
      if (!this.editor || !this.pluginRegistry) {
        return;
      }

      var languageId = this.document.languageId;
      var requestId = this.editorLanguageRequestId + 1;
      this.editorLanguageRequestId = requestId;
      var extensions = [];
      var providers = this.pluginRegistry.getHighlighters(languageId);
      for (var index = 0; index < providers.length; index += 1) {
        var provider = providers[index];
        if (typeof provider.getCodeMirrorExtensions !== "function") {
          continue;
        }

        try {
          var result = provider.getCodeMirrorExtensions({
            languageId: languageId,
            runtime: this.runtimeLoader
          });
          if (result && typeof result.then === "function") {
            result = await result;
          }
          if (requestId !== this.editorLanguageRequestId || this.document.languageId !== languageId) {
            return;
          }
          if (Array.isArray(result)) {
            extensions = extensions.concat(result);
          }
        } catch (error) {
          continue;
        }
      }
      if (requestId !== this.editorLanguageRequestId || this.document.languageId !== languageId) {
        return;
      }
      this.editor.setLanguage(languageId, extensions);
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
