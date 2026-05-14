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
      root.appendChild(this.group([this.label("Render"), this.elements.rendererSelect, this.elements.rendererButton]));

      this.elements.exporterSelect = document.createElement("select");
      this.elements.exporterButton = this.createButton("Export", () => {
        this.app.runExporter(this.elements.exporterSelect.value);
      });
      root.appendChild(this.group([this.label("Export"), this.elements.exporterSelect, this.elements.exporterButton]));

      this.elements.pluginsButton = this.createButton("Plugins", () => this.app.togglePluginManagerPanel());
      root.appendChild(this.group([this.elements.pluginsButton]));
    }

    update(state) {
      this.populateSelect(this.elements.languageSelect, state.languages, state.languageId, "id", "label");
      this.populateProviderSelect(this.elements.transformSelect, state.transformers, "No transformers");
      this.populateProviderSelect(this.elements.rendererSelect, state.renderers, "No renderers");
      this.populateProviderSelect(this.elements.exporterSelect, state.exporters, "No exporters");

      this.elements.transformButton.disabled = state.transformers.length === 0;
      this.elements.rendererButton.disabled = state.renderers.length === 0;
      this.elements.exporterButton.disabled = state.exporters.length === 0;
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

