# Editor Workbench

For end-user guidance, see [USER_MANUAL.md](USER_MANUAL.md).

Editor Workbench is a local-first structured text editor that runs from disk or as an unpacked Chrome/Edge extension. It has no backend and no runtime network dependency. Runtime libraries are vendored as local bundles and loaded lazily by plugins.

## Features

- CodeMirror editor contribution with local syntax-highlighting bundles and textarea fallback editor contribution.
- Multi-document workspace with tabbed document instances, duplicate-name disambiguation, active-document switching, close fallback behavior, session-only reopen for hidden closed tabs, tab-driven rename, and an intentionally empty startup workspace until a document is opened or created.
- Workspace-scoped IndexedDB persistence for open documents, active tab, selected languages, file open, and source download.
- Plugin manager with packaged plugins and local `.js` plugin upload in local mode.
- Canonical `text`-rooted language hierarchy with inherited tool matching, alias compatibility, and hierarchical language labels.
- Shared foundation dialects for `json.tree`, `json.table`, `json.indented-tree`, and `json.model-graph`.
- Diagnostics panel, multilevel toolbar menus, preview/render windows with document-aware titles and metadata, manual refresh, and 3-second stable-source auto-refresh.
- Document-scoped diagnostics and document-bound preview windows with source metadata chrome.
- Pipeline-backed transform, render, export, and editor actions, with automatic single-step pipeline entries for registered transformers, renderers, and exporters.
- Transformers now declare explicit output languages, and transformer-final pipelines automatically open their final text result as a new document.
- Text-producing pipeline results always open as new documents, and pipeline runs can optionally open intermediate transformer steps as additional documents.
- Pipeline JSON documents for defining and running custom data-only pipelines.
- Markdown preview/export with sanitized HTML and inline Mermaid/Graphviz fenced diagrams.
- Mermaid and Graphviz SVG preview/export through `xml.svg` pipelines.
- SVG preview/export, sanitized SVG-to-PNG export, and pan/zoom for standalone SVG previews.
- JSON and XML linting, shared tree-preview pipelines, prettify, and compact transforms.
- YAML linting, syntax highlighting, JSON conversion, OpenAPI YAML normalization, and shared tree-preview pipelines.
- Indented Tree parsing, linting, shared tree/graph pipelines, and JSON/Cytoscape export pipelines.
- Structured Markdown extraction, business table profile linting, OPML import/export, and Markdown report pipelines.
- Table profiling plus dependency-free JSON chart to SVG/PNG pipelines through the shared SVG renderer/exporter.
- Process model graph pipelines for Indented Tree and BPMN, including Mermaid/DOT projections, role/activity tables, BPMN export, and reports.
- Architecture graph pipelines for tables/CSV and ArchiMate Exchange XML, including traceability tables/graphs, reports, and ArchiMate export.
- OpenAPI endpoint/schema views, package dependency graphs, and lightweight JavaScript/Python outline/import analysis.
- Gephi GEXF conversion pipelines for model graphs, Cytoscape JSON, JSON trees, jsMind, DOT, Mermaid flowcharts, OPML, tables/CSV, OpenAPI, BPMN, ArchiMate, and source import graphs.
- Sigma/Graphology graph explorer with ForceAtlas2, Noverlap, circular/random layouts, degree/PageRank sizing, Louvain community coloring, search, neighborhood focus, and GEXF download.
- Read-only jsMind rendering from Indented Tree through a local pinned jsMind bundle.
- Cytoscape JSON linting, graph preview, formatting, and compacting.
- JavaScript formatting through local Prettier.
- CSV row-width linting and shared table-preview pipeline.
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

- The toolbar exposes multilevel menus for Language, Editor, Reopen, and Actions, with dead-end submenu chains collapsed so commands do not require unnecessary navigation.
- The Actions menu is one pipeline surface instead of separate transform, render, export, and pipeline menus.
- Registered transformers, renderers, and exporters are surfaced automatically as synthetic single-step pipeline actions for the current language.
- User-defined and packaged multi-step pipelines appear in the same list.
- Contributions can provide `category` or `menuPath` metadata to place commands intentionally; unannotated actions are grouped from their kind and action name.
- The `Discover` action opens an `.itt` contribution catalog organized by the language hierarchy, with consuming contributions nested under each format and transformer cross links pointing to produced formats.
- Preview refresh and auto-refresh continue to operate on preview windows bound to the active document.
- Render windows show the bound document name in the window title, display the last update timestamp in the render chrome, and can request a targeted refresh from inside the render window.
- The optional `Steps` toggle opens intermediate transformer outputs as separate documents so pipeline execution can be inspected step by step.
- jsMind previews now render Indented Tree cross links with a distinct dashed overlay so relationship links stay visually separate from hierarchy edges.

## Language Model

Languages are inheritance-aware. LocalEdit treats plain text as `text.plain`, which inherits from the root `text` language. Parent contributions automatically apply to descendant languages, so generic tools for `json`, `xml`, or `text` remain available to specialized dialects.

Current packaged canonical ids include:

- `text.plain` with alias compatibility for `plain-text`
- `text.markdown` with alias compatibility for `markdown`
- `text.mermaid` with alias compatibility for `mermaid`
- `text.graphviz-dot` with alias compatibility for `graphviz.dot` and `graphviz`
- `text.indented-tree` with alias compatibility for `indented-tree`
- `text.csv` with alias compatibility for `csv`
- `text.json` with alias compatibility for `json`
- `text.xml` with alias compatibility for `xml`
- `text.yaml` with alias compatibility for `yaml`
- `text.javascript` with alias compatibility for `javascript`
- `text.python` with alias compatibility for `python`
- `xml.svg` with alias compatibility for `svg`
- `json.cytoscape` with alias compatibility for `cytoscape`
- `json.jsmind` with alias compatibility for `jsmind-json`
- `localedit.pipeline-json` with alias compatibility for `localedit-pipeline-json`

Reusable intermediate dialects include `json.tree`, `json.table`, `json.indented-tree`, `json.model-graph`, `json.profile`, `json.chart`, and `json.openapi`. Table profiles include `json.table.action-list`, `json.table.risk-register`, `json.table.endpoint-list`, `json.table.traceability-matrix`, and `json.table.role-activity`. Graph profiles include `json.model-graph.process`, `json.model-graph.architecture`, `json.model-graph.traceability`, and `json.model-graph.dependency`. XML profiles include `xml.opml`, `xml.bpmn`, and `xml.archimate-exchange`. YAML profile dialects include `yaml.openapi`, `yaml.frontmatter`, and `yaml.config`.

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
- `editor-workbench/plugins/yaml/runtime/yaml.bundle.js` and `editor-workbench/plugins/yaml/runtime/codemirror-yaml.bundle.js` for YAML support.
- Plugin-owned runtime bundles under `editor-workbench/plugins/**/runtime/`.

The app does not load from npm, a CDN, or a server at runtime.

`npm run verify:contracts` checks packaged plugin registration, inheritance-aware language lookup, parameter defaults, canonical diagnostic normalization, document-scoped diagnostics isolation, workspace bookkeeping, and pipeline execution metadata including intermediate results.

## Packaged Plugins

| Plugin | Language IDs | Main capabilities |
| --- | --- | --- |
| Foundation Dialects | `json.tree`, `json.table`, `json.indented-tree`, `json.model-graph`, `json.openapi` | Shared tree/table renderers, model graph transforms, JSON/CSV export, replacement pipelines |
| Markdown | `text.markdown` | Syntax, sanitized HTML preview/export, Mermaid/Graphviz fenced diagrams |
| Mermaid | `text.mermaid` | Mermaid-to-`xml.svg` transform and SVG/PNG pipelines |
| Graphviz | `text.graphviz-dot` | DOT syntax, local WASM Graphviz-to-`xml.svg` transform and SVG/PNG pipelines |
| SVG | `xml.svg` | SVG syntax, sanitized SVG preview/export, PNG export |
| JSON | `text.json` | Syntax, parse linting, shared tree/graph pipelines, format, compact |
| Cytoscape JSON | `json.cytoscape` | JSON syntax, graph-shape linting, Cytoscape preview, format, compact |
| Indented Tree | `text.indented-tree` | Syntax, parser linting, shared tree/graph pipelines, JSON/Cytoscape export pipelines |
| XML | `text.xml` | Syntax, DOMParser linting, shared tree pipeline, Prettier format, compact |
| YAML | `text.yaml`, `yaml.openapi`, `yaml.frontmatter`, `yaml.config` | Syntax, parse linting, JSON conversion, OpenAPI YAML normalization, shared tree pipeline |
| Structured Docs | `xml.opml`, table profiles | Markdown outline/table/task extraction, action/risk/traceability table profile linting, OPML conversion/export, table and graph Markdown reports |
| Data Profile | `json.profile`, `json.chart` | JSON Table profiling, profile Markdown reports, bar chart JSON generation, chart SVG preview/export, chart PNG export |
| Process Model | `xml.bpmn`, `json.model-graph.process`, `json.table.role-activity` | Indented Tree/BPMN to process graphs, Cytoscape preview, Mermaid/DOT conversion, role/activity tables, BPMN XML export, reports |
| Architecture Model | `xml.archimate-exchange`, `json.model-graph.architecture`, `json.model-graph.traceability`, `json.table.traceability-matrix` | Table/CSV and ArchiMate import, architecture graph preview, traceability table/graph views, ArchiMate XML export, reports |
| Code and API Analysis | `json.openapi`, `yaml.openapi`, `json.model-graph.dependency`, `json.table.endpoint-list` | OpenAPI endpoint tables, OpenAPI dependency graphs/reports, package dependency graphs, JavaScript/Python outlines and import graphs |
| Gephi GEXF | `xml.gexf` | GEXF language/lint/export plus conversion pipelines from graph, tree, table, process, architecture, and dependency formats |
| Sigma Graph Explorer | graph dialects and `xml.gexf` | Interactive sigma.js/graphology preview with layouts, metrics, community coloring, search, focus, and GEXF download |
| JavaScript | `text.javascript` | Syntax, Prettier format |
| CSV | `text.csv` | Row-width linting and shared table pipeline |
| Python | `text.python` | Syntax, Ruff WASM format |
| Pipeline JSON | `localedit.pipeline-json` | Pipeline document linting and flow preview |
| jsMind | `json.jsmind` | Indented Tree to jsMind JSON transform and read-only mind-map preview |

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
- `contributes.pipelines`

Language records use `{ id, name, parentLanguageId, fileExtensions, mediaTypes, aliases, description }`. Diagnostics use `{ source, severity, message, languageId, range, target, step }`; legacy `{ from, to }` offsets are normalized inside core services, but they are not the plugin-facing contract.

Contribution parameters are schema records and every parameter must include a `default`. Pipelines are data-only JSON documents that reference contribution ids with optional parameter overrides; when a pipeline ends with a transformer, its final text result opens as a new document automatically.

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
- `yaml` and `@codemirror/lang-yaml` for YAML parsing/stringifying and syntax highlighting.
- Ruff WASM for Python formatting.
- jsMind for read-only mind-map rendering.

Charts are generated as local SVG from `json.chart` without an additional runtime charting dependency.

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
