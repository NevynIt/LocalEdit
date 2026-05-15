(function (global) {
  "use strict";

  class TextareaEditor {
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

    destroy() {
      if (this.textarea && this.textarea.parentNode) {
        this.textarea.parentNode.removeChild(this.textarea);
      }
      this.textarea = null;
      this.container = null;
    }

    onTextChanged(handler) {
      this.changeHandlers.push(handler);
    }

    onDidChange(handler) {
      this.onTextChanged(handler);
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

    selectRange(from, to) {
      if (!this.textarea) {
        return;
      }

      var value = this.textarea.value || "";
      var start = Math.max(0, Math.min(Number.isFinite(from) ? from : 0, value.length));
      var end = Math.max(start, Math.min(Number.isFinite(to) ? to : start, value.length));
      this.textarea.focus();
      this.textarea.setSelectionRange(start, end);

      var line = value.slice(0, start).split("\n").length - 1;
      var style = global.getComputedStyle ? global.getComputedStyle(this.textarea) : null;
      var lineHeight = style ? Number.parseFloat(style.lineHeight) : 0;
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        lineHeight = 21;
      }
      this.textarea.scrollTop = Math.max(0, line * lineHeight - this.textarea.clientHeight / 2);
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

  class CodeMirrorEditor {
    constructor() {
      this.container = null;
      this.view = null;
      this.languageCompartment = null;
      this.languageId = "plain-text";
      this.diagnostics = [];
      this.changeHandlers = [];
    }

    mount(container) {
      this.container = container;
      var codeMirror = global.EditorWorkbenchCodeMirror;
      if (!codeMirror || !codeMirror.EditorView || !codeMirror.EditorState || !codeMirror.Compartment) {
        throw new Error("CodeMirror runtime is not available.");
      }

      this.languageCompartment = new codeMirror.Compartment();
      this.view = new codeMirror.EditorView({
        state: codeMirror.EditorState.create({
          doc: "",
          extensions: [
            codeMirror.basicSetup,
            codeMirror.EditorView.lineWrapping,
            this.languageCompartment.of([]),
            codeMirror.EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                this.emitChange();
              }
            })
          ]
        }),
        parent: container
      });
    }

    destroy() {
      if (this.view) {
        this.view.destroy();
      }
      this.view = null;
      this.languageCompartment = null;
      this.container = null;
    }

    onTextChanged(handler) {
      this.changeHandlers.push(handler);
    }

    onDidChange(handler) {
      this.onTextChanged(handler);
    }

    emitChange() {
      var text = this.getText();
      this.changeHandlers.forEach(function (handler) {
        handler(text);
      });
    }

    getText() {
      return this.view ? this.view.state.doc.toString() : "";
    }

    setText(text) {
      if (!this.view) {
        return;
      }
      var nextText = text || "";
      if (nextText !== this.getText()) {
        this.view.dispatch({
          changes: {
            from: 0,
            to: this.view.state.doc.length,
            insert: nextText
          }
        });
      }
    }

    getSelection() {
      if (!this.view) {
        return null;
      }
      var selection = this.view.state.selection.main;
      return {
        from: selection.from,
        to: selection.to
      };
    }

    replaceSelection(text) {
      if (!this.view) {
        return;
      }
      this.view.dispatch(this.view.state.replaceSelection(text));
      this.emitChange();
    }

    selectRange(from, to) {
      if (!this.view) {
        return;
      }
      var docLength = this.view.state.doc.length;
      var start = Math.max(0, Math.min(Number.isFinite(from) ? from : 0, docLength));
      var end = Math.max(start, Math.min(Number.isFinite(to) ? to : start, docLength));
      this.view.dispatch({
        selection: { anchor: start, head: end },
        scrollIntoView: true
      });
      this.view.focus();
    }

    setLanguage(languageId, context) {
      this.languageId = languageId || "plain-text";
      if (!this.view || !this.languageCompartment) {
        return;
      }

      var codeMirrorExtensions = context && Array.isArray(context.extensions) ? context.extensions : [];
      this.view.dispatch({
        effects: this.languageCompartment.reconfigure(codeMirrorExtensions)
      });
    }

    setDiagnostics(diagnostics) {
      this.diagnostics = Array.isArray(diagnostics) ? diagnostics : [];
    }

    focus() {
      if (this.view) {
        this.view.focus();
      }
    }
  }

  global.TextareaEditor = TextareaEditor;
  global.CodeMirrorEditor = CodeMirrorEditor;
  global.EditorCore = CodeMirrorEditor;
})(window);
