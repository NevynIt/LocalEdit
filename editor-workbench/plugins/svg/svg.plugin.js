(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    sanitize: "plugins/shared/sanitize/sanitize.bundle.js",
    codeMirror: "plugins/svg/runtime/codemirror-html.bundle.js"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireSanitizerTools() {
    if (!global.EditorWorkbenchSanitize || typeof global.EditorWorkbenchSanitize.sanitizeSvg !== "function") {
      throw new Error("SVG sanitizer is not loaded.");
    }
    return global.EditorWorkbenchSanitize;
  }

  function requireCodeMirrorTools() {
    if (!global.EditorWorkbenchCodeMirror || !global.EditorWorkbenchCodeMirror.html) {
      throw new Error("CodeMirror HTML runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCodeMirror;
  }

  function svgFileName(sourceName) {
    var baseName = sourceName || "untitled.svg";
    return baseName.replace(/\.[^.]+$/, "") + ".svg";
  }

  function pngFileName(sourceName) {
    var baseName = sourceName || "untitled.svg";
    return baseName.replace(/\.[^.]+$/, "") + ".png";
  }

  async function sanitizeSvg(documentModel, context) {
    await requireRuntime(context).ensureScripts(RUNTIME_PATHS.sanitize);
    return requireSanitizerTools().sanitizeSvg(documentModel.text || "");
  }

  function parseNumber(value) {
    var match = /^([0-9]+(?:\.[0-9]+)?)/.exec(String(value || "").trim());
    return match ? Number(match[1]) : 0;
  }

  function parseSvgDocument(svgText) {
    var parsed = new DOMParser().parseFromString(svgText || "", "image/svg+xml");
    var parserError = parsed.getElementsByTagName("parsererror")[0];
    if (parserError) {
      throw new Error("Unable to parse sanitized SVG for PNG export.");
    }
    if (!parsed.documentElement || parsed.documentElement.nodeName.toLowerCase() !== "svg") {
      throw new Error("PNG export requires an SVG root element.");
    }
    return parsed;
  }

  function svgDimensions(svgElement) {
    var width = parseNumber(svgElement.getAttribute("width"));
    var height = parseNumber(svgElement.getAttribute("height"));
    var viewBox = (svgElement.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);

    if ((!width || !height) && viewBox.length === 4 && viewBox.every(Number.isFinite)) {
      width = width || Math.abs(viewBox[2]);
      height = height || Math.abs(viewBox[3]);
    }

    width = width || 1024;
    height = height || 768;

    var maxSide = Math.max(width, height);
    if (maxSide > 4096) {
      var scale = 4096 / maxSide;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height))
    };
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Unable to create PNG blob."));
        }
      }, "image/png");
    });
  }

  async function svgToPngBlob(svgText) {
    var parsed = parseSvgDocument(svgText);
    var svg = parsed.documentElement;
    var dimensions = svgDimensions(svg);
    svg.setAttribute("xmlns", "http" + "://www.w3.org/2000/svg");
    svg.setAttribute("width", String(dimensions.width));
    svg.setAttribute("height", String(dimensions.height));

    var rasterSource = new XMLSerializer().serializeToString(svg);
    var url = URL.createObjectURL(new Blob([rasterSource], { type: "image/svg+xml" }));
    try {
      var image = new Image();
      var loaded = new Promise(function (resolve, reject) {
        image.onload = resolve;
        image.onerror = function () {
          reject(new Error("Unable to rasterize SVG."));
        };
      });
      image.src = url;
      await loaded;

      var canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      var context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas is not available for PNG export.");
      }
      context.clearRect(0, 0, dimensions.width, dimensions.height);
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      return canvasToBlob(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "svg-core",
    name: "SVG",
    version: "0.1.0",
    description: "SVG language support with sanitized preview and export.",
    languages: ["svg"],
    languageDefinitions: [
      {
        id: "svg",
        label: "SVG",
        extensions: ["svg"],
        mimeTypes: ["image/svg+xml"]
      }
    ],
    highlighters: [
      {
        id: "svg-codemirror",
        name: "SVG syntax",
        languages: ["svg"],
        getCodeMirrorExtensions: async function (context) {
          await requireRuntime(context).ensureScripts(RUNTIME_PATHS.codeMirror);
          return [requireCodeMirrorTools().html({ selfClosingTags: true })];
        }
      }
    ],
    linters: [],
    transformers: [],
    renderers: [
      {
        id: "svg-preview",
        name: "SVG Preview",
        inputLanguages: ["svg"],
        outputKind: "svg",
        render: async function (documentModel, context) {
          return {
            kind: "svg",
            content: await sanitizeSvg(documentModel, context),
            mimeType: "image/svg+xml"
          };
        }
      }
    ],
    exporters: [
      {
        id: "svg-sanitized-export",
        name: "Sanitized SVG",
        languages: ["svg"],
        inputKinds: ["source"],
        outputFileExtension: "svg",
        mimeType: "image/svg+xml",
        export: async function (input, context) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "", fileName: "untitled.svg" };
          return {
            fileName: svgFileName(sourceDocument.fileName),
            mimeType: "image/svg+xml",
            content: await sanitizeSvg(sourceDocument, context)
          };
        }
      },
      {
        id: "svg-png-export",
        name: "SVG PNG",
        languages: ["svg"],
        inputKinds: ["source"],
        outputFileExtension: "png",
        mimeType: "image/png",
        export: async function (input, context) {
          var sourceDocument = input && input.sourceDocument ? input.sourceDocument : { text: "", fileName: "untitled.svg" };
          var sanitized = await sanitizeSvg(sourceDocument, context);
          return {
            fileName: pngFileName(sourceDocument.fileName),
            mimeType: "image/png",
            content: await svgToPngBlob(sanitized)
          };
        }
      }
    ]
  });
})(window);
