(function (global) {
  "use strict";

  function makeId(prefix) {
    return String(prefix || "id") + "-" + Math.random().toString(36).slice(2, 10);
  }

  class WorkspaceManager {
    constructor() {
      this.records = new Map();
      this.order = [];
      this.activeDocumentId = null;
    }

    openDocument(documentModel, options) {
      var record = {
        id: makeId("doc"),
        document: new DocumentModel(documentModel),
        displayName: "",
        version: 0,
        diagnostics: [],
        editorId: options && options.editorId || "codemirror",
        viewState: null,
        renderBindings: [],
        source: options && options.source || "unknown"
      };

      this.records.set(record.id, record);
      this.order.push(record.id);
      this.activeDocumentId = record.id;
      this.recomputeDisplayNames();
      return record;
    }

    getActiveDocumentId() {
      return this.activeDocumentId;
    }

    getActiveRecord() {
      return this.getRecord(this.activeDocumentId);
    }

    getActiveDocument() {
      var record = this.getActiveRecord();
      return record ? record.document : null;
    }

    getRecord(documentId) {
      return documentId ? this.records.get(documentId) || null : null;
    }

    listRecords() {
      var self = this;
      return this.order.map(function (documentId) {
        return self.getRecord(documentId);
      }).filter(Boolean);
    }

    setActiveDocument(documentId) {
      if (!this.records.has(documentId)) {
        return null;
      }
      this.activeDocumentId = documentId;
      return this.getActiveRecord();
    }

    addRenderBinding(documentId, binding) {
      var record = this.getRecord(documentId);
      if (!record) {
        return null;
      }
      record.renderBindings.push(binding);
      return binding;
    }

    getRenderBindings(documentId) {
      var record = this.getRecord(documentId);
      return record ? record.renderBindings : [];
    }

    removeRenderBinding(documentId, bindingId) {
      var record = this.getRecord(documentId);
      if (!record) {
        return;
      }
      record.renderBindings = record.renderBindings.filter(function (binding) {
        return binding.id !== bindingId;
      });
    }

    updateText(documentId, text) {
      var record = this.getRecord(documentId);
      if (!record) {
        return null;
      }
      record.document = record.document.cloneWith({ text: text || "" });
      record.version += 1;
      this.recomputeDisplayNames();
      return record;
    }

    setLanguage(documentId, languageId) {
      var record = this.getRecord(documentId);
      if (!record) {
        return null;
      }
      record.document = record.document.cloneWith({ languageId: languageId });
      record.version += 1;
      return record;
    }

    renameDocument(documentId, fileName) {
      var record = this.getRecord(documentId);
      if (!record) {
        return null;
      }
      record.document = record.document.cloneWith({ fileName: fileName || "untitled.txt" });
      this.recomputeDisplayNames();
      return record;
    }

    replaceDocument(documentId, documentModel, options) {
      var record = this.getRecord(documentId);
      if (!record) {
        return null;
      }
      record.document = new DocumentModel(documentModel);
      record.version += 1;
      if (options && options.editorId) {
        record.editorId = options.editorId;
      }
      this.recomputeDisplayNames();
      return record;
    }

    replaceActiveDocument(documentModel, options) {
      if (!this.activeDocumentId) {
        return this.openDocument(documentModel, options);
      }
      return this.replaceDocument(this.activeDocumentId, documentModel, options);
    }

    closeDocument(documentId) {
      var record = this.getRecord(documentId);
      var index = this.order.indexOf(documentId);
      if (!record || index === -1) {
        return null;
      }

      this.records.delete(documentId);
      this.order.splice(index, 1);
      if (this.activeDocumentId === documentId) {
        this.activeDocumentId = this.order[index] || this.order[index - 1] || null;
      }
      this.recomputeDisplayNames();
      return record;
    }

    recomputeDisplayNames() {
      var counts = new Map();
      this.listRecords().forEach(function (record) {
        var fileName = record.document.fileName || "untitled.txt";
        var count = (counts.get(fileName) || 0) + 1;
        counts.set(fileName, count);
        record.displayName = count === 1 ? fileName : fileName + " (" + count + ")";
      });
    }
  }

  global.WorkspaceManager = WorkspaceManager;
})(window);
