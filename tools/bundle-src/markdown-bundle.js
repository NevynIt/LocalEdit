import { marked } from "marked";

function requireSanitizer() {
  const tools = window.EditorWorkbenchSanitize;
  if (!tools || typeof tools.sanitizeHtml !== "function" || typeof tools.escapeHtml !== "function") {
    throw new Error("Sanitizer runtime is not available.");
  }
  return tools;
}

function isMermaidFence(language) {
  return language === "mermaid" || language === "mmd";
}

function isGraphvizFence(language) {
  return language === "dot" || language === "gv" || language === "graphviz";
}

function renderFenceError(kind, error) {
  const message = error && error.message ? error.message : String(error);
  const sanitizer = requireSanitizer();
  return `<pre class="diagram-error">${sanitizer.escapeHtml(kind)} render error: ${sanitizer.escapeHtml(message)}</pre>`;
}

async function renderDiagramFence(language, source) {
  if (isMermaidFence(language)) {
    if (!window.EditorWorkbenchMermaid || typeof window.EditorWorkbenchMermaid.renderMermaidSvg !== "function") {
      throw new Error("Mermaid runtime is not available.");
    }
    const svg = await window.EditorWorkbenchMermaid.renderMermaidSvg(source);
    return `<div class="diagram diagram-mermaid">${svg}</div>`;
  }

  if (isGraphvizFence(language)) {
    if (!window.EditorWorkbenchGraphviz || typeof window.EditorWorkbenchGraphviz.renderGraphvizSvg !== "function") {
      throw new Error("Graphviz runtime is not available.");
    }
    const svg = await window.EditorWorkbenchGraphviz.renderGraphvizSvg(source);
    return `<div class="diagram diagram-graphviz">${svg}</div>`;
  }

  return undefined;
}

async function replaceDiagramFences(markdownSource) {
  const source = markdownSource || "";
  const pattern = /(^|\n)```([A-Za-z0-9_-]+)[^\n]*\n([\s\S]*?)\n```(?=\n|$)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const leadingBreak = match[1] || "";
    const language = (match[2] || "").toLowerCase();
    if (!isMermaidFence(language) && !isGraphvizFence(language)) {
      continue;
    }

    parts.push(source.slice(lastIndex, match.index));
    parts.push(leadingBreak);

    try {
      parts.push(await renderDiagramFence(language, match[3] || ""));
    } catch (error) {
      parts.push(renderFenceError(isMermaidFence(language) ? "Mermaid" : "Graphviz", error));
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex === 0) {
    return source;
  }

  parts.push(source.slice(lastIndex));
  return parts.join("");
}

async function renderMarkdown(text) {
  const markdownWithDiagrams = await replaceDiagramFences(text || "");
  return requireSanitizer().sanitizeHtml(marked.parse(markdownWithDiagrams));
}

window.EditorWorkbenchMarkdown = {
  marked,
  renderMarkdown
};
