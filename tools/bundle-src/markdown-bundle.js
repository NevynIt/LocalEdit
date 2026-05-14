import DOMPurify from "dompurify";
import { marked } from "marked";

const sanitizeOptions = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "base",
    "img",
    "image",
    "audio",
    "video",
    "source",
    "picture",
    "track",
    "form",
    "input",
    "button",
    "foreignObject",
    "animate",
    "animateMotion",
    "animateTransform",
    "set"
  ],
  FORBID_ATTR: ["href", "xlink:href", "src", "srcset", "poster", "formaction", "style"]
};

const svgSanitizeOptions = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: [
    "script",
    "style",
    "foreignObject",
    "image",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "base",
    "audio",
    "video",
    "source",
    "picture",
    "track",
    "form",
    "input",
    "button",
    "animate",
    "animateMotion",
    "animateTransform",
    "set"
  ],
  FORBID_ATTR: ["href", "xlink:href", "src", "srcset", "poster", "formaction", "style"]
};

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (!node || !node.attributes) {
    return;
  }

  Array.from(node.attributes).forEach((attribute) => {
    const value = attribute.value || "";
    if (/(?:javascript:|vbscript:|data:|file:|https?:)/i.test(value)) {
      node.removeAttribute(attribute.name);
      return;
    }

    if (/url\s*\(\s*['"]?(?!#)/i.test(value)) {
      node.removeAttribute(attribute.name);
    }
  });
});

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, sanitizeOptions);
}

function sanitizeSvg(svg) {
  return DOMPurify.sanitize(svg || "", svgSanitizeOptions);
}

function isMermaidFence(language) {
  return language === "mermaid" || language === "mmd";
}

function isGraphvizFence(language) {
  return language === "dot" || language === "gv" || language === "graphviz";
}

function renderFenceError(kind, error) {
  const message = error && error.message ? error.message : String(error);
  return `<pre class="diagram-error">${escapeHtml(kind)} render error: ${escapeHtml(message)}</pre>`;
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
  return sanitizeHtml(marked.parse(markdownWithDiagrams));
}

window.EditorWorkbenchMarkdown = {
  marked,
  DOMPurify,
  escapeHtml,
  renderMarkdown,
  sanitizeHtml,
  sanitizeSvg
};
