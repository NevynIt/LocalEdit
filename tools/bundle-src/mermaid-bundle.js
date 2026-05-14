import mermaid from "mermaid";

let renderCounter = 0;
let initialized = false;

function requireSanitizer() {
  const tools = window.EditorWorkbenchMarkdown;
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
    securityLevel: "strict"
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

window.EditorWorkbenchMermaid = {
  mermaid,
  renderMermaidSvg
};
