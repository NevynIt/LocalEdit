(function (global) {
  "use strict";

  class EditorCore {
    constructor() {
      this.container = null;
      this.textarea = null;
      this.view = null;
      this.languageCompartment = null;
      this.languageId = "plain-text";
      this.diagnostics = [];
      this.changeHandlers = [];
      this.mode = "textarea";
    }

    mount(container) {
      this.container = container;
      if (this.tryMountCodeMirror(container)) {
        return;
      }

      this.textarea = document.createElement("textarea");
      this.textarea.className = "editor-textarea";
      this.textarea.spellcheck = false;
      this.textarea.setAttribute("aria-label", "Source text");
      this.textarea.addEventListener("input", () => {
        this.emitChange();
      });
      container.appendChild(this.textarea);
    }

    tryMountCodeMirror(container) {
      var codeMirror = global.EditorWorkbenchCodeMirror;
      if (!codeMirror || !codeMirror.EditorView || !codeMirror.EditorState || !codeMirror.Compartment) {
        return false;
      }

      try {
        this.mode = "codemirror";
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
        return true;
      } catch (error) {
        this.mode = "textarea";
        this.view = null;
        this.languageCompartment = null;
        return false;
      }
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
      if (this.view) {
        return this.view.state.doc.toString();
      }

      return this.textarea ? this.textarea.value : "";
    }

    setText(text) {
      if (this.view) {
        var nextText = text || "";
        var currentText = this.getText();
        if (nextText !== currentText) {
          this.view.dispatch({
            changes: {
              from: 0,
              to: this.view.state.doc.length,
              insert: nextText
            }
          });
        }
        return;
      }

      if (this.textarea) {
        this.textarea.value = text || "";
      }
    }

    getSelection() {
      if (this.view) {
        var selection = this.view.state.selection.main;
        return {
          from: selection.from,
          to: selection.to
        };
      }

      if (!this.textarea) {
        return null;
      }

      return {
        from: this.textarea.selectionStart,
        to: this.textarea.selectionEnd
      };
    }

    replaceSelection(text) {
      if (this.view) {
        this.view.dispatch(this.view.state.replaceSelection(text));
        this.emitChange();
        return;
      }

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
      var start = Number.isFinite(from) ? from : 0;
      var end = Number.isFinite(to) ? to : start;

      if (this.view) {
        var docLength = this.view.state.doc.length;
        start = Math.max(0, Math.min(start, docLength));
        end = Math.max(start, Math.min(end, docLength));
        this.view.dispatch({
          selection: { anchor: start, head: end },
          scrollIntoView: true
        });
        this.view.focus();
        return;
      }

      if (!this.textarea) {
        return;
      }

      var value = this.textarea.value || "";
      start = Math.max(0, Math.min(start, value.length));
      end = Math.max(start, Math.min(end, value.length));
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

    setLanguage(languageId, extensions) {
      this.languageId = languageId || "plain-text";
      if (this.view && this.languageCompartment) {
        var codeMirrorExtensions = Array.isArray(extensions) ? extensions : [];
        this.view.dispatch({
          effects: this.languageCompartment.reconfigure(codeMirrorExtensions)
        });
        return;
      }

      if (this.textarea) {
        this.textarea.dataset.languageId = this.languageId;
      }
    }

    setDiagnostics(diagnostics) {
      this.diagnostics = Array.isArray(diagnostics) ? diagnostics : [];
    }

    focus() {
      if (this.view) {
        this.view.focus();
        return;
      }

      if (this.textarea) {
        this.textarea.focus();
      }
    }
  }

  global.EditorCore = EditorCore;
})(window);
