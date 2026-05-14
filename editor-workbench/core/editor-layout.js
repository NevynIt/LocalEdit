(function (global) {
  "use strict";

  class EditorLayout {
    constructor() {
      this.toolbar = document.getElementById("toolbar");
      this.editorContainer = document.getElementById("editor-container");
      this.pluginPanel = document.getElementById("plugin-manager-panel");
      this.diagnosticsPanel = document.getElementById("diagnostics-panel");
      this.statusBar = document.getElementById("status-bar");

      if (!this.toolbar || !this.editorContainer || !this.pluginPanel || !this.diagnosticsPanel || !this.statusBar) {
        throw new Error("Application layout is incomplete.");
      }
    }

    setPluginPanelOpen(open) {
      this.pluginPanel.classList.toggle("is-hidden", !open);
    }

    isPluginPanelOpen() {
      return !this.pluginPanel.classList.contains("is-hidden");
    }

    setDiagnosticsPanelOpen(open) {
      this.diagnosticsPanel.classList.toggle("is-hidden", !open);
    }

    isDiagnosticsPanelOpen() {
      return !this.diagnosticsPanel.classList.contains("is-hidden");
    }

    setStatus(message) {
      this.statusBar.textContent = message;
    }
  }

  global.EditorLayout = EditorLayout;
})(window);
