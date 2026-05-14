import DOMPurify from "dompurify";

const sanitizeOptions = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: [
    "script",
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

const allowedAttributeUrls = new Set();

function registerAllowedAttributeUrls(urls) {
  if (!Array.isArray(urls)) {
    return;
  }

  urls.forEach((url) => {
    if (typeof url === "string" && url) {
      allowedAttributeUrls.add(url);
    }
  });
}

function isAllowedAttributeUrl(value) {
  return allowedAttributeUrls.has(value);
}

registerAllowedAttributeUrls(window.EditorWorkbenchSanitizeAllowedAttributeUrls);

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (!node || !node.attributes) {
    return;
  }

  Array.from(node.attributes).forEach((attribute) => {
    const value = attribute.value || "";
    if (isAllowedAttributeUrl(value)) {
      return;
    }

    if (/(?:javascript:|vbscript:|data:|file:|https?:)/i.test(value)) {
      node.removeAttribute(attribute.name);
      return;
    }

    if (/url\s*\(\s*['"]?(?!#)/i.test(value)) {
      node.removeAttribute(attribute.name);
    }
  });
});

function hasUnsafeCss(css) {
  const value = String(css || "");
  return (
    /@import/i.test(value) ||
    /(?:javascript:|vbscript:|data:|file:|https?:)/i.test(value) ||
    /url\s*\(\s*['"]?(?!#)/i.test(value)
  );
}

function removeUnsafeStyleElements(root) {
  if (!root || !root.querySelectorAll) {
    return;
  }

  Array.from(root.querySelectorAll("style")).forEach((styleNode) => {
    if (!styleNode.closest("svg") || hasUnsafeCss(styleNode.textContent || "")) {
      styleNode.remove();
    }
  });
}

function cleanHtmlStyles(html) {
  const documentModel = new DOMParser().parseFromString(String(html || ""), "text/html");
  removeUnsafeStyleElements(documentModel.body);
  return documentModel.body.innerHTML;
}

function cleanSvgStyles(svg) {
  const documentModel = new DOMParser().parseFromString(String(svg || ""), "image/svg+xml");
  const parserError = documentModel.querySelector("parsererror");
  if (parserError || !documentModel.documentElement) {
    return svg || "";
  }
  removeUnsafeStyleElements(documentModel);
  return new XMLSerializer().serializeToString(documentModel.documentElement);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHtml(html) {
  return cleanHtmlStyles(DOMPurify.sanitize(html, sanitizeOptions));
}

function sanitizeSvg(svg) {
  return cleanSvgStyles(DOMPurify.sanitize(svg || "", svgSanitizeOptions));
}

window.EditorWorkbenchSanitize = {
  DOMPurify,
  escapeHtml,
  registerAllowedAttributeUrls,
  sanitizeHtml,
  sanitizeSvg
};
