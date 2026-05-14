(function (global) {
  "use strict";

  var output = document.getElementById("render-output");
  var activeRenderCleanup = null;
  var host = global.chrome && global.chrome.runtime ? new ExtensionHostAdapter() : new LocalHostAdapter();
  var registry = new PluginRegistry();
  var runtime = new RuntimeLoader(host);
  var loader = new PluginLoader(host, registry);
  var loadedPaths = new Set();

  function clearOutput() {
    if (activeRenderCleanup) {
      var cleanup = activeRenderCleanup;
      activeRenderCleanup = null;
      cleanup();
    }
    output.textContent = "";
  }

  function setText(message) {
    clearOutput();
    var pre = document.createElement("pre");
    pre.textContent = message;
    output.appendChild(pre);
  }

  function createButton(label, title) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title || label;
    return button;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatZoom(scale) {
    return Math.round(scale * 100) + "%";
  }

  function displaySvgResult(result) {
    clearOutput();

    var shell = document.createElement("div");
    shell.className = "svg-panzoom-shell";

    var toolbar = document.createElement("div");
    toolbar.className = "svg-panzoom-toolbar";
    var zoomOutButton = createButton("-", "Zoom out");
    var zoomInButton = createButton("+", "Zoom in");
    var fitButton = createButton("Fit", "Fit to view");
    var actualSizeButton = createButton("100%", "Show at 100% zoom");
    var zoomLabel = document.createElement("span");
    zoomLabel.className = "svg-panzoom-zoom";
    zoomLabel.setAttribute("aria-live", "polite");
    toolbar.appendChild(zoomOutButton);
    toolbar.appendChild(zoomInButton);
    toolbar.appendChild(fitButton);
    toolbar.appendChild(actualSizeButton);
    toolbar.appendChild(zoomLabel);

    var viewport = document.createElement("div");
    viewport.className = "svg-panzoom-viewport";
    var content = document.createElement("div");
    content.className = "svg-panzoom-content";
    content.innerHTML = typeof result.content === "string" ? result.content : "";
    viewport.appendChild(content);

    shell.appendChild(toolbar);
    shell.appendChild(viewport);
    output.appendChild(shell);

    var state = {
      scale: 1,
      x: 0,
      y: 0,
      naturalWidth: 1,
      naturalHeight: 1,
      boundsX: 0,
      boundsY: 0,
      dragging: false,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0
    };

    function applyTransform() {
      content.style.transform = "translate(" + state.x + "px, " + state.y + "px) scale(" + state.scale + ") translate(" + -state.boundsX + "px, " + -state.boundsY + "px)";
      zoomLabel.textContent = formatZoom(state.scale);
    }

    function isValidBounds(bounds) {
      return bounds
        && Number.isFinite(bounds.width)
        && bounds.width > 0
        && Number.isFinite(bounds.height)
        && bounds.height > 0;
    }

    function getSvgBounds() {
      var svg = content.querySelector("svg");
      if (!svg) {
        return { x: 0, y: 0, width: 1, height: 1 };
      }

      try {
        var box = svg.getBBox();
        if (isValidBounds(box)) {
          return {
            x: Number.isFinite(box.x) ? box.x : 0,
            y: Number.isFinite(box.y) ? box.y : 0,
            width: box.width,
            height: box.height
          };
        }
      } catch (error) {
        // Fall back to declared SVG bounds below.
      }

      var viewBox = svg.viewBox && svg.viewBox.baseVal;
      if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
        return { x: viewBox.x || 0, y: viewBox.y || 0, width: viewBox.width, height: viewBox.height };
      }

      var width = Number.parseFloat(svg.getAttribute("width"));
      var height = Number.parseFloat(svg.getAttribute("height"));
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return { x: 0, y: 0, width: width, height: height };
      }

      return { x: 0, y: 0, width: 1, height: 1 };
    }

    function fitToView() {
      var rect = viewport.getBoundingClientRect();
      var padding = 24;
      var availableWidth = Math.max(1, rect.width - padding * 2);
      var availableHeight = Math.max(1, rect.height - padding * 2);
      state.scale = clamp(Math.min(availableWidth / state.naturalWidth, availableHeight / state.naturalHeight), 0.05, 8);
      state.x = Math.round((rect.width - state.naturalWidth * state.scale) / 2);
      state.y = Math.round((rect.height - state.naturalHeight * state.scale) / 2);
      applyTransform();
    }

    function setZoom(nextScale, anchorClientX, anchorClientY) {
      var rect = viewport.getBoundingClientRect();
      var anchorX = typeof anchorClientX === "number" ? anchorClientX - rect.left : rect.width / 2;
      var anchorY = typeof anchorClientY === "number" ? anchorClientY - rect.top : rect.height / 2;
      var contentX = (anchorX - state.x) / state.scale;
      var contentY = (anchorY - state.y) / state.scale;
      state.scale = clamp(nextScale, 0.05, 8);
      state.x = anchorX - contentX * state.scale;
      state.y = anchorY - contentY * state.scale;
      applyTransform();
    }

    function zoomBy(multiplier, anchorClientX, anchorClientY) {
      setZoom(state.scale * multiplier, anchorClientX, anchorClientY);
    }

    function showActualSize() {
      var rect = viewport.getBoundingClientRect();
      state.scale = 1;
      state.x = Math.round((rect.width - state.naturalWidth) / 2);
      state.y = Math.round((rect.height - state.naturalHeight) / 2);
      applyTransform();
    }

    zoomOutButton.addEventListener("click", function () {
      zoomBy(0.8);
    });
    zoomInButton.addEventListener("click", function () {
      zoomBy(1.25);
    });
    fitButton.addEventListener("click", function () {
      fitToView();
    });
    actualSizeButton.addEventListener("click", function () {
      showActualSize();
    });

    viewport.addEventListener("wheel", function (event) {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.1 : 0.9, event.clientX, event.clientY);
    }, { passive: false });

    viewport.addEventListener("mousedown", function (event) {
      if (event.button !== 0) {
        return;
      }
      state.dragging = true;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.originX = state.x;
      state.originY = state.y;
      viewport.classList.add("is-dragging");
    });

    global.addEventListener("mousemove", function (event) {
      if (!state.dragging) {
        return;
      }
      state.x = state.originX + event.clientX - state.startX;
      state.y = state.originY + event.clientY - state.startY;
      applyTransform();
    });

    global.addEventListener("mouseup", function () {
      state.dragging = false;
      viewport.classList.remove("is-dragging");
    });

    requestAnimationFrame(function () {
      var bounds = getSvgBounds();
      state.boundsX = bounds.x;
      state.boundsY = bounds.y;
      state.naturalWidth = bounds.width;
      state.naturalHeight = bounds.height;
      fitToView();
    });
  }

  function displayCustomResult(result) {
    if (!result.content || typeof result.content.mount !== "function") {
      throw new Error("Custom renderer returned invalid content.");
    }

    clearOutput();
    var cleanup = result.content.mount(output);
    if (typeof cleanup === "function") {
      activeRenderCleanup = cleanup;
    }
  }

  async function loadPluginPaths(paths) {
    var pluginPaths = Array.isArray(paths) ? paths : [];
    for (var index = 0; index < pluginPaths.length; index += 1) {
      var path = pluginPaths[index];
      if (!loadedPaths.has(path)) {
        var result = await loader.load(path);
        loadedPaths.add(path);
        if (result.status !== "loaded") {
          throw new Error(result.error || "Plugin load failed.");
        }
      }
    }
  }

  async function loadPluginSpecs(specs, fallbackPaths) {
    if (!Array.isArray(specs)) {
      await loadPluginPaths(fallbackPaths);
      return;
    }

    for (var index = 0; index < specs.length; index += 1) {
      var spec = specs[index];
      if (spec.sourceType === "uploaded") {
        var sourceKey = "uploaded:" + spec.fileName + ":" + spec.sourceText.length;
        if (!loadedPaths.has(sourceKey)) {
          var sourceResult = await loader.loadSource(spec.fileName, spec.sourceText);
          loadedPaths.add(sourceKey);
          if (sourceResult.status !== "loaded") {
            throw new Error(sourceResult.error || "Uploaded plugin load failed.");
          }
        }
      } else if (spec.path && !loadedPaths.has(spec.path)) {
        var result = await loader.load(spec.path);
        loadedPaths.add(spec.path);
        if (result.status !== "loaded") {
          throw new Error(result.error || "Plugin load failed.");
        }
      }
    }
  }

  function displayResult(result) {
    if (!result) {
      setText("Renderer returned no result.");
      return;
    }

    if (result.kind === "svg") {
      displaySvgResult(result);
      return;
    }

    if (result.kind === "html") {
      clearOutput();
      var wrapper = document.createElement("div");
      wrapper.innerHTML = typeof result.content === "string" ? result.content : "";
      output.appendChild(wrapper);
      return;
    }

    if (result.kind === "image") {
      clearOutput();
      var image = document.createElement("img");
      image.alt = "Rendered output";
      if (result.content instanceof Blob) {
        image.src = global.URL.createObjectURL(result.content);
      } else {
        image.src = result.content;
      }
      output.appendChild(image);
      return;
    }

    if (result.kind === "custom") {
      displayCustomResult(result);
      return;
    }

    clearOutput();
    var pre = document.createElement("pre");
    pre.textContent = typeof result.content === "string" ? result.content : String(result.content);
    output.appendChild(pre);
  }

  global.addEventListener("beforeunload", function () {
    clearOutput();
  });

  global.addEventListener("message", async function (event) {
    var message = event.data;
    if (!message || message.type !== "render") {
      return;
    }

    try {
      setText("Rendering...");
      await loadPluginSpecs(message.pluginLoadSpecs, message.pluginPaths);
      var documentModel = new DocumentModel(message.document);
      var renderer = registry.getRenderer(message.rendererId, documentModel.languageId);
      if (!renderer) {
        throw new Error("Renderer was not found.");
      }

      var result = await renderer.render(documentModel, {
        languageId: documentModel.languageId,
        options: message.options || {},
        runtime: runtime
      });
      displayResult(result);
    } catch (error) {
      setText(error && error.message ? error.message : String(error));
    }
  });

  setText("Waiting for render input.");
})(window);
