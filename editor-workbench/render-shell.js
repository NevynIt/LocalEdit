(function (global) {
  "use strict";

  var output = document.getElementById("render-output");
  var host = global.chrome && global.chrome.runtime ? new ExtensionHostAdapter() : new LocalHostAdapter();
  var registry = new PluginRegistry();
  var loader = new PluginLoader(host, registry);
  var loadedPaths = new Set();

  function setText(message) {
    output.textContent = "";
    var pre = document.createElement("pre");
    pre.textContent = message;
    output.appendChild(pre);
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

  function displayResult(result) {
    output.textContent = "";

    if (!result) {
      setText("Renderer returned no result.");
      return;
    }

    if (result.kind === "html" || result.kind === "svg") {
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
      await loadPluginPaths(message.pluginPaths);
      var documentModel = new DocumentModel(message.document);
      var renderer = registry.getRenderer(message.rendererId, documentModel.languageId);
      if (!renderer) {
        throw new Error("Renderer was not found.");
      }

      var result = await renderer.render(documentModel, {
        languageId: documentModel.languageId,
        options: message.options || {}
      });
      displayResult(result);
    } catch (error) {
      setText(error && error.message ? error.message : String(error));
    }
  });

  setText("Waiting for render input.");
})(window);

