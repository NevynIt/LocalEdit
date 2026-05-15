import mermaid from "mermaid";
import cytoscape from "cytoscape";

let renderCounter = 0;
let initialized = false;

function requireSanitizer() {
  const tools = window.EditorWorkbenchSanitize;
  if (!tools || typeof tools.sanitizeSvg !== "function") {
    throw new Error("SVG sanitizer is not available.");
  }
  return tools;
}

function initialize() {
  if (initialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: {
      htmlLabels: false,
      useMaxWidth: false
    }
  });
  initialized = true;
}

async function renderMermaidSvg(source) {
  initialize();
  const id = `editor-workbench-mermaid-${Date.now()}-${renderCounter}`;
  renderCounter += 1;
  const result = await mermaid.render(id, source || "");
  return requireSanitizer().sanitizeSvg(result.svg || "");
}

function getCytoscape() {
  return cytoscape;
}

window.EditorWorkbenchCytoscapeRuntime = {
  cytoscape: getCytoscape(),
  getCytoscape
};

window.EditorWorkbenchMermaid = {
  mermaid,
  cytoscape: getCytoscape(),
  getCytoscape,
  renderMermaidSvg
};
