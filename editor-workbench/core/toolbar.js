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

      this.elements.openButton = this.createButton("Open", () => this.app.openFile());
      this.elements.saveButton = this.createButton("Save", () => this.app.saveSourceAsDownload());
      root.appendChild(this.group([this.elements.openButton, this.elements.saveButton]));

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

      this.elements.lintButton = this.createButton("Lint", () => this.app.runLinters());
      root.appendChild(this.group([this.elements.lintButton]));

      this.elements.transformSelect = document.createElement("select");
      this.elements.transformButton = this.createButton("Run", () => {
        this.app.runTransformer(this.elements.transformSelect.value);
      });
      root.appendChild(this.group([this.label("Transform"), this.elements.transformSelect, this.elements.transformButton]));

      this.elements.rendererSelect = document.createElement("select");
      this.elements.rendererButton = this.createButton("Open", () => {
        this.app.openRenderer(this.elements.rendererSelect.value);
      });
      this.elements.refreshButton = this.createButton("Refresh", () => this.app.refreshRenderers());
      this.elements.autoRefreshToggle = document.createElement("input");
      this.elements.autoRefreshToggle.type = "checkbox";
      this.elements.autoRefreshToggle.addEventListener("change", () => {
        this.app.setAutoRefresh(this.elements.autoRefreshToggle.checked);
      });
      var autoRefreshLabel = document.createElement("label");
      autoRefreshLabel.className = "toolbar-check";
      autoRefreshLabel.appendChild(this.elements.autoRefreshToggle);
      autoRefreshLabel.appendChild(document.createTextNode(" Auto 3s"));
      root.appendChild(this.group([this.label("Render"), this.elements.rendererSelect, this.elements.rendererButton, this.elements.refreshButton, autoRefreshLabel]));

      this.elements.exporterSelect = document.createElement("select");
      this.elements.exporterButton = this.createButton("Export", () => {
        this.app.runExporter(this.elements.exporterSelect.value);
      });
      root.appendChild(this.group([this.label("Export"), this.elements.exporterSelect, this.elements.exporterButton]));

      this.elements.pipelineSelect = document.createElement("select");
      this.elements.pipelineButton = this.createButton("Run", () => {
        this.app.runPipeline(this.elements.pipelineSelect.value);
      });
      root.appendChild(this.group([this.label("Pipeline"), this.elements.pipelineSelect, this.elements.pipelineButton]));

      this.elements.pluginsButton = this.createButton("Plugins", () => this.app.togglePluginManagerPanel());
      root.appendChild(this.group([this.elements.pluginsButton]));
    }

    update(state) {
      this.populateSelect(this.elements.languageSelect, state.languages, state.languageId, "id", "name");
      this.populateProviderSelect(this.elements.editorSelect, state.editors, "No editors");
      this.populateProviderSelect(this.elements.transformSelect, state.transformers, "No transformers");
      this.populateProviderSelect(this.elements.rendererSelect, state.renderers, "No renderers");
      this.populateProviderSelect(this.elements.exporterSelect, state.exporters, "No exporters");
      this.populateProviderSelect(this.elements.pipelineSelect, state.pipelines, "No pipelines");
      this.elements.editorSelect.value = state.editorId || "";

      this.elements.editorSelect.disabled = state.editors.length === 0;
      this.elements.transformButton.disabled = state.transformers.length === 0;
      this.elements.rendererButton.disabled = state.renderers.length === 0;
      this.elements.refreshButton.disabled = !state.hasRenderSessions;
      this.elements.autoRefreshToggle.checked = Boolean(state.autoRefreshEnabled);
      this.elements.exporterButton.disabled = state.exporters.length === 0;
      this.elements.pipelineButton.disabled = state.pipelines.length === 0;
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
