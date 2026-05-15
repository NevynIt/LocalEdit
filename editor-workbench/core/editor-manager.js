(function (global) {
  "use strict";

  class EditorManager {
    constructor(registry, runtime) {
      this.registry = registry;
      this.runtime = runtime;
      this.container = null;
      this.activeContribution = null;
      this.activeEditor = null;
      this.changeHandlers = [];
      this.languageRequestId = 0;
      this.languageId = "text.plain";
      this.editable = true;
    }

    async mount(container, languageId) {
      this.container = container;
      this.languageId = languageId || "text.plain";
      var editors = this.listEditors(this.languageId);
      var preferred = editors.find(function (editor) {
        return editor.id === "codemirror";
      }) || editors[0];
      if (!preferred) {
        throw new Error("No editor contributions are available.");
      }
      try {
        await this.switchEditor(preferred.id, "", this.languageId);
      } catch (error) {
        if (preferred.id === "textarea") {
          throw error;
        }
        await this.switchEditor("textarea", "", this.languageId);
      }
    }

    listEditors(languageId) {
      return this.registry.getEditors(languageId);
    }

    getActiveEditorId() {
      return this.activeContribution ? this.activeContribution.id : "";
    }

    onDidChange(handler) {
      this.changeHandlers.push(handler);
    }

    emitChange(text) {
      this.changeHandlers.forEach(function (handler) {
        handler(text);
      });
    }

    async switchEditor(editorId, text, languageId) {
      if (!this.container) {
        return;
      }

      var nextContribution = this.registry.getContribution("editor", editorId);
      if (!nextContribution) {
        throw new Error("Editor contribution was not found.");
      }
      var currentText = typeof text === "string" ? text : this.getText();
      if (this.activeEditor && typeof this.activeEditor.destroy === "function") {
        this.activeEditor.destroy();
      }
      this.container.textContent = "";
      this.activeContribution = nextContribution;
      this.activeEditor = nextContribution.createEditor({
        runtime: this.runtime,
        registry: this.registry
      });
      this.activeEditor.mount(this.container);
      this.activeEditor.onTextChanged((nextText) => {
        this.emitChange(nextText);
      });
      this.activeEditor.setText(currentText, languageId || this.languageId, {});
      if (typeof this.activeEditor.setEditable === "function") {
        this.activeEditor.setEditable(this.editable);
      }
      await this.applyLanguage(languageId || this.languageId);
      this.focus();
    }

    async applyLanguage(languageId) {
      this.languageId = languageId || "text.plain";
      if (!this.activeEditor || !this.activeContribution) {
        return;
      }

      var requestId = this.languageRequestId + 1;
      this.languageRequestId = requestId;
      var extensions = [];
      var extensionContributions = this.registry.getEditorExtensions(this.activeContribution.id, this.languageId);
      for (var index = 0; index < extensionContributions.length; index += 1) {
        var contribution = extensionContributions[index];
        if (typeof contribution.createExtension !== "function") {
          continue;
        }

        try {
          var result = contribution.createExtension({
            languageId: this.languageId,
            editorId: this.activeContribution.id,
            runtime: this.runtime
          });
          if (result && typeof result.then === "function") {
            result = await result;
          }
          if (requestId !== this.languageRequestId) {
            return;
          }
          if (Array.isArray(result)) {
            extensions = extensions.concat(result);
          } else if (result) {
            extensions.push(result);
          }
        } catch (error) {
          continue;
        }
      }

      if (requestId === this.languageRequestId && typeof this.activeEditor.setLanguage === "function") {
        this.activeEditor.setLanguage(this.languageId, { extensions: extensions });
      }
    }

    getText() {
      return this.activeEditor && typeof this.activeEditor.getText === "function" ? this.activeEditor.getText() : "";
    }

    setText(text, languageId) {
      if (this.activeEditor) {
        this.activeEditor.setText(text || "", languageId || this.languageId, {});
      }
      if (languageId) {
        this.applyLanguage(languageId);
      }
    }

    setDiagnostics(diagnostics) {
      if (this.activeEditor && typeof this.activeEditor.setDiagnostics === "function") {
        this.activeEditor.setDiagnostics(diagnostics);
      }
    }

    setEditable(editable) {
      this.editable = editable !== false;
      if (this.activeEditor && typeof this.activeEditor.setEditable === "function") {
        this.activeEditor.setEditable(this.editable);
      }
    }

    selectRange(from, to) {
      if (this.activeEditor && typeof this.activeEditor.selectRange === "function") {
        this.activeEditor.selectRange(from, to);
      }
    }

    focus() {
      if (this.activeEditor && typeof this.activeEditor.focus === "function") {
        this.activeEditor.focus();
      }
    }
  }

  global.EditorManager = EditorManager;
})(window);
