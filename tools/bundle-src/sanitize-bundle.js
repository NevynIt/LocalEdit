import DOMPurify from "dompurify";

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

window.EditorWorkbenchSanitize = {
  DOMPurify,
  escapeHtml,
  sanitizeHtml,
  sanitizeSvg
};
