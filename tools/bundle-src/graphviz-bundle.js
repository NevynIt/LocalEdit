import { instance, engines, formats, graphvizVersion } from "@viz-js/viz";

let vizPromise;

function requireSanitizer() {
  const tools = window.EditorWorkbenchMarkdown;
  if (!tools || typeof tools.sanitizeSvg !== "function") {
    throw new Error("SVG sanitizer is not available.");
  }
  return tools;
}

function getViz() {
  if (!vizPromise) {
    vizPromise = instance();
  }
  return vizPromise;
}

function formatErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return "Graphviz render failed.";
  }

  return errors.map((error) => error.message || String(error)).join("\n");
}

async function renderGraphvizSvg(source) {
  const viz = await getViz();
  const result = viz.render(source || "", {
    format: "svg",
    engine: "dot"
  });

  if (!result || result.status !== "success") {
    throw new Error(formatErrors(result && result.errors));
  }

  return requireSanitizer().sanitizeSvg(result.output || "");
}

window.EditorWorkbenchGraphviz = {
  engines,
  formats,
  graphvizVersion,
  getViz,
  renderGraphvizSvg
};
