(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizePath(value, fallback) {
    if (Array.isArray(value)) {
      return value.map(function (part) { return String(part || "").trim(); }).filter(Boolean);
    }
    if (typeof value === "string") {
      return value.split(/[\/>]/).map(function (part) { return part.trim(); }).filter(Boolean);
    }
    return list(fallback).map(function (part) { return String(part || "").trim(); }).filter(Boolean);
  }

  function addPath(root, path, item) {
    var current = root;
    path.forEach(function (part) {
      if (!current.childrenByLabel) {
        current.childrenByLabel = new Map();
      }
      if (!current.childrenByLabel.has(part)) {
        var next = {
          type: "group",
          label: part,
          children: [],
          childrenByLabel: new Map()
        };
        current.childrenByLabel.set(part, next);
        current.children.push(next);
      }
      current = current.childrenByLabel.get(part);
    });
    current.children.push(item);
  }

  var MENU_GROUP_ORDER = [
    "Preview",
    "Graphs",
    "Tables",
    "Convert",
    "Export",
    "Reports",
    "Analyze",
    "Text & Documents",
    "Data",
    "Code & APIs",
    "Markup & Media",
    "Graphs & Diagrams",
    "Process & Architecture",
    "LocalEdit",
    "Editors",
    "Recently closed"
  ];

  function menuGroupRank(label) {
    var index = MENU_GROUP_ORDER.indexOf(String(label || ""));
    return index === -1 ? MENU_GROUP_ORDER.length : index;
  }

  function sortMenuNodes(nodes) {
    nodes.sort(function (a, b) {
      if (a.type !== b.type) {
        return a.type === "group" ? -1 : 1;
      }
      if (a.type === "group") {
        var rankA = menuGroupRank(a.label);
        var rankB = menuGroupRank(b.label);
        if (rankA !== rankB) {
          return rankA - rankB;
        }
      }
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
    nodes.forEach(function (node) {
      if (node.type === "group") {
        sortMenuNodes(node.children);
      }
    });
    return nodes;
  }

  function compactMenuNode(node) {
    if (!node || node.type !== "group") {
      return node;
    }
    node.children = compactMenuNodes(node.children, false);
    while (node.children.length === 1 && node.children[0].type === "group") {
      node.children = node.children[0].children;
    }
    return node;
  }

  function compactMenuNodes(nodes, isRoot) {
    var compacted = list(nodes).map(compactMenuNode);
    while (isRoot && compacted.length === 1 && compacted[0].type === "group") {
      compacted = compacted[0].children;
    }
    return compacted;
  }

  function inferLanguageMenuPath(language) {
    var id = String(language && language.id || "");
    if (!id || id === "text" || id === "text.plain" || id === "text.markdown" || id === "text.indented-tree" || id === "xml.opml") {
      return ["Text & Documents"];
    }
    if (
      id === "text.javascript"
      || id === "text.python"
      || id === "json.openapi"
      || id === "json.table.endpoint-list"
      || id === "yaml.openapi"
    ) {
      return ["Code & APIs"];
    }
    if (
      id === "json.model-graph.process"
      || id === "json.model-graph.architecture"
      || id === "json.model-graph.traceability"
      || id === "json.table.role-activity"
      || id === "json.table.traceability-matrix"
      || id === "xml.bpmn"
      || id === "xml.archimate-exchange"
    ) {
      return ["Process & Architecture"];
    }
    if (
      id === "text.csv"
      || id === "text.json"
      || id === "text.yaml"
      || id === "json.tree"
      || id === "json.table"
      || id.indexOf("json.table.") === 0
      || id === "json.profile"
      || id === "json.chart"
      || id === "json.indented-tree"
      || id.indexOf("yaml.") === 0
    ) {
      return ["Data"];
    }
    if (
      id === "text.mermaid"
      || id === "text.graphviz-dot"
      || id === "json.cytoscape"
      || id === "json.jsmind"
      || id === "json.model-graph"
      || id === "json.model-graph.dependency"
      || id === "xml.gexf"
    ) {
      return ["Graphs & Diagrams"];
    }
    if (id === "text.xml" || id === "xml.svg") {
      return ["Markup & Media"];
    }
    if (id === "localedit.pipeline-json") {
      return ["LocalEdit"];
    }
    return language && language.category ? [language.category] : [];
  }

  class MenuButton {
    constructor(label, onSelect) {
      this.label = label;
      this.onSelect = onSelect;
      this.selectedValue = "";
      this.selectedLabel = "";
      this.items = [];
      this.submenuEntries = [];
      this.root = document.createElement("div");
      this.root.className = "toolbar-menu";
      this.button = document.createElement("button");
      this.button.type = "button";
      this.button.className = "toolbar-menu-button";
      this.button.setAttribute("aria-haspopup", "menu");
      this.button.setAttribute("aria-expanded", "false");
      this.panel = document.createElement("div");
      this.panel.className = "toolbar-menu-panel";
      this.panel.setAttribute("role", "menu");
      this.root.appendChild(this.button);
      this.root.appendChild(this.panel);

      this.button.addEventListener("click", () => {
        this.toggle();
      });
      this.button.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.open();
          this.focusFirstItem();
        }
      });
      this.root.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.close();
          this.button.focus();
        }
      });
      this.panel.addEventListener("scroll", () => {
        this.closeSubmenusFromDepth(0);
      });
      document.addEventListener("click", (event) => {
        if (!this.root.contains(event.target)) {
          this.close();
        }
      });
      this.updateButton();
    }

    setDisabled(disabled) {
      this.button.disabled = Boolean(disabled);
      if (disabled) {
        this.close();
      }
    }

    update(items, selectedValue, emptyLabel) {
      this.disposeSubmenus();
      this.items = list(items);
      this.selectedValue = selectedValue || "";
      var selected = this.items.find((item) => item.id === this.selectedValue || item.value === this.selectedValue);
      this.selectedLabel = selected ? selected.label || selected.name || selected.id : "";
      this.panel.textContent = "";
      if (!this.items.length) {
        var empty = document.createElement("div");
        empty.className = "toolbar-menu-empty";
        empty.textContent = emptyLabel || "No items";
        this.panel.appendChild(empty);
      } else {
        this.panel.appendChild(this.renderNodes(sortMenuNodes(compactMenuNodes(this.buildTree(this.items), true)), 0, null));
      }
      this.updateButton();
    }

    buildTree(items) {
      var root = {
        children: [],
        childrenByLabel: new Map()
      };
      items.forEach(function (item) {
        var menuPath = normalizePath(item.menuPath, item.category ? [item.category] : []);
        var leaf = {
          type: "item",
          id: item.id,
          value: item.value || item.id,
          label: item.label || item.name || item.id,
          description: item.description || "",
          selected: item.id === this.selectedValue || item.value === this.selectedValue
        };
        addPath(root, menuPath, leaf);
      }, this);
      return root.children;
    }

    renderNodes(nodes, depth, ownerSubmenu) {
      var listNode = document.createElement("div");
      listNode.className = "toolbar-menu-list";
      nodes.forEach((node) => {
        if (node.type === "group") {
          var wrapper = document.createElement("div");
          wrapper.className = "toolbar-menu-group";
          var groupButton = document.createElement("button");
          groupButton.type = "button";
          groupButton.className = "toolbar-menu-group-button";
          groupButton.textContent = node.label;
          groupButton.setAttribute("aria-haspopup", "menu");
          wrapper.appendChild(groupButton);
          var submenu = document.createElement("div");
          submenu.className = "toolbar-submenu";
          submenu._toolbarParentSubmenu = ownerSubmenu;
          submenu.appendChild(this.renderNodes(node.children, depth + 1, submenu));
          this.root.appendChild(submenu);
          this.installSubmenuBehavior({
            depth: depth,
            trigger: groupButton,
            wrapper: wrapper,
            submenu: submenu
          });
          listNode.appendChild(wrapper);
          return;
        }

        var button = document.createElement("button");
        button.type = "button";
        button.className = "toolbar-menu-item" + (node.selected ? " is-selected" : "");
        button.setAttribute("role", "menuitem");
        button.dataset.value = node.value;
        button.textContent = node.label;
        button.title = node.description || node.label;
        button.addEventListener("click", () => {
          this.close();
          this.onSelect(node.value);
        });
        listNode.appendChild(button);
      });
      return listNode;
    }

    installSubmenuBehavior(entry) {
      this.submenuEntries.push(entry);

      var open = () => {
        this.openSubmenu(entry);
      };
      var close = (event) => {
        if (this.isWithinSubmenuFamily(entry, event.relatedTarget)) {
          return;
        }
        this.closeSubmenusFromDepth(entry.depth);
      };

      entry.wrapper.addEventListener("mouseenter", open);
      entry.wrapper.addEventListener("mouseleave", close);
      entry.wrapper.addEventListener("focusin", open);
      entry.wrapper.addEventListener("focusout", close);
      entry.submenu.addEventListener("mouseleave", close);
      entry.submenu.addEventListener("focusout", close);
    }

    isWithinSubmenuFamily(entry, target) {
      if (!target) {
        return false;
      }
      if (entry.wrapper.contains(target) || entry.submenu.contains(target)) {
        return true;
      }
      if (!target.closest) {
        return false;
      }
      var submenu = target.closest(".toolbar-submenu");
      while (submenu) {
        if (submenu === entry.submenu) {
          return true;
        }
        submenu = submenu._toolbarParentSubmenu || null;
      }
      return false;
    }

    openSubmenu(entry) {
      this.closeSubmenusFromDepth(entry.depth);
      entry.submenu.classList.add("is-open");

      var triggerRect = entry.trigger.getBoundingClientRect();
      var rootRect = this.root.getBoundingClientRect();
      var left = triggerRect.right - rootRect.left - 2;
      var top = triggerRect.top - rootRect.top - 1;

      entry.submenu.style.left = left + "px";
      entry.submenu.style.top = top + "px";

      var submenuRect = entry.submenu.getBoundingClientRect();
      if (submenuRect.right > window.innerWidth - 12) {
        left = triggerRect.left - rootRect.left - submenuRect.width + 2;
      }
      if (submenuRect.bottom > window.innerHeight - 12) {
        top = Math.max(4, top - (submenuRect.bottom - window.innerHeight + 12));
      }

      entry.submenu.style.left = left + "px";
      entry.submenu.style.top = top + "px";
    }

    closeSubmenusFromDepth(depth) {
      this.submenuEntries.forEach(function (entry) {
        if (entry.depth >= depth) {
          entry.submenu.classList.remove("is-open");
        }
      });
    }

    disposeSubmenus() {
      this.submenuEntries.forEach(function (entry) {
        if (entry.submenu.parentNode) {
          entry.submenu.parentNode.removeChild(entry.submenu);
        }
      });
      this.submenuEntries = [];
    }

    updateButton() {
      var suffix = this.selectedLabel ? ": " + this.selectedLabel : "";
      this.button.textContent = this.label + suffix;
    }

    focusFirstItem() {
      var first = this.panel.querySelector(".toolbar-menu-item, .toolbar-menu-group-button");
      if (first) {
        first.focus();
      }
    }

    open() {
      if (this.button.disabled) {
        return;
      }
      this.root.classList.add("is-open");
      this.button.setAttribute("aria-expanded", "true");
    }

    close() {
      this.closeSubmenusFromDepth(0);
      this.root.classList.remove("is-open");
      this.button.setAttribute("aria-expanded", "false");
    }

    toggle() {
      if (this.root.classList.contains("is-open")) {
        this.close();
      } else {
        this.open();
      }
    }
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

      this.elements.languageMenu = new MenuButton("Language", (languageId) => {
        this.app.setLanguage(languageId);
      });
      root.appendChild(this.group([this.elements.languageMenu.root]));

      this.elements.editorMenu = new MenuButton("Editor", (editorId) => {
        this.app.switchEditor(editorId);
      });
      root.appendChild(this.group([this.elements.editorMenu.root]));

      this.elements.reopenMenu = new MenuButton("Reopen", (documentId) => {
        this.app.reopenClosedDocument(documentId);
      });
      root.appendChild(this.group([this.elements.reopenMenu.root]));

      this.elements.lintButton = this.createButton("Lint", () => this.app.runLinters());
      root.appendChild(this.group([this.elements.lintButton]));

      this.elements.actionsMenu = new MenuButton("Actions", (actionId) => {
        this.app.runPipelineAction(actionId);
      });
      this.elements.discoverPipelinesButton = this.createButton("Discover", () => {
        this.app.openContributionCatalogDocument();
      });
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
      root.appendChild(this.group([this.elements.actionsMenu.root, this.elements.discoverPipelinesButton, this.elements.refreshButton, autoRefreshLabel, intermediateLabel]));

      this.elements.pluginsButton = this.createButton("Plugins", () => this.app.togglePluginManagerPanel());
      root.appendChild(this.group([this.elements.pluginsButton]));
    }

    update(state) {
      this.elements.languageMenu.update(this.buildLanguageItems(state.languages), state.languageId, "No languages");
      this.elements.editorMenu.update(this.buildProviderItems(state.editors, "Editors"), state.editorId || "", "No editors");
      this.elements.reopenMenu.update(this.buildProviderItems(state.closedDocuments, "Recently closed"), "", "No closed tabs");
      this.elements.actionsMenu.update(this.buildActionItems(state.pipelineActions), "", "No actions");

      this.elements.saveButton.disabled = !state.hasDocument;
      this.elements.languageMenu.setDisabled(!state.hasDocument);
      this.elements.editorMenu.setDisabled(state.editors.length === 0);
      this.elements.reopenMenu.setDisabled(state.closedDocuments.length === 0);
      this.elements.lintButton.disabled = !state.hasDocument;
      this.elements.refreshButton.disabled = !state.hasRenderSessions;
      this.elements.autoRefreshToggle.disabled = !state.hasDocument;
      this.elements.autoRefreshToggle.checked = Boolean(state.autoRefreshEnabled);
      this.elements.intermediateToggle.disabled = !state.hasDocument;
      this.elements.intermediateToggle.checked = Boolean(state.openIntermediateDocuments);
      this.elements.actionsMenu.setDisabled(state.pipelineActions.length === 0);
      this.elements.discoverPipelinesButton.disabled = !state.canDiscoverPipelines;
    }

    buildLanguageItems(languages) {
      function languagePath(language) {
        var explicit = normalizePath(language.menuPath, []);
        if (explicit.length) {
          return explicit;
        }
        return inferLanguageMenuPath(language);
      }
      return list(languages).map(function (language) {
        return {
          id: language.id,
          label: language.name || language.id,
          description: language.description || language.id,
          menuPath: languagePath(language)
        };
      });
    }

    buildProviderItems(items, groupLabel) {
      return list(items).map(function (item) {
        return {
          id: item.id,
          label: item.name || item.displayName || item.id,
          description: item.description || "",
          menuPath: normalizePath(item.menuPath, [item.category || groupLabel])
        };
      });
    }

    buildActionItems(items) {
      return list(items).map(function (item) {
        return {
          id: item.id,
          label: item.name || item.id,
          description: item.description || "",
          menuPath: normalizePath(item.menuPath, [item.category || "Actions"])
        };
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
  global.ToolbarMenuButton = MenuButton;
})(window);
