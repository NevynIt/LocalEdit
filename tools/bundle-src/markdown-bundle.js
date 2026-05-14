import DOMPurify from "dompurify";
import { marked } from "marked";

const sanitizeOptions = {
  USE_PROFILES: { html: true },
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
    "audio",
    "video",
    "source",
    "picture",
    "track",
    "form",
    "input",
    "button"
  ],
  FORBID_ATTR: ["src", "srcset", "poster", "formaction"]
};

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, sanitizeOptions);
}

function renderMarkdown(text) {
  return sanitizeHtml(marked.parse(text || ""));
}

window.EditorWorkbenchMarkdown = {
  marked,
  DOMPurify,
  renderMarkdown,
  sanitizeHtml
};
