(function (global) {
  "use strict";

  class DocumentModel {
    constructor(data) {
      var source = data || {};
      this.text = typeof source.text === "string" ? source.text : "";
      this.languageId = source.languageId || "text.plain";
      this.fileName = source.fileName || undefined;
      this.mimeType = source.mimeType || undefined;
      this.lastModified = source.lastModified || undefined;
    }

    cloneWith(changes) {
      return new DocumentModel(Object.assign({}, this, changes || {}));
    }
  }

  function createDocumentModel(data) {
    return new DocumentModel(data);
  }

  global.DocumentModel = DocumentModel;
  global.createDocumentModel = createDocumentModel;
})(window);

