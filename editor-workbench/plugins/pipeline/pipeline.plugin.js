(function (global) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parsePipeline(text) {
    var value = JSON.parse(text || "");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Pipeline document must be a JSON object.");
    }
    return value;
  }

  function lintPipeline(input) {
    try {
      var pipeline = parsePipeline(input.text);
      var registry = input.context && input.context.registry;
      if (!registry || !global.PipelineRegistry) {
        return [];
      }
      var validator = new global.PipelineRegistry(registry);
      validator.validate(pipeline);
      return [];
    } catch (error) {
      return [{
        source: "Pipeline JSON",
        severity: "error",
        message: error && error.message ? error.message : String(error),
        languageId: input.languageId
      }];
    }
  }

  function renderPipeline(input) {
    var pipeline = parsePipeline(input.text);
    var steps = Array.isArray(pipeline.steps) ? pipeline.steps : [];
    var rows = [
      "<style>",
      ".pipeline-flow { display: grid; gap: 10px; max-width: 760px; }",
      ".pipeline-flow h1 { margin: 0; font-size: 18px; }",
      ".pipeline-step { display: grid; gap: 4px; border: 1px solid var(--border, #cbd3df); border-radius: 6px; padding: 10px; background: #fff; }",
      ".pipeline-language { color: var(--muted, #5d6b7c); font-size: 12px; font-weight: 700; text-transform: uppercase; }",
      ".pipeline-arrow { color: var(--muted, #5d6b7c); font-size: 18px; padding-left: 14px; }",
      "code { font-family: Consolas, 'Courier New', monospace; }",
      "</style>",
      "<section class=\"pipeline-flow\">",
      "<h1>" + escapeHtml(pipeline.name || pipeline.id || "Pipeline") + "</h1>",
      "<div class=\"pipeline-language\">Input: " + escapeHtml(pipeline.inputLanguage || "") + "</div>"
    ];

    steps.forEach(function (step, index) {
      rows.push("<div class=\"pipeline-arrow\">down</div>");
      rows.push([
        "<article class=\"pipeline-step\">",
        "<strong>Step " + (index + 1) + "</strong>",
        "<code>" + escapeHtml(step && step.use || "") + "</code>",
        step && step.params && Object.keys(step.params).length
          ? "<pre>" + escapeHtml(JSON.stringify(step.params, null, 2)) + "</pre>"
          : "",
        "</article>"
      ].join(""));
    });
    rows.push("</section>");
    return {
      kind: "html",
      content: rows.join("\n"),
      mimeType: "text/html"
    };
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "pipeline-core",
    name: "Pipeline JSON",
    version: "0.1.0",
    description: "Pipeline JSON language, validation, and visualization.",
    getExampleDocument: function () {
      return {
        fileName: "view-indented-tree-as-mindmap.pipeline.json",
        languageId: "localedit.pipeline-json",
        mimeType: "application/vnd.localedit.pipeline+json",
        text: JSON.stringify({
          id: "view-indented-tree-as-mindmap-copy",
          name: "View as Mind Map",
          inputLanguage: "text.indented-tree",
          steps: [
            { use: "indented-tree-to-jsmind-json", params: {} },
            { use: "jsmind-renderer", params: {} }
          ]
        }, null, 2)
      };
    },
    contributes: {
      languages: [
        {
          id: "localedit.pipeline-json",
          name: "LocalEdit Pipeline JSON",
          parentLanguageId: "text.json",
          aliases: ["localedit-pipeline-json"],
          fileExtensions: [".pipeline.json"],
          mediaType: "application/vnd.localedit.pipeline+json",
          description: "Data-only LocalEdit pipeline definitions."
        }
      ],
      editors: [],
      editorExtensions: [
        {
          id: "pipeline-json-codemirror",
          name: "Pipeline JSON syntax",
          editor: "codemirror",
          languages: ["localedit.pipeline-json"],
          createExtension: async function (context) {
            if (!context || !context.runtime) {
              throw new Error("Runtime loader is not available.");
            }
            await context.runtime.ensureScripts("plugins/json/runtime/codemirror-json.bundle.js");
            return [global.EditorWorkbenchCodeMirror.json()];
          }
        }
      ],
      transformers: [],
      renderers: [
        {
          id: "pipeline-flow-renderer",
          name: "Pipeline Flow",
          accepts: ["localedit.pipeline-json"],
          outputKind: "html",
          parameters: {},
          render: renderPipeline
        }
      ],
      exporters: [],
      linters: [
        {
          id: "pipeline-json-linter",
          name: "Pipeline JSON validator",
          accepts: ["localedit.pipeline-json"],
          lint: lintPipeline
        }
      ],
      pipelines: []
    }
  });
})(window);
