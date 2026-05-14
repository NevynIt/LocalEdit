(function (global) {
  "use strict";

  var output = document.getElementById("render-output");
  var host = global.chrome && global.chrome.runtime ? new ExtensionHostAdapter() : new LocalHostAdapter();
  var registry = new PluginRegistry();
  var runtime = new RuntimeLoader(host);
  var loader = new PluginLoader(host, registry);
  var loadedPaths = new Set();

  function setText(message) {
    output.textContent = "";
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

  function displaySvgResult(result) {
    output.textContent = "";

    var shell = document.createElement("div");
    shell.className = "svg-panzoom-shell";

    var toolbar = document.createElement("div");
    toolbar.className = "svg-panzoom-toolbar";
    var zoomOutButton = createButton("-", "Zoom out");
    var zoomInButton = createButton("+", "Zoom in");
    var resetButton = createButton("Reset", "Reset pan and zoom");
    toolbar.appendChild(zoomOutButton);
    toolbar.appendChild(zoomInButton);
    toolbar.appendChild(resetButton);

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
      dragging: false,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0
    };

    function applyTransform() {
      content.style.transform = "translate(" + state.x + "px, " + state.y + "px) scale(" + state.scale + ")";
    }

    function zoomBy(multiplier) {
      state.scale = clamp(state.scale * multiplier, 0.1, 8);
      applyTransform();
    }

    zoomOutButton.addEventListener("click", function () {
      zoomBy(0.8);
    });
    zoomInButton.addEventListener("click", function () {
      zoomBy(1.25);
    });
    resetButton.addEventListener("click", function () {
      state.scale = 1;
      state.x = 0;
      state.y = 0;
      applyTransform();
    });

    viewport.addEventListener("wheel", function (event) {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.1 : 0.9);
    }, { passive: false });

    viewport.addEventListener("mousedown", function (event) {
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

    applyTransform();
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
    output.textContent = "";

    if (!result) {
      setText("Renderer returned no result.");
      return;
    }

    if (result.kind === "svg") {
      displaySvgResult(result);
      return;
    }

    if (result.kind === "html") {
      var wrapper = document.createElement("div");
      wrapper.innerHTML = typeof result.content === "string" ? result.content : "";
      output.appendChild(wrapper);
      return;
    }

    if (result.kind === "image") {
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

    var pre = document.createElement("pre");
    pre.textContent = typeof result.content === "string" ? result.content : String(result.content);
    output.appendChild(pre);
  }

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
