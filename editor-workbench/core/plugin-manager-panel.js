(function (global) {
  "use strict";

  function el(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  class PluginManagerPanel {
    constructor(layout, app) {
      this.layout = layout;
      this.app = app;
    }

    render(state) {
      var root = this.layout.pluginPanel;
      root.textContent = "";

      var header = el("div", "panel-header");
      header.appendChild(el("h2", "panel-title", "Plugin Manager"));
      var closeButton = el("button", "", "Close");
      closeButton.type = "button";
      closeButton.addEventListener("click", () => this.app.togglePluginManagerPanel(false));
      header.appendChild(closeButton);
      root.appendChild(header);

      var body = el("div", "panel-body");
      root.appendChild(body);

      if (state.canAddPluginPath) {
        body.appendChild(this.renderAddPlugin());
      }

      if (state.canUploadPluginFile) {
        body.appendChild(this.renderUploadPlugin());
      }

      if (state.items.length === 0) {
        body.appendChild(el("p", "empty-state", "No known plugins are configured."));
        return;
      }

      this.sortedItems(state.items).forEach((item) => {
        body.appendChild(this.renderPluginItem(item));
      });
    }

    renderAddPlugin() {
      var wrapper = el("div", "plugin-add");
      var input = document.createElement("input");
      input.type = "text";
      input.placeholder = "plugins/example.js";
      input.setAttribute("aria-label", "Plugin path");

      var button = el("button", "", "Add");
      button.type = "button";
      button.addEventListener("click", async () => {
        await this.app.addKnownPlugin(input.value.trim());
        input.value = "";
      });

      wrapper.appendChild(input);
      wrapper.appendChild(button);
      return wrapper;
    }

    renderUploadPlugin() {
      var wrapper = el("div", "plugin-add");
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".js,text/javascript,application/javascript";
      input.setAttribute("aria-label", "Upload plugin file");

      var button = el("button", "", "Upload");
      button.type = "button";
      button.addEventListener("click", async () => {
        var file = input.files && input.files[0];
        if (file) {
          await this.app.uploadPluginFile(file);
          input.value = "";
        }
      });

      wrapper.appendChild(input);
      wrapper.appendChild(button);
      return wrapper;
    }

    renderPluginItem(item) {
      var config = item.config;
      var registered = item.registered;
      var isLoaded = Boolean(registered && registered.active);
      var wrapper = el("section", "plugin-item");

      var titleRow = el("div", "plugin-title-row");
      titleRow.appendChild(el("span", "plugin-name", isLoaded ? registered.name : this.unloadedPluginName(config, registered)));
      titleRow.appendChild(this.statusChip(isLoaded ? "loaded" : config.lastStatus === "failed" ? "failed" : "unloaded"));
      wrapper.appendChild(titleRow);

      var grid = el("div", "meta-grid");
      grid.appendChild(this.metaRow(config.sourceType === "uploaded" ? "File" : "Path", config.sourceType === "uploaded" ? config.fileName : config.path));
      grid.appendChild(this.metaRow("ID", registered ? registered.id : config.id || ""));
      grid.appendChild(this.metaRow("Version", registered ? registered.version : ""));
      grid.appendChild(this.metaRow("Languages", registered && registered.languages.length ? registered.languages.join(", ") : ""));
      grid.appendChild(this.metaRow("Contributions", registered ? this.engineSummary(registered.plugin) : ""));
      if (registered && registered.description) {
        grid.appendChild(this.metaRow("About", registered.description));
      }
      if (registered && registered.plugin && registered.plugin.documentationUrl) {
        grid.appendChild(this.linkMetaRow("Documentation", registered.plugin.documentationUrl, "Open documentation"));
      }
      wrapper.appendChild(grid);

      var autoLabel = el("label", "");
      var autoToggle = document.createElement("input");
      autoToggle.type = "checkbox";
      autoToggle.checked = config.autoLoad;
      autoToggle.addEventListener("change", () => {
        this.app.setPluginAutoLoad(config.id || config.path || config.uploadId, autoToggle.checked);
      });
      autoLabel.appendChild(autoToggle);
      autoLabel.appendChild(document.createTextNode(" Auto-load"));
      wrapper.appendChild(autoLabel);

      if (config.lastError) {
        wrapper.appendChild(el("div", "error-text", config.lastError));
      }

      var actions = el("div", "plugin-actions");
      if (!isLoaded) {
        var loadButton = el("button", "", "Load");
        loadButton.type = "button";
        loadButton.addEventListener("click", () => this.app.loadKnownPlugin(config.id || config.path || config.uploadId));
        actions.appendChild(loadButton);
      }

      if (isLoaded && registered && registered.plugin && typeof registered.plugin.getExampleDocument === "function") {
        var exampleButton = el("button", "", "Load example file");
        exampleButton.type = "button";
        exampleButton.addEventListener("click", () => this.app.loadPluginExample(registered.id));
        actions.appendChild(exampleButton);
      }

      var removeButton = el("button", "", "Remove");
      removeButton.type = "button";
      removeButton.addEventListener("click", () => this.app.removeKnownPlugin(config.id || config.path || config.uploadId));
      actions.appendChild(removeButton);
      wrapper.appendChild(actions);

      return wrapper;
    }

    unloadedPluginName(config, registered) {
      var pluginId = registered && registered.id ? registered.id : config.id;
      if (pluginId) {
        return pluginId.replace(/-core$/, "");
      }

      var sourceName = config.sourceType === "uploaded" ? config.fileName : config.path;
      if (!sourceName) {
        return "Unloaded plugin";
      }

      return sourceName
        .split("/")
        .pop()
        .replace(/\.plugin\.js$/, "")
        .replace(/\.js$/, "")
        .replace(/-core$/, "");
    }

    sortedItems(items) {
      return (Array.isArray(items) ? items.slice() : []).sort((left, right) => {
        var leftLoaded = left && left.registered && left.registered.active ? 1 : 0;
        var rightLoaded = right && right.registered && right.registered.active ? 1 : 0;
        if (leftLoaded !== rightLoaded) {
          return rightLoaded - leftLoaded;
        }

        return this.pluginSortName(left).localeCompare(this.pluginSortName(right), undefined, { sensitivity: "base" });
      });
    }

    pluginSortName(item) {
      if (!item) {
        return "";
      }

      var registered = item.registered;
      if (registered && registered.active && registered.name) {
        return registered.name;
      }

      return this.unloadedPluginName(item.config || {}, registered);
    }

    statusChip(status) {
      var chip = el("span", "status-chip " + status, status);
      return chip;
    }

    linkMetaRow(key, href, label) {
      var link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = label || href;
      return this.metaRow(key, link);
    }

    metaRow(key, value) {
      var row = el("div", "meta-row");
      row.appendChild(el("span", "meta-key", key));
      var valueNode = el("span", "meta-value");
      if (value instanceof Node) {
        valueNode.appendChild(value);
      } else {
        valueNode.textContent = value || "-";
      }
      row.appendChild(valueNode);
      return row;
    }

    engineSummary(plugin) {
      var contributes = plugin && plugin.contributes ? plugin.contributes : {};
      var parts = [];
      [
        ["editors", "editor"],
        ["editorExtensions", "editor extension"],
        ["linters", "linter"],
        ["transformers", "transformer"],
        ["renderers", "renderer"],
        ["exporters", "exporter"],
        ["pipelines", "pipeline"]
      ].forEach(function (entry) {
        var values = Array.isArray(contributes[entry[0]]) ? contributes[entry[0]] : [];
        if (values.length) {
          parts.push(values.length + " " + entry[1] + (values.length === 1 ? "" : "s"));
        }
      });
      return parts.join(", ") || "None";
    }
  }

  global.PluginManagerPanel = PluginManagerPanel;
})(window);
