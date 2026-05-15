# Editor Workbench

Editor Workbench is a local-first structured text editor that runs from disk or as an unpacked Chrome/Edge extension. It has no backend and no runtime network dependency. Runtime libraries are vendored as local bundles and loaded lazily by plugins.

## Features

- CodeMirror editor contribution with local syntax-highlighting bundles and textarea fallback editor contribution.
- Multi-document workspace with tabbed document instances, duplicate-name disambiguation, active-document switching, close fallback behavior, session-only reopen for hidden closed tabs, tab-driven rename, and an intentionally empty startup workspace until a document is opened or created.
- Workspace-scoped IndexedDB persistence for open documents, active tab, selected languages, file open, and source download.
- Plugin manager with packaged plugins and local `.js` plugin upload in local mode.
- Canonical language hierarchy with inherited tool matching, alias compatibility, and hierarchical language labels.
- Diagnostics panel, a single pipeline menu, preview/render windows with document-aware titles and metadata, manual refresh, and 3-second stable-source auto-refresh.
- Document-scoped diagnostics and document-bound preview windows with source metadata chrome.
- Pipeline-backed transform, render, export, editor, clipboard, and document actions, with automatic single-step pipeline entries for registered transformers, renderers, and exporters.
- Text-producing pipeline results always open as new documents, and pipeline runs can optionally open intermediate transformer steps as additional documents.
- Pipeline JSON documents for defining and running custom data-only pipelines.
- Markdown preview/export with sanitized HTML and inline Mermaid/Graphviz fenced diagrams.
- Mermaid and Graphviz standalone SVG preview/export.
- SVG preview/export, sanitized SVG-to-PNG export, and pan/zoom for standalone SVG previews.
- JSON and XML linting, tree previews, prettify, and compact transforms.
- Indented Tree parsing, linting, outline preview, Cytoscape preview, and JSON/Cytoscape export.
- Read-only jsMind rendering from Indented Tree through a local pinned jsMind bundle.
- Cytoscape JSON linting, graph preview, formatting, and compacting.
- JavaScript formatting through local Prettier.
- CSV row-width linting and scrollable table preview.
- Python formatting through local Ruff WASM.

## Modes

| Mode | Entry point | File operations | Custom plugin upload |
| --- | --- | --- | --- |
| Local file mode | `editor-workbench/index.html` | Open and download | Yes |
| Extension mode | `editor-workbench/editor.html` | Open and download | No |

## Getting Started

Local mode:

1. Open `editor-workbench/index.html` directly in a browser.
2. Use `New` to create a blank document or `Open` to load a local text file.
3. You can also drag a local file onto the `Open` button.
4. Use `Save` or plugin exporters to download output.

Extension mode:

1. Open Edge or Chrome extension management.
2. Enable developer mode.
3. Load `editor-workbench/` as an unpacked extension.
4. Click the extension action to open `editor.html`.

## Workspace Model

- Each opened file becomes a new workspace document instance, even when the same local file is opened multiple times.
- The editor mounts a single active editing surface and switches it between open tabs.
- Tabs are disambiguated by display name such as `notes.md`, `notes.md (2)`, and `notes.md (3)`.
- Double-click a tab name to rename the document file label.
- Diagnostics, autosave state, and preview bindings are tracked per document instance.
- Closing a tab hides that document for the rest of the current session and makes it available through the `Reopen` control.
- The `Reopen` list shows the most recently closed documents first and includes the time each document was closed.
- Hidden closed tabs are not persisted and are lost when the page reloads.
- Opening a real file into a workspace that only contains the initial blank untitled tab automatically removes that disposable blank tab.
- The app can also start with no open documents at all; document-specific actions stay disabled until a file is opened or a new document is created.
- Closing a tab closes any preview windows bound to that document instance.
- Active document text is restored into the editor on reload, and persistence now flushes the current editor contents before workspace storage writes and during page unload.

## Pipeline UX

- The toolbar exposes one pipeline surface instead of separate transform, render, export, and pipeline menus.
- Registered transformers, renderers, and exporters are surfaced automatically as synthetic single-step pipeline actions for the current language.
- User-defined and packaged multi-step pipelines appear in the same list.
- Preview refresh and auto-refresh continue to operate on preview windows bound to the active document.
- Render windows show the bound document name in the window title, display the last update timestamp in the render chrome, and can request a targeted refresh from inside the render window.
- The optional `Steps` toggle opens intermediate transformer outputs as separate documents so pipeline execution can be inspected step by step.

## Language Model

Languages are inheritance-aware. LocalEdit treats plain text as `text.plain`, which inherits from the root `text` language. Parent contributions automatically apply to descendant languages, so generic tools for `json`, `xml`, or `text` remain available to specialized dialects.

Current packaged canonical ids that changed during this rollout include:

- `text.plain` with alias compatibility for `plain-text`
- `graphviz.dot` with alias compatibility for `graphviz`
- `xml.svg` with alias compatibility for `svg`
- `json.cytoscape` with alias compatibility for `cytoscape`

## Build And Verification

Requires Node.js and npm for development-time vendoring only.

```powershell
npm install
npm run build:libs
npm run verify:syntax
npm run verify:contracts
```

`npm run build:libs` creates:

- `editor-workbench/libs/codemirror/editor.bundle.js` for the shared editor runtime.
- `editor-workbench/plugins/shared/sanitize/sanitize.bundle.js` for shared sanitization.
- Plugin-owned runtime bundles under `editor-workbench/plugins/**/runtime/`.

The app does not load from npm, a CDN, or a server at runtime.

`npm run verify:contracts` checks packaged plugin registration, inheritance-aware language lookup, parameter defaults, canonical diagnostic normalization, document-scoped diagnostics isolation, workspace bookkeeping, and pipeline execution metadata including intermediate results.

## Packaged Plugins

| Plugin | Language IDs | Main capabilities |
| --- | --- | --- |
| Markdown | `markdown` | Syntax, sanitized HTML preview/export, Mermaid/Graphviz fenced diagrams |
| Mermaid | `mermaid` | SVG preview/export |
| Graphviz | `graphviz.dot` | DOT syntax, local WASM SVG preview/export |
| SVG | `xml.svg` | SVG syntax, sanitized SVG preview/export, PNG export |
| JSON | `json` | Syntax, parse linting, HTML tree preview, Cytoscape tree preview, format, compact |
| Cytoscape JSON | `json.cytoscape` | JSON syntax, graph-shape linting, Cytoscape preview, format, compact |
| Indented Tree | `indented-tree` | Syntax, parser linting, outline preview, Cytoscape preview, JSON/Cytoscape export |
| XML | `xml` | Syntax, DOMParser linting, tree preview, Prettier format, compact |
| JavaScript | `javascript` | Syntax, Prettier format |
| CSV | `csv` | Row-width linting, scrollable table preview |
| Python | `python` | Syntax, Ruff WASM format |
| Pipeline JSON | `localedit-pipeline-json` | Pipeline document linting, flow preview, and registration |
| jsMind | `jsmind-json` | Indented Tree to jsMind JSON transform and read-only mind-map preview |

## Plugin Runtime Model

Plugins are classic JavaScript files that register on `window.EditorPlugins`. The public plugin API is intentionally breaking as of the Big Refactor: plugins must expose a `contributes` object. Legacy top-level provider arrays are no longer a supported plugin interface for third-party plugins.

Supported contribution collections:

- `contributes.languages`
- `contributes.editors`
- `contributes.editorExtensions`
- `contributes.transformers`
- `contributes.renderers`
- `contributes.exporters`
- `contributes.linters`
- `contributes.terminalSteps`
- `contributes.pipelines`

Language records use `{ id, name, parentLanguageId, fileExtensions, mediaTypes, aliases, description }`. Diagnostics use `{ source, severity, message, languageId, range, target, step }`; legacy `{ from, to }` offsets are normalized inside core services, but they are not the plugin-facing contract.

Contribution parameters are schema records and every parameter must include a `default`. Pipelines are data-only JSON documents that reference contribution ids with optional parameter overrides; text-producing terminal steps open new documents rather than replacing the active source document.

Providers receive a `context.runtime` loader and can call `ensureScripts(...)` to load local runtime bundles only when needed. This keeps startup small and avoids eager loading large libraries such as Mermaid, Graphviz, Prettier, PapaParse, and Ruff WASM.

Packaged plugin paths are auto-loaded by default. In local mode, additional `.js` plugin files can be uploaded through the Plugin Manager. Uploaded plugins are executed through classic script injection from a local Blob URL, not through `eval`, `new Function`, or dynamic import.

## Project Structure

```text
editor-workbench/
  core/                  # App, editor wrapper, plugin/runtime loading, storage, UI
  libs/codemirror/       # Shared CodeMirror base bundle
  plugins/               # Packaged plugins and plugin-owned runtime bundles
  index.html             # Local file entry
  editor.html            # Extension page entry
  manifest.json          # MV3 extension manifest
  render-shell.html      # Generic preview window
  render-shell.js

scripts/
  build-libs.js          # esbuild bundling for local runtime files
  verify-core-contracts.js # contribution, diagnostic, and pipeline contract checks
  verify-js-syntax.js    # JS syntax verification

tools/bundle-src/        # Source entrypoints for generated bundles
```

## Runtime Dependencies

All runtime dependencies are bundled locally. Key dependencies include:

- CodeMirror packages for editor base and language support.
- Marked and DOMPurify for Markdown and sanitization.
- Mermaid and Cytoscape for diagram and tree-graph rendering.
- `@viz-js/viz` and `@viz-js/lang-dot` for Graphviz/DOT.
- Prettier and `@prettier/plugin-xml` for JavaScript/XML formatting.
- PapaParse for CSV parsing.
- Ruff WASM for Python formatting.
- jsMind for read-only mind-map rendering.

See `editor-workbench/libs/THIRD_PARTY.md` for attribution notes.

## Security

The main security objective is to prevent app code, plugins, and renderers from contacting external servers.

The extension CSP keeps:

```text
default-src 'none'
script-src 'self' 'wasm-unsafe-eval'
connect-src 'none'
object-src 'none'
base-uri 'none'
form-action 'none'
```

Local mode uses a matching CSP with `blob:` support for uploaded plugin scripts and local downloads.

Security rules:

- No remote scripts, styles, fonts, images, workers, or APIs.
- No extension host permissions.
- No app-code `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or `sendBeacon`.
- No app-code `eval` or `new Function`.
- SVG and HTML output is sanitized before display/export where applicable.
- Mermaid and Graphviz SVG output is sanitized.
- SVG PNG export sanitizes source SVG before rasterizing with canvas.

Accepted risks: trusted plugins can modify editor state, affect IndexedDB data, create misleading output, or degrade performance. The system is not a full plugin sandbox; it is a local-first workbench with a no-network runtime posture.
