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
      this.tabs = null;
      this.pluginPanel = null;
      this.diagnosticsPanel = null;
      this.workspace = new WorkspaceManager();
      this.document = new DocumentModel({
        text: "",
        languageId: "text.plain",
        fileName: "untitled.txt",
        mimeType: "text/plain"
      });
      this.persistedDocumentIds = new Set();
      this.closedDocuments = [];
      this.autosaveTimer = 0;
      this.autoRefreshTimersByDocumentId = new Map();
      this.autoRefreshEnabled = false;
      this.openIntermediateDocuments = false;
      this.renderRefreshDelayMs = 3000;
      this.pipelineActionsById = new Map();
      this.unloadPersistenceBound = false;
      this.renderMessageBound = false;
    }

    async start() {
      try {
        this.layout = new EditorLayout();
        this.layout.setStatus("Starting " + this.host.mode + " mode.");

        this.storage = new WorkbenchStorage();
        await this.storage.init();

        this.languageRegistry = new LanguageRegistry();
        this.pluginRegistry = new ContributionRegistry(this.languageRegistry);
        this.runtimeLoader = new RuntimeLoader(this.host);
        this.registerCoreContributions();
        this.registerPluginLanguages();

        this.pluginLoader = new PluginLoader(this.host, this.pluginRegistry);
        this.pluginManager = new PluginManager(this.host, this.storage, this.pluginLoader, this.pluginRegistry);
        this.diagnosticsManager = new DiagnosticsService(this.pluginRegistry, this.runtimeLoader);
        this.transformManager = new TransformManager(this.pluginRegistry, this.runtimeLoader);
        this.renderManager = new RenderManager(this.pluginRegistry, this.host);
        this.exportManager = new ExportManager(this.pluginRegistry, this.runtimeLoader);
        this.pipelineRegistry = new PipelineRegistry(this.pluginRegistry, this.languageRegistry);
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
        await this.editor.mount(this.layout.editorContainer, this.getDocument() ? this.getDocument().languageId : "text.plain");
        this.editor.onDidChange((text) => {
          if (!this.getActiveDocumentId()) {
            return;
          }
          this.updateDocumentText(this.getActiveDocumentId(), text);
          this.scheduleAutosave();
          this.scheduleAutoRefresh();
          this.updateStatus("Editing " + this.displayFileName() + ".");
        });
        this.bindUnloadPersistence();
        this.bindRenderWindowMessages();

        this.toolbar = new Toolbar(this.layout, this);
        this.tabs = new DocumentTabs(this.layout, this);
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
  this.reloadActiveDocumentIntoEditor();
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
              id: "text",
              name: "Text",
              parentLanguageId: null,
              fileExtensions: [],
              mediaType: "text/plain",
              description: "Root language for all text-based documents."
            },
            {
              id: "text.plain",
              name: "Plain Text",
              parentLanguageId: "text",
              aliases: ["plain-text"],
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
          pipelines: []
        }
      }, { path: "" });
    }

    async restoreState() {
      var workspaceState = await this.storage.get("workspaceState");
      if (workspaceState) {
        await this.restoreWorkspace(workspaceState);
        return;
      }

      var savedDocument = await this.storage.get("autosaveDocument");
      var selectedLanguage = await this.storage.get("selectedLanguage");

      if (savedDocument) {
        var restoredDocument = new DocumentModel(savedDocument);
        this.openDocument(restoredDocument.cloneWith({
          languageId: this.languageRegistry.getCanonicalId(restoredDocument.languageId) || restoredDocument.languageId
        }), {
          source: "legacy-restore"
        });
        await this.persistWorkspace();
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

    async restoreWorkspace(workspaceState) {
      if (!workspaceState || !Array.isArray(workspaceState.order)) {
        return;
      }

      this.workspace = new WorkspaceManager();
      this.persistedDocumentIds = new Set(workspaceState.order);

      for (var index = 0; index < workspaceState.order.length; index += 1) {
        var documentId = workspaceState.order[index];
        var metadata = Array.isArray(workspaceState.documents)
          ? workspaceState.documents.find(function (item) { return item.id === documentId; })
          : null;
        var storedDocument = await this.storage.get("document:" + documentId);
        if (!storedDocument) {
          continue;
        }

        var record = this.workspace.openDocument(new DocumentModel(storedDocument), {
          source: metadata && metadata.source || "workspace-restore",
          editorId: metadata && metadata.editorId || "codemirror"
        });
        this.workspace.records.delete(record.id);
        record.id = documentId;
        record.version = metadata && Number.isFinite(metadata.version) ? metadata.version : 0;
        record.viewState = metadata && metadata.viewState || null;
        record.displayName = metadata && metadata.displayName || record.displayName;
        this.workspace.records.set(documentId, record);
        this.workspace.order[this.workspace.order.length - 1] = documentId;
      }

      if (workspaceState.activeDocumentId) {
        this.workspace.setActiveDocument(workspaceState.activeDocumentId);
      }
      if (!this.workspace.getActiveRecord() && this.workspace.order.length) {
        this.workspace.setActiveDocument(this.workspace.order[0]);
      }
      this.document = this.getDocument() || new DocumentModel({
        text: "",
        languageId: "text.plain",
        fileName: "untitled.txt",
        mimeType: "text/plain"
      });
    }

    serializeWorkspaceState() {
      return {
        version: 1,
        activeDocumentId: this.getActiveDocumentId(),
        order: this.workspace.order.slice(),
        documents: this.workspace.listRecords().map(function (record) {
          return {
            id: record.id,
            displayName: record.displayName,
            fileName: record.document.fileName || "untitled.txt",
            languageId: record.document.languageId,
            mimeType: record.document.mimeType || "text/plain",
            version: record.version,
            editorId: record.editorId,
            source: record.source,
            viewState: record.viewState || null
          };
        })
      };
    }

    syncActiveEditorToWorkspace() {
      if (!this.editor) {
        return;
      }
      var activeDocumentId = this.getActiveDocumentId();
      if (!activeDocumentId) {
        return;
      }
      this.updateDocumentText(activeDocumentId, this.editor.getText());
    }

    bindUnloadPersistence() {
      if (this.unloadPersistenceBound) {
        return;
      }
      this.unloadPersistenceBound = true;

      var flush = () => {
        this.syncActiveEditorToWorkspace();
        this.persistDocument();
      };

      global.addEventListener("pagehide", flush);
      global.addEventListener("beforeunload", flush);
    }

    async persistWorkspace() {
      if (!this.storage) {
        return;
      }

      this.syncActiveEditorToWorkspace();

      var currentDocumentIds = new Set();
      var records = this.workspace.listRecords();
      for (var index = 0; index < records.length; index += 1) {
        var record = records[index];
        currentDocumentIds.add(record.id);
        await this.storage.set("document:" + record.id, {
          id: record.id,
          text: record.document.text || "",
          languageId: record.document.languageId,
          fileName: record.document.fileName,
          mimeType: record.document.mimeType,
          lastModified: record.document.lastModified
        });
      }

      var previousIds = Array.from(this.persistedDocumentIds);
      for (var cleanupIndex = 0; cleanupIndex < previousIds.length; cleanupIndex += 1) {
        if (!currentDocumentIds.has(previousIds[cleanupIndex])) {
          await this.storage.remove("document:" + previousIds[cleanupIndex]);
        }
      }

      await this.storage.set("workspaceState", this.serializeWorkspaceState());
      await this.storage.remove("autosaveDocument");
      await this.storage.remove("selectedLanguage");
      this.persistedDocumentIds = currentDocumentIds;
    }

    async openFile() {
      try {
        var nextDocument = await openTextFile();
        await this.openImportedDocument(nextDocument, { source: "file-picker" });
        this.updateStatus("Opened " + this.displayFileName() + ".");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async openDroppedFiles(fileList) {
      try {
        var files = Array.from(fileList || []);
        if (files.length === 0) {
          throw new Error("No file selected.");
        }
        for (var index = 0; index < files.length; index += 1) {
          var nextDocument = await documentFromFile(files[index]);
          await this.openImportedDocument(nextDocument, { source: "file-drop" });
        }
        this.updateStatus("Opened " + files.length + " file" + (files.length === 1 ? "." : "s."));
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    isDisposableBlankRecord(record) {
      return Boolean(
        record
        && record.source === "startup"
        && (!record.document.fileName || record.document.fileName === "untitled.txt")
        && !(record.document.text || "").trim()
        && record.document.languageId === "text.plain"
        && this.workspace.listRecords().length === 1
      );
    }

    discardDisposableBlankRecord() {
      var record = this.getActiveRecord();
      if (!this.isDisposableBlankRecord(record)) {
        return false;
      }
      this.workspace.closeDocument(record.id);
      this.document = this.getDocument();
      return true;
    }

    async openImportedDocument(documentModel, options) {
      this.discardDisposableBlankRecord();
      var inferredLanguage = this.languageRegistry.inferFromFileName(documentModel.fileName) || documentModel.languageId || "text.plain";
      var record = this.openDocument(documentModel.cloneWith({ languageId: inferredLanguage }), options || { source: "import" });
      this.switchDocument(record.id);
      await this.persistDocument();
      return record;
    }

    newDocument() {
      var record = this.openDocument(new DocumentModel({
        text: "",
        languageId: "text.plain",
        fileName: "untitled.txt",
        mimeType: "text/plain"
      }), {
        source: "new-document"
      });
      this.persistWorkspace();
      this.updateStatus("New document opened.");
      return record;
    }

    async saveSourceAsDownload() {
      if (!this.getActiveDocumentId()) {
        this.updateStatus("Open or create a document first.");
        return;
      }
      var documentModel = this.getDocument();
      var fileName = documentModel.fileName || "untitled.txt";
      downloadText(fileName, this.editor.getText(), documentModel.mimeType || "text/plain");
      this.updateStatus("Downloaded " + fileName + ".");
    }

    getActiveDocumentId() {
      return this.workspace.getActiveDocumentId();
    }

    getActiveRecord() {
      return this.workspace.getActiveRecord();
    }

    getDocument() {
      return this.workspace.getActiveDocument() || this.document;
    }

    reloadActiveDocumentIntoEditor() {
      if (!this.editor) {
        return;
      }
      var record = this.getActiveRecord();
      if (!record) {
        this.document = new DocumentModel({
          text: "",
          languageId: "text.plain",
          fileName: "untitled.txt",
          mimeType: "text/plain"
        });
        this.editor.setText("", "text.plain");
        this.editor.applyLanguage("text.plain");
        this.editor.setDiagnostics([]);
        if (this.layout && this.layout.isDiagnosticsPanelOpen() && this.diagnosticsPanel) {
          this.diagnosticsPanel.render([], this.document);
        }
        return;
      }
      this.document = record.document;
      this.editor.setText(record.document.text, record.document.languageId);
      this.editor.applyLanguage(record.document.languageId);
      this.editor.setDiagnostics(record.diagnostics || []);
      if (this.layout && this.layout.isDiagnosticsPanelOpen() && this.diagnosticsPanel) {
        this.diagnosticsPanel.render(record.diagnostics || [], record.document);
      }
    }

    makeRenderMetadata(record, binding) {
      return {
        documentId: record.id,
        documentDisplayName: record.displayName,
        documentFileName: record.document.fileName || "untitled.txt",
        documentLanguageId: record.document.languageId,
        documentVersion: record.version,
        rendererId: binding && binding.rendererId || null,
        pipelineId: binding && binding.pipelineId || null,
        bindingId: binding && binding.id || null,
        generatedAt: new Date().toISOString(),
        lastUpdatedAt: binding && binding.lastUpdatedAt || null
      };
    }

    bindRenderWindowMessages() {
      if (this.renderMessageBound) {
        return;
      }
      this.renderMessageBound = true;

      global.addEventListener("message", (event) => {
        var message = event.data;
        if (!message || message.type !== "render-refresh-request" || !message.bindingId) {
          return;
        }
        this.refreshRenderBinding(message.bindingId);
      });
    }

    findRenderBinding(bindingId) {
      var records = this.workspace.listRecords();
      for (var index = 0; index < records.length; index += 1) {
        var bindings = this.workspace.getRenderBindings(records[index].id);
        for (var bindingIndex = 0; bindingIndex < bindings.length; bindingIndex += 1) {
          if (bindings[bindingIndex].id === bindingId) {
            return { record: records[index], binding: bindings[bindingIndex] };
          }
        }
      }
      return null;
    }

    async createRenderDocumentForBinding(binding, record) {
      var renderDocument = record.document;
      if (binding.pipelineId) {
        var pipelineRef = binding.pipelineDefinition || binding.pipelineId;
        var prepared = await this.pipelineExecutor.prepareTerminalInput(pipelineRef, record.document);
        renderDocument = new DocumentModel({
          text: prepared.input.text,
          languageId: prepared.input.languageId,
          fileName: record.document.fileName,
          mimeType: record.document.mimeType,
          lastModified: record.document.lastModified
        });
      }
      return renderDocument;
    }

    async refreshRenderBinding(bindingId) {
      var found = this.findRenderBinding(bindingId);
      if (!found || !found.binding.session || !found.binding.session.isOpen()) {
        this.updateStatus("Render window is no longer available.");
        return;
      }

      try {
        var renderDocument = await this.createRenderDocumentForBinding(found.binding, found.record);
        found.binding.lastUpdatedAt = new Date().toISOString();
        found.binding.session.updateMetadata(this.makeRenderMetadata(found.record, found.binding));
        found.binding.session.refresh(renderDocument);
        found.binding.lastRenderedVersion = found.record.version;
        this.updateStatus("Render window refreshed.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    getLanguageMediaType(languageId) {
      var language = this.languageRegistry && this.languageRegistry.get(languageId);
      return language && Array.isArray(language.mediaTypes) && language.mediaTypes[0]
        ? language.mediaTypes[0]
        : language && language.mediaType || "text/plain";
    }

    getLanguageExtension(languageId) {
      var language = this.languageRegistry && this.languageRegistry.get(languageId);
      var extension = language && Array.isArray(language.fileExtensions) && language.fileExtensions[0]
        ? language.fileExtensions[0]
        : ".txt";
      return extension.charAt(0) === "." ? extension : "." + extension;
    }

    buildDerivedDocumentName(sourceDocument, languageId, fallbackBase) {
      var baseName = sourceDocument && sourceDocument.fileName ? String(sourceDocument.fileName) : String(fallbackBase || "pipeline-output");
      baseName = baseName.replace(/\.[^.]+$/, "");
      return baseName + this.getLanguageExtension(languageId);
    }

    openPipelineDocument(documentModel, options) {
      var record = this.openDocument(documentModel, options);
      this.persistWorkspace();
      return record;
    }

    listClosedDocuments() {
      return this.closedDocuments.slice().sort(function (a, b) {
        return (b.closedAt || 0) - (a.closedAt || 0);
      }).map(function (item) {
        var closedDate = new Date(item.closedAt || Date.now());
        return Object.assign({}, item, {
          name: (item.displayName || item.document.fileName || "untitled.txt") + " - closed " + closedDate.toLocaleString()
        });
      });
    }

    stashClosedDocument(record) {
      this.closedDocuments.unshift({
        id: record.id,
        displayName: record.displayName,
        document: new DocumentModel(record.document),
        diagnostics: Array.isArray(record.diagnostics) ? record.diagnostics.slice() : [],
        editorId: record.editorId,
        source: record.source,
        version: record.version,
        closedAt: Date.now()
      });
    }

    reopenClosedDocument(documentId) {
      var index = this.closedDocuments.findIndex(function (item) {
        return item.id === documentId;
      });
      if (index === -1) {
        return null;
      }

      var cached = this.closedDocuments.splice(index, 1)[0];
      var record = this.openDocument(new DocumentModel(cached.document), {
        source: cached.source || "reopen-closed",
        editorId: cached.editorId || "codemirror"
      });
      record.version = cached.version || 0;
      record.diagnostics = cached.diagnostics || [];
      this.persistWorkspace();
      this.updateStatus("Reopened " + (record.displayName || record.document.fileName || "document") + ".");
      return record;
    }

    renameDocument(documentId) {
      var record = this.workspace.getRecord(documentId);
      if (!record) {
        return;
      }
      if (documentId !== this.getActiveDocumentId()) {
        this.switchDocument(documentId);
      }
      var currentName = record.document.fileName || "untitled.txt";
      var nextName = global.prompt ? global.prompt("Rename document", currentName) : currentName;
      if (!nextName) {
        return;
      }
      this.workspace.renameDocument(documentId, nextName.trim() || currentName);
      this.document = this.getDocument();
      this.updateUi();
      this.persistWorkspace();
      this.updateStatus("Renamed to " + (this.getActiveRecord() && this.getActiveRecord().displayName || nextName) + ".");
    }

    setOpenIntermediateDocuments(enabled) {
      this.openIntermediateDocuments = Boolean(enabled);
      this.updateUi();
    }

    declaredContributionLanguages(contribution) {
      if (!contribution) {
        return [];
      }
      if (contribution.kind === "pipeline") {
        return contribution.inputLanguage ? [contribution.inputLanguage] : [];
      }
      if (contribution.kind === "transformer") {
        return contribution.inputLanguage ? [contribution.inputLanguage] : Array.isArray(contribution.inputLanguages) ? contribution.inputLanguages.slice() : [];
      }
      if (contribution.kind === "editor-extension") {
        return Array.isArray(contribution.languages) ? contribution.languages.slice() : [];
      }
      return Array.isArray(contribution.accepts) ? contribution.accepts.slice() : Array.isArray(contribution.languages) ? contribution.languages.slice() : [];
    }

    sanitizeContributionNodeId(value) {
      return String(value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
    }

    summarizeParameters(parameters) {
      var schema = parameters && typeof parameters === "object" ? parameters : {};
      var keys = Object.keys(schema).sort();
      if (!keys.length) {
        return "none";
      }
      return keys.map(function (key) {
        var definition = schema[key] || {};
        var type = definition.type || "value";
        if (type === "enum" && Array.isArray(definition.values) && definition.values.length) {
          type += "=" + definition.values.join("|");
        }
        return key + " [" + type + "] default=" + JSON.stringify(definition.default);
      }).join(", ");
    }

    summarizePipelineSteps(pipeline) {
      var steps = Array.isArray(pipeline && pipeline.steps) ? pipeline.steps : [];
      if (!steps.length) {
        return "none";
      }
      return steps.map(function (step, index) {
        return (index + 1) + ". " + (step && step.use || "unknown");
      }).join(" -> ");
    }

    buildContributionCatalogDocument() {
      var self = this;
      var groupedByLanguage = new Map();
      var globalContributions = [];

      ["editor", "editor-extension", "linter", "transformer", "renderer", "exporter", "pipeline"].forEach(function (kind) {
        self.pluginRegistry.getContributions(kind).forEach(function (contribution) {
          var inputs = self.declaredContributionLanguages(contribution).filter(Boolean);
          if (!inputs.length || inputs.indexOf("*") !== -1) {
            globalContributions.push(contribution);
            return;
          }
          inputs.forEach(function (languageId) {
            var canonicalId = self.languageRegistry.getCanonicalId(languageId) || languageId;
            if (!groupedByLanguage.has(canonicalId)) {
              groupedByLanguage.set(canonicalId, []);
            }
            groupedByLanguage.get(canonicalId).push(contribution);
          });
        });
      });

      function pushContribution(lines, contribution, baseIndent, languageId) {
        var nodeId = "contrib-" + self.sanitizeContributionNodeId((contribution.pluginId || "plugin") + "-" + contribution.id + "-" + (languageId || "global"));
        var linkSuffix = contribution.kind === "transformer" && contribution.outputLanguage
          ? " @produces:lang-" + self.sanitizeContributionNodeId(contribution.outputLanguage)
          : "";
        lines.push(baseIndent + "&" + nodeId + " [" + contribution.kind + "] " + (contribution.name || contribution.id) + linkSuffix);
        lines.push(baseIndent + " | id: " + contribution.id);
        lines.push(baseIndent + " | plugin: " + (contribution.pluginName || contribution.pluginId || "local"));
        if (languageId) {
          lines.push(baseIndent + " | consumes: " + languageId);
        }
        if (contribution.kind === "transformer") {
          lines.push(baseIndent + " | produces: " + contribution.outputLanguage);
        }
        if (contribution.kind === "pipeline") {
          lines.push(baseIndent + " | steps: " + self.summarizePipelineSteps(contribution));
        }
        lines.push(baseIndent + " | parameters: " + self.summarizeParameters(contribution.parameters));
      }

      function renderLanguage(language, childMap, lines, indent) {
        var languageIndent = new Array(indent + 1).join("  ");
        var languageNodeId = "lang-" + self.sanitizeContributionNodeId(language.id);
        lines.push(languageIndent + "&" + languageNodeId + " [language] " + language.name);
        lines.push(languageIndent + " | id: " + language.id);
        if (language.aliases && language.aliases.length) {
          lines.push(languageIndent + " | aliases: " + language.aliases.join(", "));
        }
        if (language.fileExtensions && language.fileExtensions.length) {
          lines.push(languageIndent + " | extensions: " + language.fileExtensions.join(", "));
        }
        if (language.mediaTypes && language.mediaTypes.length) {
          lines.push(languageIndent + " | media types: " + language.mediaTypes.join(", "));
        }
        (childMap.get(language.id) || []).forEach(function (child) {
          renderLanguage(child, childMap, lines, indent + 1);
        });
        (groupedByLanguage.get(language.id) || []).slice().sort(function (a, b) {
          if (a.kind !== b.kind) {
            return a.kind.localeCompare(b.kind);
          }
          return (a.name || a.id).localeCompare(b.name || b.id);
        }).forEach(function (contribution) {
          pushContribution(lines, contribution, languageIndent + "  ", language.id);
        });
      }

      var childMap = new Map();
      this.languageRegistry.list().forEach(function (language) {
        var parentId = language.parentLanguageId || "";
        if (!childMap.has(parentId)) {
          childMap.set(parentId, []);
        }
        childMap.get(parentId).push(language);
      });

      var lines = [
        "&catalog Contribution catalog",
        " | generated at: " + new Date().toISOString(),
        " | note: languages define the tree; transformer cross links show produced formats"
      ];
      (childMap.get("") || []).forEach(function (language) {
        renderLanguage(language, childMap, lines, 1);
      });
      lines.push("  &global [group] Global contributions");
      lines.push("   | consumes: any language or runtime-only context");
      globalContributions.sort(function (a, b) {
        if (a.kind !== b.kind) {
          return a.kind.localeCompare(b.kind);
        }
        return (a.name || a.id).localeCompare(b.name || b.id);
      }).forEach(function (contribution) {
        pushContribution(lines, contribution, "    ", "");
      });
      return lines.join("\n");
    }

    openContributionCatalogDocument() {
      var record = this.openDocument(new DocumentModel({
        text: this.buildContributionCatalogDocument(),
        languageId: "text.indented-tree",
        fileName: "contribution-catalog.itt",
        mimeType: "text/x-indented-tree"
      }), {
        source: "contribution-catalog"
      });
      this.persistWorkspace();
      this.updateStatus("Opened contribution catalog.");
      return record;
    }

    buildPipelineActions(languageId) {
      var self = this;
      var actions = [];
      this.pipelineActionsById = new Map();

      function isPrimaryAction(contribution) {
        return !contribution || !contribution.visibility || contribution.visibility === "default";
      }

      function pushAction(action) {
        self.pipelineActionsById.set(action.id, action);
        actions.push(action);
      }

      function splitMenuPath(value) {
        if (Array.isArray(value)) {
          return value.map(function (part) { return String(part || "").trim(); }).filter(Boolean);
        }
        if (typeof value === "string") {
          return value.split(/[\/>]/).map(function (part) { return part.trim(); }).filter(Boolean);
        }
        return [];
      }

      function inferPipelineCategory(name, fallback) {
        var text = String(name || "").toLowerCase();
        if (/\b(export|download|png|svg|csv)\b/.test(text)) {
          return "Export";
        }
        if (/\b(report|markdown)\b/.test(text)) {
          return "Reports";
        }
        if (/\b(graph|cytoscape|mind|map|dependency|traceability)\b/.test(text)) {
          return "Graphs";
        }
        if (/\b(table|endpoint|risk|action|role)\b/.test(text)) {
          return "Tables";
        }
        if (/\b(profile|analy|lint|schema|outline)\b/.test(text)) {
          return "Analyze";
        }
        if (/\b(convert|normalize|format|compact|openapi|json|yaml)\b/.test(text)) {
          return "Convert";
        }
        if (/\b(view|preview|render)\b/.test(text)) {
          return "Preview";
        }
        return fallback || "Actions";
      }

      function actionMenuPath(contribution, prefix, fallbackCategory) {
        var path = splitMenuPath(contribution && contribution.menuPath);
        if (path.length) {
          return path;
        }
        var category = contribution && contribution.category || fallbackCategory || inferPipelineCategory(contribution && contribution.name, prefix);
        return [category, contribution && (contribution.name || contribution.id) || prefix];
      }

      this.transformManager.list(languageId).forEach(function (transformer) {
        if (!isPrimaryAction(transformer)) {
          return;
        }
        pushAction({
          id: "synthetic:transformer:" + transformer.id,
          name: transformer.name || transformer.id,
          category: transformer.category || "Convert",
          menuPath: actionMenuPath(transformer, "Transform", "Convert"),
          pipeline: {
            id: "direct-transform-" + transformer.id,
            name: "Run " + transformer.id,
            inputLanguage: languageId,
            steps: [
              { use: transformer.id, params: {} }
            ]
          }
        });
      });

      this.renderManager.list(languageId).forEach(function (renderer) {
        if (!isPrimaryAction(renderer)) {
          return;
        }
        pushAction({
          id: "synthetic:renderer:" + renderer.id,
          name: renderer.name || renderer.id,
          category: renderer.category || "Preview",
          menuPath: actionMenuPath(renderer, "Preview", "Preview"),
          pipeline: {
            id: "direct-render-" + renderer.id,
            name: "Render " + renderer.id,
            inputLanguage: languageId,
            steps: [
              { use: renderer.id, params: {} }
            ]
          }
        });
      });

      this.exportManager.list(languageId).forEach(function (exporter) {
        if (!isPrimaryAction(exporter)) {
          return;
        }
        pushAction({
          id: "synthetic:exporter:" + exporter.id,
          name: exporter.name || exporter.id,
          category: exporter.category || "Export",
          menuPath: actionMenuPath(exporter, "Export", "Export"),
          pipeline: {
            id: "direct-export-" + exporter.id,
            name: "Export " + exporter.id,
            inputLanguage: languageId,
            steps: [
              { use: exporter.id, params: {} }
            ]
          }
        });
      });

      this.pipelineRegistry.list(languageId).forEach(function (pipeline) {
        if (!isPrimaryAction(pipeline)) {
          return;
        }
        pushAction({
          id: pipeline.id,
          name: pipeline.name || pipeline.id,
          category: pipeline.category || inferPipelineCategory(pipeline.name || pipeline.id, "Pipelines"),
          menuPath: splitMenuPath(pipeline.menuPath).length
            ? splitMenuPath(pipeline.menuPath)
            : [pipeline.category || inferPipelineCategory(pipeline.name || pipeline.id, "Pipelines"), pipeline.name || pipeline.id],
          pipelineId: pipeline.id
        });
      });

      return actions.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    }

    openIntermediateResultDocuments(intermediateResults, finalDocument, restoreDocumentId) {
      var results = Array.isArray(intermediateResults) ? intermediateResults : [];
      for (var index = 0; index < results.length; index += 1) {
        var item = results[index];
        if (!item || typeof item.text !== "string") {
          continue;
        }
        if (finalDocument && item.text === finalDocument.text && item.languageId === finalDocument.languageId) {
          continue;
        }
        this.openPipelineDocument(new DocumentModel({
          text: item.text,
          languageId: item.languageId,
          fileName: this.buildDerivedDocumentName(this.getDocument(), item.languageId, item.step || ("step-" + (index + 1))),
          mimeType: this.getLanguageMediaType(item.languageId)
        }), {
          source: "pipeline-intermediate"
        });
      }
      if (restoreDocumentId) {
        this.switchDocument(restoreDocumentId);
      }
    }

    openDocument(documentModel, options) {
      var record = this.workspace.openDocument(documentModel, options);
      this.document = this.getDocument();
      this.reloadActiveDocumentIntoEditor();
      this.updateUi();
      return record;
    }

    switchDocument(documentId) {
      if (!documentId || documentId === this.getActiveDocumentId()) {
        return;
      }

      var currentDocumentId = this.getActiveDocumentId();
      if (currentDocumentId) {
        this.updateDocumentText(currentDocumentId, this.editor.getText());
      }

      var record = this.workspace.setActiveDocument(documentId);
      if (!record) {
        return;
      }

      this.reloadActiveDocumentIntoEditor();
      this.updateUi();
      this.updateStatus("Switched to " + this.displayFileName() + ".");
      this.persistWorkspace();
    }

    closeDocument(documentId) {
      var record = this.workspace.getRecord(documentId);
      if (!record) {
        return;
      }

      if (documentId === this.getActiveDocumentId() && this.editor) {
        this.updateDocumentText(documentId, this.editor.getText());
        record = this.workspace.getRecord(documentId);
      }

      var wasActive = documentId === this.getActiveDocumentId();
      this.pruneRenderBindings(documentId).forEach(function (binding) {
        binding.session.close();
      });
      global.clearTimeout(this.autoRefreshTimersByDocumentId.get(documentId));
      this.autoRefreshTimersByDocumentId.delete(documentId);
      this.stashClosedDocument(record);
      this.workspace.closeDocument(documentId);

      this.document = this.getDocument() || new DocumentModel({
        text: "",
        languageId: "text.plain",
        fileName: "untitled.txt",
        mimeType: "text/plain"
      });
      if (wasActive) {
        this.reloadActiveDocumentIntoEditor();
      }
      this.updateUi();
      this.updateStatus("Closed document. Use Reopen to restore it this session.");
      this.persistWorkspace();
    }

    updateDocumentText(documentId, text) {
      if (!documentId) {
        this.document = this.document.cloneWith({ text: text || "" });
        return null;
      }
      var record = this.workspace.updateText(documentId, text);
      this.document = this.getDocument();
      return record;
    }

    replaceDocument(documentId, documentModel) {
      var record = this.workspace.replaceDocument(documentId, documentModel);
      this.document = this.getDocument();
      return record;
    }

    setDocumentLanguage(documentId, languageId) {
      if (!documentId) {
        this.document = this.document.cloneWith({ languageId: languageId || "text.plain" });
        return null;
      }
      var record = this.workspace.setLanguage(documentId, languageId);
      this.document = this.getDocument();
      return record;
    }

    setDocument(documentModel) {
      var nextDocument = new DocumentModel(documentModel);
      var canonicalLanguageId = this.languageRegistry && this.languageRegistry.getCanonicalId(nextDocument.languageId);
      if (!this.getActiveDocumentId()) {
        this.document = nextDocument.cloneWith({
          languageId: canonicalLanguageId || nextDocument.languageId
        });
        this.editor.setText(this.document.text, this.document.languageId);
        this.updateUi();
        this.scheduleAutosave();
        return;
      }
      this.workspace.replaceActiveDocument(nextDocument.cloneWith({
        languageId: canonicalLanguageId || nextDocument.languageId
      }));
      this.document = this.getDocument();
      this.editor.setText(this.document.text, this.document.languageId);
      this.updateUi();
      this.scheduleAutosave();
    }

    setLanguage(languageId) {
      var language = this.languageRegistry.get(languageId);
      var nextLanguageId = language ? language.id : languageId || "text.plain";
      this.setDocumentLanguage(this.getActiveDocumentId(), nextLanguageId);
      this.document = this.getDocument();
      if (this.editor) {
        this.editor.applyLanguage(nextLanguageId);
      }
      if (this.storage) {
        this.storage.set("selectedLanguage", nextLanguageId);
      }
      this.updateUi();
      this.persistWorkspace();
    }

    async switchEditor(editorId) {
      try {
        await this.editor.switchEditor(editorId, this.editor.getText(), this.getDocument() ? this.getDocument().languageId : "text.plain");
        this.updateUi();
        this.updateStatus("Editor changed.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async runLinters() {
      if (!this.getActiveDocumentId()) {
        this.updateStatus("Open or create a document first.");
        return;
      }
      var documentModel = this.getDocument();
      var diagnostics = await this.diagnosticsManager.runLinters(documentModel, this.getActiveDocumentId());
      if (this.getActiveRecord()) {
        this.getActiveRecord().diagnostics = diagnostics.slice();
      }
      this.editor.setDiagnostics(diagnostics);
      this.diagnosticsPanel.render(diagnostics, documentModel);
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
      var documentId = diagnostic.target && diagnostic.target.documentId;
      if (documentId && documentId !== this.getActiveDocumentId()) {
        this.switchDocument(documentId);
      }
      var start = diagnostic.range && diagnostic.range.start;
      var end = diagnostic.range && diagnostic.range.end;
      var from = start && Number.isFinite(start.offset) ? start.offset : 0;
      var to = end && Number.isFinite(end.offset) ? end.offset : from;
      this.editor.selectRange(from, to);
    }

    refreshRenderers() {
      var documentId = this.getActiveDocumentId();
      if (!documentId) {
        this.updateStatus("Open or create a document first.");
        this.updateUi();
        return;
      }
      var bindings = this.pruneRenderBindings(documentId);
      if (bindings.length === 0) {
        this.updateStatus("No open render windows to refresh.");
        this.updateUi();
        return;
      }

      var record = this.getActiveRecord();
      Promise.all(bindings.map(async (binding) => {
        var renderDocument = await this.createRenderDocumentForBinding(binding, record);
        binding.lastUpdatedAt = new Date().toISOString();
        binding.session.updateMetadata(this.makeRenderMetadata(record, binding));
        binding.session.refresh(renderDocument);
        binding.lastRenderedVersion = record.version;
      })).then(() => {
        this.updateStatus("Refreshed " + bindings.length + " render window" + (bindings.length === 1 ? "." : "s."));
        this.updateUi();
      }).catch((error) => {
        this.updateStatus(error && error.message ? error.message : String(error));
        this.updateUi();
      });
    }

    setAutoRefresh(enabled) {
      this.autoRefreshEnabled = Boolean(enabled);
      if (this.autoRefreshEnabled) {
        this.scheduleAutoRefresh();
        this.updateStatus("Auto-refresh enabled after " + this.renderRefreshDelayMs / 1000 + "s of stable source.");
      } else {
        this.autoRefreshTimersByDocumentId.forEach(function (timerId) {
          global.clearTimeout(timerId);
        });
        this.autoRefreshTimersByDocumentId.clear();
        this.updateStatus("Auto-refresh disabled.");
      }
      this.updateUi();
    }

    async runExporter(exporterId) {
      if (!exporterId) {
        return;
      }
      if (!this.getActiveDocumentId()) {
        this.updateStatus("Open or create a document first.");
        return;
      }

      try {
        var result = await this.executePipeline({
          id: "direct-export-" + exporterId,
          name: "Export " + exporterId,
          inputLanguage: this.getDocument().languageId,
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

    async runPipelineAction(actionId) {
      if (!actionId) {
        return;
      }

      var action = this.pipelineActionsById.get(actionId);
      await this.runPipeline(action && action.pipeline ? action.pipeline : action && action.pipelineId || actionId);
    }

    async runPipeline(pipelineId) {
      if (!pipelineId) {
        return;
      }
      if (!this.getActiveDocumentId()) {
        this.updateStatus("Open or create a document first.");
        return;
      }

      var restoreDocumentId = this.getActiveDocumentId();
      try {
        var result = await this.executePipeline(pipelineId);
        if (result && result.action === "open-new-document" && result.document && !result.documentId) {
          var openedRecord = this.openPipelineDocument(new DocumentModel(result.document).cloneWith({
            fileName: result.document.fileName || this.buildDerivedDocumentName(this.getDocument(), result.document.languageId, result.step && result.step.use)
          }), {
            source: "pipeline-output"
          });
          result.documentId = openedRecord.id;
          result.document = openedRecord.document;
        }
        if (this.openIntermediateDocuments && result && Array.isArray(result.intermediateResults) && result.intermediateResults.length) {
          this.openIntermediateResultDocuments(result.intermediateResults, result.document || null, result.action === "open-new-document" ? result.documentId : restoreDocumentId);
        }
        if (result && result.action === "render" && result.session) {
          var activeRecord = this.getActiveRecord();
          if (activeRecord) {
            var binding = {
              id: "binding-" + Math.random().toString(36).slice(2, 10),
              documentId: activeRecord.id,
              session: result.session,
              rendererId: result.session.rendererId,
              pipelineId: typeof pipelineId === "string" ? pipelineId : pipelineId.id,
              pipelineDefinition: typeof pipelineId === "string" ? null : pipelineId,
              lastRenderedVersion: activeRecord.version,
              lastUpdatedAt: new Date().toISOString()
            };
            result.session.updateMetadata(this.makeRenderMetadata(activeRecord, binding));
            this.workspace.addRenderBinding(activeRecord.id, binding);
            this.refreshRenderBinding(binding.id);
          }
        }
        if (result && result.action === "export") {
          this.downloadExportResult(result.result);
        }
        this.updateUi();
        this.updateStatus("Pipeline complete.");
      } catch (error) {
        this.updateStatus(error && error.message ? error.message : String(error));
      }
    }

    async executePipeline(pipelineOrId) {
      return this.pipelineExecutor.execute(pipelineOrId, this.getDocument());
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

        var record = this.openDocument(new DocumentModel({
          text: example.text,
          languageId: example.languageId || plugin.languages[0] || "text.plain",
          fileName: example.fileName || "example.txt",
          mimeType: example.mimeType || "text/plain"
        }), {
          source: "plugin-example"
        });
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
      if (!this.toolbar || !this.tabs || !this.pluginPanel || !this.pluginManager) {
        return;
      }

      var documentModel = this.getDocument();
      var hasDocument = Boolean(this.getActiveDocumentId());
      var languageId = documentModel ? documentModel.languageId : "text.plain";
      if (this.editor) {
        this.editor.setEditable(hasDocument);
        this.editor.applyLanguage(languageId);
      }
      if (this.layout && this.layout.editorContainer) {
        this.layout.editorContainer.classList.toggle("is-empty-workspace", !hasDocument);
        this.layout.editorContainer.setAttribute("data-empty-message", "No document open. Use New, Open, or Reopen.");
      }
      this.toolbar.update({
        hasDocument: hasDocument,
        languageId: languageId,
        languages: this.languageRegistry.list(),
        editorId: this.editor ? this.editor.getActiveEditorId() : "",
        editors: this.editor ? this.editor.listEditors(languageId) : [],
        closedDocuments: this.listClosedDocuments(),
        pipelineActions: hasDocument ? this.buildPipelineActions(languageId) : [],
        canDiscoverPipelines: Boolean(this.pipelineRegistry),
        autoRefreshEnabled: this.autoRefreshEnabled,
        openIntermediateDocuments: this.openIntermediateDocuments,
        hasRenderSessions: this.hasOpenRenderSessions()
      });

      this.tabs.render({
        activeDocumentId: this.getActiveDocumentId(),
        records: this.workspace.listRecords()
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
      var documentId = this.getActiveDocumentId();
      global.clearTimeout(this.autoRefreshTimersByDocumentId.get(documentId));
      if (!this.autoRefreshEnabled) {
        return;
      }

      var timerId = global.setTimeout(() => {
        this.refreshRenderers();
      }, this.renderRefreshDelayMs);
      this.autoRefreshTimersByDocumentId.set(documentId, timerId);
    }

    pruneRenderBindings(documentId) {
      var bindings = this.workspace.getRenderBindings(documentId).slice();
      var openBindings = [];
      for (var index = 0; index < bindings.length; index += 1) {
        if (bindings[index].session && bindings[index].session.isOpen()) {
          openBindings.push(bindings[index]);
        } else {
          this.workspace.removeRenderBinding(documentId, bindings[index].id);
        }
      }
      return openBindings;
    }

    pruneRenderSessions() {
      this.renderSessions = this.renderSessions.filter(function (session) {
        return session.isOpen();
      });
    }

    hasOpenRenderSessions() {
      if (!this.getActiveDocumentId()) {
        return false;
      }
      return this.pruneRenderBindings(this.getActiveDocumentId()).length > 0;
    }

    async persistDocument() {
      await this.persistWorkspace();
    }

    displayFileName() {
      var record = this.getActiveRecord();
      if (record && record.displayName) {
        return record.displayName;
      }
      return this.getActiveDocumentId() ? this.getDocument().fileName || "untitled.txt" : "no document";
    }

    updateStatus(message) {
      if (this.layout) {
        this.layout.setStatus(message);
      }
    }
  }

  global.App = App;
})(window);
