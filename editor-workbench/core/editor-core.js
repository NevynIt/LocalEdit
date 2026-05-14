(function (global) {
  "use strict";

  class EditorCore {
    constructor() {
      this.container = null;
      this.textarea = null;
      this.languageId = "plain-text";
      this.diagnostics = [];
      this.changeHandlers = [];
    }

    mount(container) {
      this.container = container;
      this.textarea = document.createElement("textarea");
      this.textarea.className = "editor-textarea";
      this.textarea.spellcheck = false;
      this.textarea.setAttribute("aria-label", "Source text");
      this.textarea.addEventListener("input", () => {
        this.emitChange();
      });
      container.appendChild(this.textarea);
    }

    onDidChange(handler) {
      this.changeHandlers.push(handler);
    }

    emitChange() {
      var text = this.getText();
      this.changeHandlers.forEach(function (handler) {
        handler(text);
      });
    }

    getText() {
      return this.textarea ? this.textarea.value : "";
    }

    setText(text) {
      if (this.textarea) {
        this.textarea.value = text || "";
      }
    }

    getSelection() {
      if (!this.textarea) {
        return null;
      }

      return {
        from: this.textarea.selectionStart,
        to: this.textarea.selectionEnd
      };
    }

    replaceSelection(text) {
      if (!this.textarea) {
        return;
      }

      var selection = this.getSelection();
      var value = this.textarea.value;
      this.textarea.value = value.slice(0, selection.from) + text + value.slice(selection.to);
      var position = selection.from + text.length;
      this.textarea.setSelectionRange(position, position);
      this.emitChange();
    }

    setLanguage(languageId) {
      this.languageId = languageId || "plain-text";
      if (this.textarea) {
        this.textarea.dataset.languageId = this.languageId;
      }
    }

    setDiagnostics(diagnostics) {
      this.diagnostics = Array.isArray(diagnostics) ? diagnostics : [];
    }

    focus() {
      if (this.textarea) {
        this.textarea.focus();
      }
    }
  }

  global.EditorCore = EditorCore;
})(window);

