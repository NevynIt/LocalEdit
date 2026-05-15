(function (global) {
  "use strict";

  function addOption(select, value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  class Toolbar {
    constructor(layout, app) {
      this.layout = layout;
      this.app = app;
      this.elements = {};
      this.render();
    }

    render() {
      var root = this.layout.toolbar;
      root.textContent = "";

      this.elements.newButton = this.createButton("New", () => this.app.newDocument());
      this.elements.openButton = this.createButton("Open", () => this.app.openFile());
      this.elements.openButton.title = "Click to choose a file or drop a file here";
      this.installOpenDropTarget(this.elements.openButton);
      this.elements.saveButton = this.createButton("Save", () => this.app.saveSourceAsDownload());
      root.appendChild(this.group([this.elements.newButton, this.elements.openButton, this.elements.saveButton]));

      this.elements.languageSelect = document.createElement("select");
      this.elements.languageSelect.addEventListener("change", () => {
        this.app.setLanguage(this.elements.languageSelect.value);
      });
      root.appendChild(this.group([this.label("Language"), this.elements.languageSelect]));

      this.elements.editorSelect = document.createElement("select");
      this.elements.editorSelect.addEventListener("change", () => {
        this.app.switchEditor(this.elements.editorSelect.value);
      });
      root.appendChild(this.group([this.label("Editor"), this.elements.editorSelect]));

      this.elements.reopenSelect = document.createElement("select");
      this.elements.reopenButton = this.createButton("Reopen", () => {
        this.app.reopenClosedDocument(this.elements.reopenSelect.value);
      });
      root.appendChild(this.group([this.label("Closed"), this.elements.reopenSelect, this.elements.reopenButton]));

      this.elements.lintButton = this.createButton("Lint", () => this.app.runLinters());
      root.appendChild(this.group([this.elements.lintButton]));

      this.elements.refreshButton = this.createButton("Refresh", () => this.app.refreshRenderers());
      this.elements.autoRefreshToggle = document.createElement("input");
      this.elements.autoRefreshToggle.type = "checkbox";
      this.elements.autoRefreshToggle.addEventListener("change", () => {
        this.app.setAutoRefresh(this.elements.autoRefreshToggle.checked);
      });
      this.elements.intermediateToggle = document.createElement("input");
      this.elements.intermediateToggle.type = "checkbox";
      this.elements.intermediateToggle.addEventListener("change", () => {
        this.app.setOpenIntermediateDocuments(this.elements.intermediateToggle.checked);
      });
      var autoRefreshLabel = document.createElement("label");
      autoRefreshLabel.className = "toolbar-check";
      autoRefreshLabel.appendChild(this.elements.autoRefreshToggle);
      autoRefreshLabel.appendChild(document.createTextNode(" Auto 3s"));
      var intermediateLabel = document.createElement("label");
      intermediateLabel.className = "toolbar-check";
      intermediateLabel.appendChild(this.elements.intermediateToggle);
      intermediateLabel.appendChild(document.createTextNode(" Steps"));

      this.elements.pipelineSelect = document.createElement("select");
      this.elements.pipelineButton = this.createButton("Run", () => {
        this.app.runPipelineAction(this.elements.pipelineSelect.value);
      });
      this.elements.discoverPipelinesButton = this.createButton("Discover", () => {
        this.app.openContributionCatalogDocument();
      });
      root.appendChild(this.group([this.label("Pipeline"), this.elements.pipelineSelect, this.elements.pipelineButton, this.elements.discoverPipelinesButton, this.elements.refreshButton, autoRefreshLabel, intermediateLabel]));

      this.elements.pluginsButton = this.createButton("Plugins", () => this.app.togglePluginManagerPanel());
      root.appendChild(this.group([this.elements.pluginsButton]));
    }

    update(state) {
      this.populateSelect(this.elements.languageSelect, state.languages, state.languageId, "id", "displayName");
      this.populateProviderSelect(this.elements.editorSelect, state.editors, "No editors");
      this.populateProviderSelect(this.elements.reopenSelect, state.closedDocuments, "No closed tabs");
      this.populateProviderSelect(this.elements.pipelineSelect, state.pipelineActions, "No pipelines");
      this.elements.editorSelect.value = state.editorId || "";

      this.elements.saveButton.disabled = !state.hasDocument;
      this.elements.languageSelect.disabled = !state.hasDocument;
      this.elements.editorSelect.disabled = state.editors.length === 0;
      this.elements.reopenButton.disabled = state.closedDocuments.length === 0;
      this.elements.lintButton.disabled = !state.hasDocument;
      this.elements.refreshButton.disabled = !state.hasRenderSessions;
      this.elements.autoRefreshToggle.disabled = !state.hasDocument;
      this.elements.autoRefreshToggle.checked = Boolean(state.autoRefreshEnabled);
      this.elements.intermediateToggle.disabled = !state.hasDocument;
      this.elements.intermediateToggle.checked = Boolean(state.openIntermediateDocuments);
      this.elements.pipelineButton.disabled = state.pipelineActions.length === 0;
      this.elements.discoverPipelinesButton.disabled = !state.canDiscoverPipelines;
    }

    populateSelect(select, items, selectedValue, valueKey, labelKey) {
      select.textContent = "";
      items.forEach(function (item) {
        addOption(select, item[valueKey], item[labelKey]);
      });
      select.value = selectedValue;
    }

    populateProviderSelect(select, items, emptyLabel) {
      select.textContent = "";
      if (items.length === 0) {
        addOption(select, "", emptyLabel);
        select.disabled = true;
        return;
      }

      select.disabled = false;
      items.forEach(function (provider) {
        addOption(select, provider.id, provider.name || provider.id);
      });
    }

    createButton(label, handler) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", handler);
      return button;
    }

    installOpenDropTarget(button) {
      function hasFiles(event) {
        var types = event.dataTransfer && event.dataTransfer.types;
        return types && Array.prototype.indexOf.call(types, "Files") !== -1;
      }

      button.addEventListener("dragenter", function (event) {
        if (!hasFiles(event)) {
          return;
        }
        event.preventDefault();
        button.classList.add("is-drop-target");
      });
      button.addEventListener("dragover", function (event) {
        if (!hasFiles(event)) {
          return;
        }
        event.preventDefault();
        button.classList.add("is-drop-target");
      });
      button.addEventListener("dragleave", function () {
        button.classList.remove("is-drop-target");
      });
      button.addEventListener("drop", (event) => {
        if (!hasFiles(event)) {
          return;
        }
        event.preventDefault();
        button.classList.remove("is-drop-target");
        this.app.openDroppedFiles(event.dataTransfer.files);
      });
    }

    label(text) {
      var span = document.createElement("span");
      span.className = "toolbar-label";
      span.textContent = text;
      return span;
    }

    group(children) {
      var group = document.createElement("div");
      group.className = "toolbar-group";
      children.forEach(function (child) {
        group.appendChild(child);
      });
      return group;
    }
  }

  global.Toolbar = Toolbar;
})(window);
