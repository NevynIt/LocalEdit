(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    jsmind: "plugins/jsmind/runtime/jsmind.bundle.js",
    css: "plugins/jsmind/runtime/jsmind.css"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireIndentedTreeTools() {
    if (!global.EditorWorkbenchIndentedTree || typeof global.EditorWorkbenchIndentedTree.parse !== "function") {
      throw new Error("Indented Tree parser is not available.");
    }
    return global.EditorWorkbenchIndentedTree;
  }

  function requireJsMind() {
    var tools = global.EditorWorkbenchJsMind;
    var jsMind = tools && tools.jsMind || global.jsMind;
    if (typeof jsMind !== "function") {
      throw new Error("jsMind runtime bundle is not loaded.");
    }
    return jsMind;
  }

  function ensureJsMindStyles() {
    if (document.getElementById("editor-workbench-jsmind-css")) {
      return;
    }
    var link = document.createElement("link");
    link.id = "editor-workbench-jsmind-css";
    link.rel = "stylesheet";
    link.href = RUNTIME_PATHS.css;
    document.head.appendChild(link);
  }

  function ensureShellStyles() {
    if (document.getElementById("editor-workbench-jsmind-shell-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "editor-workbench-jsmind-shell-style";
    style.textContent = [
      ".jsmind-render-shell { --jsmind-node-scale: 1; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; height: calc(100vh - 32px); min-height: 360px; overflow: hidden; color: var(--text, #17202c); }",
      ".jsmind-render-toolbar { display: flex; align-items: center; gap: 8px; min-width: 0; }",
      ".jsmind-render-title { min-width: 120px; max-width: 36ch; overflow: hidden; color: var(--text, #17202c); font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }",
      ".jsmind-toolbar-group { display: inline-flex; align-items: center; gap: 4px; padding: 3px; border: 1px solid var(--border, #cbd3df); border-radius: 6px; background: var(--surface, #fff); }",
      ".jsmind-tool-button { height: 28px; min-width: 32px; padding: 0 9px; border-radius: 5px; font-size: 12px; font-weight: 700; line-height: 1; }",
      ".jsmind-tool-label { min-width: 48px; color: var(--muted, #5d6b7c); font-size: 12px; font-weight: 700; text-align: center; }",
      ".jsmind-render-status { margin-left: auto; overflow: hidden; color: var(--muted, #5d6b7c); font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }",
      ".jsmind-render-viewport { position: relative; min-height: 0; overflow: hidden; border: 1px solid var(--border, #cbd3df); border-radius: 8px; background-color: #f8fafc; background-image: linear-gradient(#e5eaf1 1px, transparent 1px), linear-gradient(90deg, #e5eaf1 1px, transparent 1px); background-size: 24px 24px; }",
      ".jsmind-map-host { position: absolute; inset: 0; min-width: 0; min-height: 0; }",
      ".jsmind-map-host > .jsmind-inner { width: 100%; height: 100%; background: transparent; cursor: grab; overscroll-behavior: contain; }",
      ".jsmind-map-host > .jsmind-inner:active { cursor: grabbing; }",
      ".jsmind-render-shell svg.jsmind { opacity: 0; pointer-events: none; }",
      ".jsmind-manual-lines { position: absolute; left: 0; top: 0; z-index: 1; overflow: visible; pointer-events: none; }",
      ".jsmind-render-shell jmnodes { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; }",
      ".jsmind-render-shell jmnodes { z-index: 2; }",
      ".jsmind-render-shell jmnode { z-index: 2; box-sizing: border-box; width: max-content; min-width: 54px; max-width: 260px; min-height: 34px; padding: 8px 10px; border: 1px solid #c8d1df; border-radius: 6px; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.11); cursor: grab; font-size: calc(13px * var(--jsmind-node-scale)); font-weight: 650; line-height: 1.35; white-space: normal; overflow: visible; overflow-wrap: anywhere; text-overflow: clip; }",
      ".jsmind-render-shell jmnode:active { cursor: grabbing; }",
      ".jsmind-render-shell jmnode.is-manual-position { outline: 2px solid rgba(217, 119, 6, 0.34); outline-offset: 2px; }",
      ".jsmind-render-shell jmnode.root { min-width: 96px; max-width: 320px; min-height: 42px; padding: 10px 12px; font-size: calc(15px * var(--jsmind-node-scale)); font-weight: 750; }",
      ".jsmind-render-shell jmnodes.theme-localedit jmnode { background: #fff; color: #17202c; }",
      ".jsmind-render-shell jmnodes.theme-localedit jmnode:hover { background: #eef6f4; color: #17202c; }",
      ".jsmind-render-shell jmnodes.theme-localedit jmnode.selected { background: #d97706; color: #fff; border-color: #b45309; }",
      ".jsmind-render-shell jmnodes.theme-localedit jmnode.root { background: #0f766e; color: #fff; border-color: #0b5f59; }",
      ".jsmind-render-shell jmexpander { z-index: 5; background: #fff; color: #475569; border-color: #94a3b8; font-weight: 700; }",
      "@media (max-width: 760px) { .jsmind-render-shell jmnode { max-width: 220px; } .jsmind-render-shell jmnode.root { max-width: 260px; } }",
      "@media (max-width: 680px) { .jsmind-render-toolbar { flex-wrap: wrap; } .jsmind-render-title, .jsmind-render-status { flex-basis: 100%; max-width: none; } .jsmind-render-status { margin-left: 0; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function createToolButton(label, title) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "jsmind-tool-button";
    button.textContent = label;
    button.title = title || label;
    button.setAttribute("aria-label", title || label);
    return button;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function finiteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function countNodes(node) {
    if (!node) {
      return 0;
    }
    return 1 + (node.children || []).reduce(function (total, child) {
      return total + countNodes(child);
    }, 0);
  }

  function getMindTitle(mind) {
    if (mind && mind.meta && mind.meta.name) {
      return String(mind.meta.name);
    }
    if (mind && mind.data && mind.data.topic) {
      return String(mind.data.topic);
    }
    return "Mind Map";
  }

  function sanitizeId(value, fallback) {
    var text = String(value || "").trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!text || !/^[A-Za-z]/.test(text)) {
      text = fallback;
    }
    return text;
  }

  function buildTreeNode(node, nodeByInternalId, usedIds) {
    var baseId = sanitizeId(node.id || node.internalId, node.internalId);
    var id = baseId;
    var suffix = 2;
    while (usedIds.has(id)) {
      id = baseId + "-" + suffix;
      suffix += 1;
    }
    usedIds.add(id);

    var data = {};
    if (node.type) {
      data.type = node.type;
    }
    if (node.tags && node.tags.length) {
      data.tags = node.tags.slice();
    }
    if (node.details) {
      data.details = node.details;
    }
    if (node.attributes && Object.keys(node.attributes).length) {
      data.attributes = node.attributes;
    }

    var output = {
      id: id,
      topic: node.label || id,
      expanded: true
    };
    if (Object.keys(data).length) {
      output.data = data;
    }

    var children = (node.children || []).map(function (childId) {
      return buildTreeNode(nodeByInternalId.get(childId), nodeByInternalId, usedIds);
    }).filter(Boolean);
    if (children.length) {
      output.children = children;
    }
    return output;
  }

  function indentedTreeToJsMind(input) {
    var parser = requireIndentedTreeTools();
    var parsed = parser.parse(input.text || "");
    var nodeByInternalId = new Map();
    parsed.nodes.forEach(function (node) {
      nodeByInternalId.set(node.internalId, node);
    });

    var usedIds = new Set(["root"]);
    var rootChildren = parsed.roots.map(function (rootId) {
      return buildTreeNode(nodeByInternalId.get(rootId), nodeByInternalId, usedIds);
    }).filter(Boolean);

    var rootTopic = parsed.metadata && parsed.metadata.title ? String(parsed.metadata.title) : "Mind Map";
    var data = rootChildren.length === 1
      ? rootChildren[0]
      : {
          id: "root",
          topic: rootTopic,
          expanded: true,
          children: rootChildren
        };

    return {
      text: JSON.stringify({
        meta: {
          name: rootTopic,
          author: "LocalEdit",
          version: "1.0"
        },
        format: "node_tree",
        data: data
      }, null, 2),
      languageId: "jsmind-json",
      diagnostics: parsed.diagnostics || []
    };
  }

  function renderJsMind(input) {
    var mind = JSON.parse(input.text || "");
    return requireRuntime(input.context).ensureScripts(RUNTIME_PATHS.jsmind).then(function () {
      var jsMind = requireJsMind();
      return {
        kind: "custom",
        content: {
          mount: function (target) {
            ensureJsMindStyles();
            ensureShellStyles();
            var shell = document.createElement("div");
            shell.className = "jsmind-render-shell";
            var toolbar = document.createElement("div");
            toolbar.className = "jsmind-render-toolbar";
            var title = document.createElement("div");
            title.className = "jsmind-render-title";
            title.textContent = getMindTitle(mind);
            title.title = title.textContent;
            var zoomGroup = document.createElement("div");
            zoomGroup.className = "jsmind-toolbar-group";
            var zoomOutButton = createToolButton("-", "Zoom out");
            var zoomInButton = createToolButton("+", "Zoom in");
            var fitButton = createToolButton("Fit", "Fit map to view");
            var actualSizeButton = createToolButton("100%", "Show at 100% zoom");
            var centerButton = createToolButton("Center", "Center root node");
            var zoomLabel = document.createElement("span");
            zoomLabel.className = "jsmind-tool-label";
            zoomLabel.setAttribute("aria-live", "polite");
            zoomGroup.appendChild(zoomOutButton);
            zoomGroup.appendChild(zoomInButton);
            zoomGroup.appendChild(fitButton);
            zoomGroup.appendChild(actualSizeButton);
            zoomGroup.appendChild(centerButton);
            zoomGroup.appendChild(zoomLabel);

            var textGroup = document.createElement("div");
            textGroup.className = "jsmind-toolbar-group";
            var smallerTextButton = createToolButton("A-", "Decrease text size");
            var largerTextButton = createToolButton("A+", "Increase text size");
            var textLabel = document.createElement("span");
            textLabel.className = "jsmind-tool-label";
            textLabel.setAttribute("aria-live", "polite");
            textGroup.appendChild(smallerTextButton);
            textGroup.appendChild(largerTextButton);
            textGroup.appendChild(textLabel);

            var treeGroup = document.createElement("div");
            treeGroup.className = "jsmind-toolbar-group";
            var wrapButton = createToolButton("Wrap", "Collapse the tree to the first level");
            var depthButton = createToolButton("Depth 2", "Show two levels");
            var expandButton = createToolButton("All", "Expand all nodes");
            var autoLayoutButton = createToolButton("Auto", "Reapply automatic layout to visible nodes");
            treeGroup.appendChild(wrapButton);
            treeGroup.appendChild(depthButton);
            treeGroup.appendChild(expandButton);
            treeGroup.appendChild(autoLayoutButton);

            var status = document.createElement("div");
            status.className = "jsmind-render-status";
            var nodeCount = countNodes(mind.data);
            status.textContent = nodeCount + (nodeCount === 1 ? " node" : " nodes");

            toolbar.appendChild(title);
            toolbar.appendChild(zoomGroup);
            toolbar.appendChild(textGroup);
            toolbar.appendChild(treeGroup);
            toolbar.appendChild(status);

            var viewport = document.createElement("div");
            viewport.className = "jsmind-render-viewport";
            var host = document.createElement("div");
            host.className = "jsmind-map-host";
            host.id = "jsmind-" + Date.now() + "-" + Math.random().toString(36).slice(2);
            viewport.appendChild(host);
            shell.appendChild(toolbar);
            shell.appendChild(viewport);
            target.appendChild(shell);
            var textScale = clamp(finiteNumber(input.params.textScale, 1), 0.6, 1.8);
            shell.style.setProperty("--jsmind-node-scale", String(textScale));
            var instance = new jsMind({
              container: host.id,
              editable: false,
              theme: input.params.theme || "localedit",
              mode: input.params.mode,
              support_html: false,
              log_level: "error",
              view: {
                engine: "svg",
                draggable: true,
                hide_scrollbars_when_draggable: true,
                hmargin: 120,
                vmargin: 80,
                line_width: 2,
                line_color: "#78909c",
                line_style: "curved",
                node_overflow: "wrap",
                zoom: {
                  min: 0.1,
                  max: 5,
                  step: 0.15,
                  mask_key: 0
                }
              },
              layout: {
                hspace: 140,
                vspace: 56,
                pspace: 24,
                cousin_space: 24
              },
              default_event_handle: {
                enable_mousedown_handle: true,
                enable_click_handle: true,
                enable_dblclick_handle: false,
                enable_mousewheel_handle: true
              },
              shortcut: {
                enable: false
              }
            });
            instance.show(mind);
            var resizeObserver = null;
            var resizeFrame = 0;
            var lineOverlay = null;
            var manualPositions = new Map();
            var dragState = null;

            function getPanel() {
              return host.querySelector(".jsmind-inner");
            }

            function getNodeMap() {
              return instance.mind && instance.mind.nodes ? instance.mind.nodes : {};
            }

            function listNodes() {
              var nodes = getNodeMap();
              return Object.keys(nodes).map(function (id) {
                return nodes[id];
              });
            }

            function getNodeElement(node) {
              return node && node._data && node._data.view ? node._data.view.element : null;
            }

            function getExpanderElement(node) {
              return node && node._data && node._data.view ? node._data.view.expander : null;
            }

            function isVisibleNode(node) {
              var element = getNodeElement(node);
              return Boolean(element && element.style.display !== "none" && element.style.visibility !== "hidden");
            }

            function parsePixels(value) {
              var parsed = Number.parseFloat(value);
              return Number.isFinite(parsed) ? parsed : 0;
            }

            function getNodePosition(node) {
              var element = getNodeElement(node);
              if (!element) {
                return { left: 0, top: 0, width: 1, height: 1 };
              }
              return {
                left: parsePixels(element.style.left),
                top: parsePixels(element.style.top),
                width: Math.max(1, element.offsetWidth),
                height: Math.max(1, element.offsetHeight)
              };
            }

            function getVisibleBounds() {
              var bounds = null;
              listNodes().forEach(function (node) {
                if (!isVisibleNode(node)) {
                  return;
                }
                var position = getNodePosition(node);
                var right = position.left + position.width;
                var bottom = position.top + position.height;
                if (!bounds) {
                  bounds = {
                    left: position.left,
                    top: position.top,
                    right: right,
                    bottom: bottom
                  };
                  return;
                }
                bounds.left = Math.min(bounds.left, position.left);
                bounds.top = Math.min(bounds.top, position.top);
                bounds.right = Math.max(bounds.right, right);
                bounds.bottom = Math.max(bounds.bottom, bottom);
              });
              if (!bounds) {
                return { left: 0, top: 0, width: 1, height: 1 };
              }
              return {
                left: bounds.left,
                top: bounds.top,
                width: Math.max(1, bounds.right - bounds.left),
                height: Math.max(1, bounds.bottom - bounds.top)
              };
            }

            function ensureLineOverlay() {
              var panel = getPanel();
              if (!panel) {
                return null;
              }
              if (lineOverlay && lineOverlay.parentNode === panel) {
                return lineOverlay;
              }
              lineOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
              lineOverlay.setAttribute("class", "jsmind-manual-lines");
              lineOverlay.setAttribute("aria-hidden", "true");
              var nodesLayer = panel.querySelector("jmnodes");
              if (nodesLayer) {
                panel.insertBefore(lineOverlay, nodesLayer);
              } else {
                panel.appendChild(lineOverlay);
              }
              return lineOverlay;
            }

            function resizeLineOverlay() {
              var panel = getPanel();
              var overlay = ensureLineOverlay();
              if (!panel || !overlay) {
                return;
              }
              var width = Math.max(panel.scrollWidth, panel.clientWidth, instance.view && instance.view.size ? instance.view.size.w : 0);
              var height = Math.max(panel.scrollHeight, panel.clientHeight, instance.view && instance.view.size ? instance.view.size.h : 0);
              overlay.setAttribute("width", String(width));
              overlay.setAttribute("height", String(height));
              overlay.style.width = width + "px";
              overlay.style.height = height + "px";
            }

            function drawConnection(parentNode, childNode) {
              var overlay = ensureLineOverlay();
              if (!overlay || !isVisibleNode(parentNode) || !isVisibleNode(childNode)) {
                return;
              }
              var parent = getNodePosition(parentNode);
              var child = getNodePosition(childNode);
              var parentCenterX = parent.left + parent.width / 2;
              var parentCenterY = parent.top + parent.height / 2;
              var childCenterX = child.left + child.width / 2;
              var childCenterY = child.top + child.height / 2;
              var childOnRight = childCenterX >= parentCenterX;
              var edgeGap = 6;
              var startX = childOnRight ? parent.left + parent.width + edgeGap : parent.left - edgeGap;
              var endX = childOnRight ? child.left - edgeGap : child.left + child.width + edgeGap;
              var startY = parentCenterY;
              var endY = childCenterY;
              var handle = Math.max(48, Math.abs(endX - startX) * 0.42);
              var direction = childOnRight ? 1 : -1;
              var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", [
                "M", startX, startY,
                "C", startX + handle * direction, startY,
                endX - handle * direction, endY,
                endX, endY
              ].join(" "));
              path.setAttribute("fill", "none");
              path.setAttribute("stroke", "#78909c");
              path.setAttribute("stroke-width", "2");
              path.setAttribute("stroke-linecap", "round");
              overlay.appendChild(path);
            }

            function redrawLines() {
              var overlay = ensureLineOverlay();
              if (!overlay) {
                return;
              }
              resizeLineOverlay();
              while (overlay.firstChild) {
                overlay.removeChild(overlay.firstChild);
              }
              listNodes().forEach(function (node) {
                if (!node || node.isroot || !node.parent) {
                  return;
                }
                drawConnection(node.parent, node);
              });
              updateAllExpanders();
            }

            function updateExpanderPosition(node) {
              if (!node || node.isroot || !node.children || !node.children.length || !isVisibleNode(node)) {
                return;
              }
              var expander = getExpanderElement(node);
              if (!expander) {
                return;
              }
              var position = getNodePosition(node);
              var parent = node.parent ? getNodePosition(node.parent) : null;
              var onRight = !parent || position.left + position.width / 2 >= parent.left + parent.width / 2;
              expander.style.display = "";
              expander.style.visibility = "visible";
              expander.style.left = Math.round(onRight ? position.left + position.width - 16 : position.left + 4) + "px";
              expander.style.top = Math.round(position.top + position.height / 2 - 6) + "px";
            }

            function updateAllExpanders() {
              listNodes().forEach(updateExpanderPosition);
            }

            function setNodePosition(node, left, top, markManual) {
              var element = getNodeElement(node);
              if (!element) {
                return;
              }
              var nextLeft = Math.max(8, Math.round(left));
              var nextTop = Math.max(8, Math.round(top));
              element.style.left = nextLeft + "px";
              element.style.top = nextTop + "px";
              if (markManual !== false) {
                element.classList.add("is-manual-position");
              }
              if (node._data && node._data.view) {
                node._data.view.abs_x = nextLeft;
                node._data.view.abs_y = nextTop;
                node._data.view.width = element.offsetWidth;
                node._data.view.height = element.offsetHeight;
              }
              updateExpanderPosition(node);
            }

            function shiftVisibleSubtree(node, dx, dy) {
              if (!node || !isVisibleNode(node)) {
                return;
              }
              var position = getNodePosition(node);
              setNodePosition(node, position.left + dx, position.top + dy, false);
              (node.children || []).forEach(function (child) {
                shiftVisibleSubtree(child, dx, dy);
              });
            }

            function spaceVisibleSiblings(children) {
              var visibleChildren = (children || []).filter(isVisibleNode).sort(function (a, b) {
                return getNodePosition(a).top - getNodePosition(b).top;
              });
              var minGap = 18;
              var previousBottom = null;
              visibleChildren.forEach(function (child) {
                var position = getNodePosition(child);
                if (previousBottom !== null && position.top < previousBottom + minGap) {
                  var dy = previousBottom + minGap - position.top;
                  shiftVisibleSubtree(child, 0, dy);
                  position = getNodePosition(child);
                }
                previousBottom = position.top + position.height;
              });
            }

            function spaceVisibleChildren(parentNode) {
              if (!parentNode || !isVisibleNode(parentNode)) {
                return;
              }
              var visibleChildren = (parentNode.children || []).filter(isVisibleNode);
              var parent = getNodePosition(parentNode);
              var parentCenterX = parent.left + parent.width / 2;
              var childCenters = visibleChildren.map(function (child) {
                var position = getNodePosition(child);
                return position.top + position.height / 2;
              });
              var verticalSpread = childCenters.length > 1
                ? Math.max.apply(null, childCenters) - Math.min.apply(null, childCenters)
                : 0;
              var horizontalGap = clamp(24 + verticalSpread * 0.12, 28, 112);
              visibleChildren.forEach(function (child) {
                var childPosition = getNodePosition(child);
                var childCenterX = childPosition.left + childPosition.width / 2;
                if (childCenterX >= parentCenterX) {
                  var minLeft = parent.left + parent.width + horizontalGap;
                  if (childPosition.left < minLeft) {
                    shiftVisibleSubtree(child, minLeft - childPosition.left, 0);
                  }
                } else {
                  var maxRight = parent.left - horizontalGap;
                  var childRight = childPosition.left + childPosition.width;
                  if (childRight > maxRight) {
                    shiftVisibleSubtree(child, maxRight - childRight, 0);
                  }
                }
              });
              spaceVisibleSiblings(visibleChildren);
              visibleChildren.forEach(spaceVisibleChildren);
            }

            function spaceVisibleTree() {
              var root = instance.mind && instance.mind.root;
              if (root) {
                spaceVisibleChildren(root);
              }
              redrawLines();
            }

            function applyManualPositions() {
              manualPositions.forEach(function (position, nodeId) {
                var node = getNodeMap()[nodeId];
                if (node && isVisibleNode(node)) {
                  setNodePosition(node, position.left, position.top);
                }
              });
              redrawLines();
            }

            function clearVisibleManualPositions() {
              listNodes().forEach(function (node) {
                if (isVisibleNode(node)) {
                  manualPositions.delete(node.id);
                  var element = getNodeElement(node);
                  if (element) {
                    element.classList.remove("is-manual-position");
                  }
                }
              });
            }

            function getZoom() {
              return instance.view && Number.isFinite(instance.view.zoom_current) ? instance.view.zoom_current : 1;
            }

            function updateLabels() {
              zoomLabel.textContent = Math.round(getZoom() * 100) + "%";
              textLabel.textContent = Math.round(textScale * 100) + "%";
            }

            function centerRoot() {
              var root = typeof instance.get_root === "function" ? instance.get_root() : instance.mind && instance.mind.root;
              if (root && instance.view && typeof instance.view.center_node === "function") {
                instance.view.center_node(root);
              }
            }

            function centerMap() {
              var panel = getPanel();
              if (!panel || !instance.view || !instance.view.size) {
                centerRoot();
                return;
              }
              var zoom = getZoom();
              var bounds = getVisibleBounds();
              panel.scrollLeft = Math.max(0, Math.round((bounds.left + bounds.width / 2) * zoom - panel.clientWidth / 2));
              panel.scrollTop = Math.max(0, Math.round((bounds.top + bounds.height / 2) * zoom - panel.clientHeight / 2));
            }

            function captureAnchor(node) {
              var panel = getPanel();
              if (!panel || !node || !isVisibleNode(node)) {
                return null;
              }
              var position = getNodePosition(node);
              var zoom = getZoom();
              return {
                nodeId: node.id,
                zoom: zoom,
                x: (position.left + position.width / 2) * zoom - panel.scrollLeft,
                y: (position.top + position.height / 2) * zoom - panel.scrollTop
              };
            }

            function restoreAnchor(anchor) {
              var panel = getPanel();
              var node = anchor && getNodeMap()[anchor.nodeId];
              if (!panel || !node || !isVisibleNode(node)) {
                updateLabels();
                redrawLines();
                return;
              }
              if (instance.view && typeof instance.view.set_zoom === "function" && Math.abs(getZoom() - anchor.zoom) > 0.001) {
                instance.view.set_zoom(anchor.zoom);
              }
              var position = getNodePosition(node);
              panel.scrollLeft = Math.max(0, Math.round((position.left + position.width / 2) * anchor.zoom - anchor.x));
              panel.scrollTop = Math.max(0, Math.round((position.top + position.height / 2) * anchor.zoom - anchor.y));
              updateLabels();
              redrawLines();
            }

            function refreshLayoutPreservingAnchor(anchor) {
              if (resizeFrame) {
                cancelAnimationFrame(resizeFrame);
              }
              resizeFrame = requestAnimationFrame(function () {
                resizeFrame = 0;
                spaceVisibleTree();
                applyManualPositions();
                restoreAnchor(anchor);
              });
            }

            function setZoom(scale) {
              if (!instance.view || typeof instance.view.set_zoom !== "function") {
                return;
              }
              instance.view.set_zoom(clamp(scale, 0.1, 5));
              updateLabels();
              redrawLines();
            }

            function fitToView() {
              var panel = getPanel();
              if (!panel || !instance.view || !instance.view.size) {
                updateLabels();
                return;
              }
              spaceVisibleTree();
              var availableWidth = Math.max(1, panel.clientWidth - 96);
              var availableHeight = Math.max(1, panel.clientHeight - 96);
              var bounds = getVisibleBounds();
              var mapWidth = Math.max(1, bounds.width);
              var mapHeight = Math.max(1, bounds.height);
              var scale = clamp(Math.min(availableWidth / mapWidth, availableHeight / mapHeight), 0.1, 1.4);
              if (Number.isFinite(scale)) {
                instance.view.set_zoom(scale);
              }
              applyManualPositions();
              centerMap();
              updateLabels();
            }

            function runAutomaticLayout(visibleOnly, mode) {
              if (visibleOnly) {
                clearVisibleManualPositions();
              } else {
                manualPositions.clear();
                listNodes().forEach(function (node) {
                  var element = getNodeElement(node);
                  if (element) {
                    element.classList.remove("is-manual-position");
                  }
                });
              }
              if (instance.layout && typeof instance.layout.layout === "function" && instance.view && typeof instance.view.show === "function") {
                instance.layout.layout();
                instance.view.show(false);
              } else if (typeof instance.resize === "function") {
                instance.resize();
              }
              spaceVisibleTree();
              if (mode === "fit") {
                fitToView();
              } else {
                centerRoot();
                redrawLines();
                updateLabels();
              }
            }

            function refreshLayout(mode) {
              if (resizeFrame) {
                cancelAnimationFrame(resizeFrame);
              }
              resizeFrame = requestAnimationFrame(function () {
                resizeFrame = 0;
                if (typeof instance.resize === "function") {
                  instance.resize();
                }
                spaceVisibleTree();
                applyManualPositions();
                if (mode === "fit") {
                  fitToView();
                } else if (mode === "center") {
                  centerRoot();
                  redrawLines();
                  updateLabels();
                } else {
                  redrawLines();
                  updateLabels();
                }
              });
            }

            function applyInitialExpansion() {
              if (input.params.initialDepth === "all" && typeof instance.expand_all === "function") {
                instance.expand_all();
                return;
              }
              if (input.params.initialDepth === "depth2" && typeof instance.expand_to_depth === "function") {
                instance.expand_to_depth(2);
                return;
              }
              if (typeof instance.collapse_all === "function") {
                instance.collapse_all();
              }
            }

            function findNodeFromElement(element) {
              if (!element || !element.closest) {
                return null;
              }
              var nodeElement = element.closest("jmnode");
              var expanderElement = element.closest("jmexpander");
              var nodeId = nodeElement
                ? nodeElement.getAttribute("nodeid")
                : expanderElement && expanderElement.getAttribute("nodeid");
              return nodeId ? getNodeMap()[nodeId] : null;
            }

            function startNodeDrag(event) {
              if (event.target && event.target.closest && event.target.closest("jmexpander")) {
                return;
              }
              var node = findNodeFromElement(event.target);
              if (!node || !isVisibleNode(node)) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              var position = getNodePosition(node);
              dragState = {
                node: node,
                startX: event.clientX,
                startY: event.clientY,
                left: position.left,
                top: position.top,
                moved: false
              };
              global.addEventListener("mousemove", dragVisibleNode);
              global.addEventListener("mouseup", stopNodeDrag);
            }

            function dragVisibleNode(event) {
              if (!dragState) {
                return;
              }
              event.preventDefault();
              var zoom = Math.max(0.1, getZoom());
              var left = dragState.left + (event.clientX - dragState.startX) / zoom;
              var top = dragState.top + (event.clientY - dragState.startY) / zoom;
              dragState.moved = true;
              manualPositions.set(dragState.node.id, { left: Math.max(8, Math.round(left)), top: Math.max(8, Math.round(top)) });
              setNodePosition(dragState.node, left, top);
              redrawLines();
              status.textContent = nodeCount + (nodeCount === 1 ? " node" : " nodes") + " - custom layout";
            }

            function stopNodeDrag() {
              if (!dragState) {
                return;
              }
              dragState = null;
              global.removeEventListener("mousemove", dragVisibleNode);
              global.removeEventListener("mouseup", stopNodeDrag);
            }

            host.addEventListener("mousedown", startNodeDrag, true);
            host.addEventListener("click", function (event) {
              if (event.target && event.target.closest && event.target.closest("jmexpander")) {
                var node = findNodeFromElement(event.target);
                var anchor = captureAnchor(node);
                requestAnimationFrame(function () {
                  refreshLayoutPreservingAnchor(anchor);
                });
              }
            }, true);
            host.addEventListener("dblclick", function (event) {
              var node = findNodeFromElement(event.target);
              if (!node || !node.children || !node.children.length) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              var anchor = captureAnchor(node);
              if (node.isroot) {
                var hasExpandedVisibleNode = listNodes().some(function (item) {
                  return item && !item.isroot && isVisibleNode(item) && item.expanded && item.children && item.children.length;
                });
                if (hasExpandedVisibleNode && typeof instance.collapse_all === "function") {
                  instance.collapse_all();
                } else if (typeof instance.expand_to_depth === "function") {
                  instance.expand_to_depth(2);
                }
              } else if (typeof instance.toggle_node === "function") {
                instance.toggle_node(node.id);
              }
              refreshLayoutPreservingAnchor(anchor);
            }, true);

            zoomOutButton.addEventListener("click", function () {
              setZoom(getZoom() - 0.25);
            });
            zoomInButton.addEventListener("click", function () {
              setZoom(getZoom() + 0.25);
            });
            fitButton.addEventListener("click", function () {
              fitToView();
            });
            actualSizeButton.addEventListener("click", function () {
              setZoom(1);
              centerRoot();
            });
            centerButton.addEventListener("click", function () {
              centerRoot();
            });
            smallerTextButton.addEventListener("click", function () {
              textScale = clamp(textScale - 0.1, 0.6, 1.8);
              shell.style.setProperty("--jsmind-node-scale", String(textScale));
              runAutomaticLayout(false, "fit");
            });
            largerTextButton.addEventListener("click", function () {
              textScale = clamp(textScale + 0.1, 0.6, 1.8);
              shell.style.setProperty("--jsmind-node-scale", String(textScale));
              runAutomaticLayout(false, "fit");
            });
            wrapButton.addEventListener("click", function () {
              if (typeof instance.collapse_all === "function") {
                instance.collapse_all();
                runAutomaticLayout(false, "fit");
              }
            });
            depthButton.addEventListener("click", function () {
              if (typeof instance.expand_to_depth === "function") {
                instance.expand_to_depth(2);
                runAutomaticLayout(false, "fit");
              }
            });
            expandButton.addEventListener("click", function () {
              if (typeof instance.expand_all === "function") {
                instance.expand_all();
                runAutomaticLayout(false, "fit");
              }
            });
            autoLayoutButton.addEventListener("click", function () {
              runAutomaticLayout(true, "fit");
              status.textContent = nodeCount + (nodeCount === 1 ? " node" : " nodes");
            });

            if (typeof ResizeObserver === "function") {
              resizeObserver = new ResizeObserver(function () {
                refreshLayout(input.params.initialZoom === "fit" ? "fit" : "center");
              });
              resizeObserver.observe(viewport);
            }

            requestAnimationFrame(function () {
              applyInitialExpansion();
              ensureLineOverlay();
              if (input.params.initialZoom === "fit") {
                fitToView();
              } else {
                centerRoot();
                redrawLines();
                updateLabels();
              }
            });
            return function () {
              if (resizeFrame) {
                cancelAnimationFrame(resizeFrame);
              }
              if (resizeObserver) {
                resizeObserver.disconnect();
              }
              global.removeEventListener("mousemove", dragVisibleNode);
              global.removeEventListener("mouseup", stopNodeDrag);
              shell.remove();
            };
          }
        },
        mimeType: "application/x.editor-workbench.custom+jsmind"
      };
    });
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "jsmind-core",
    name: "jsMind",
    version: "0.1.0",
    description: "jsMind JSON language, Indented Tree conversion, and read-only mind-map rendering.",
    contributes: {
      languages: [
        {
          id: "jsmind-json",
          name: "jsMind JSON",
          fileExtensions: [".jm.json", ".jsmind.json"],
          mediaType: "application/vnd.jsmind+json",
          description: "jsMind node_tree JSON documents."
        }
      ],
      editors: [],
      editorExtensions: [
        {
          id: "jsmind-json-codemirror",
          name: "jsMind JSON syntax",
          editor: "codemirror",
          languages: ["jsmind-json"],
          createExtension: async function (context) {
            await requireRuntime(context).ensureScripts("plugins/json/runtime/codemirror-json.bundle.js");
            return [global.EditorWorkbenchCodeMirror.json()];
          }
        }
      ],
      transformers: [
        {
          id: "indented-tree-to-jsmind-json",
          name: "Indented Tree to jsMind JSON",
          inputLanguage: "indented-tree",
          outputLanguage: "jsmind-json",
          parameters: {},
          transform: indentedTreeToJsMind
        }
      ],
      renderers: [
        {
          id: "jsmind-renderer",
          name: "jsMind Mind Map",
          accepts: ["jsmind-json"],
          outputKind: "custom",
          parameters: {
            theme: { type: "string", default: "localedit" },
            mode: { type: "enum", values: ["full", "side"], default: "full" },
            initialZoom: { type: "enum", values: ["fit", "100"], default: "fit" },
            initialDepth: { type: "enum", values: ["collapsed", "depth2", "all"], default: "collapsed" },
            textScale: { type: "number", default: 1 }
          },
          render: renderJsMind
        }
      ],
      exporters: [],
      linters: [
        {
          id: "jsmind-json-linter",
          name: "jsMind JSON parser",
          accepts: ["jsmind-json"],
          lint: function (input) {
            try {
              var value = JSON.parse(input.text || "");
              if (!value || value.format !== "node_tree" || !value.data || !value.data.id || !value.data.topic) {
                return [{
                  source: "jsMind JSON",
                  severity: "error",
                  message: "jsMind JSON must be a node_tree document with root data.id and data.topic.",
                  languageId: input.languageId
                }];
              }
              return [];
            } catch (error) {
              return [{
                source: "jsMind JSON",
                severity: "error",
                message: error && error.message ? error.message : String(error),
                languageId: input.languageId
              }];
            }
          }
        }
      ],
      terminalSteps: [],
      pipelines: [
        {
          id: "view-indented-tree-as-mindmap",
          name: "View as Mind Map",
          inputLanguage: "indented-tree",
          steps: [
            { use: "indented-tree-to-jsmind-json", params: {} },
            { use: "jsmind-renderer", params: {} }
          ]
        }
      ]
    }
  });
})(window);
