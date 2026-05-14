# Editor Workbench

Editor Workbench is a local-first structured text editor that runs from disk or as an unpacked Chrome/Edge extension. It has no backend and no runtime network dependency. Runtime libraries are vendored as local bundles and loaded lazily by plugins.

## Features

- CodeMirror editor with local syntax-highlighting bundles.
- IndexedDB autosave, selected-language persistence, file open, and source download.
- Plugin manager with packaged plugins and local `.js` plugin upload in local mode.
- Diagnostics panel, transformer menu, preview/render windows, exporter menu, manual refresh, and 3-second stable-source auto-refresh.
- Markdown preview/export with sanitized HTML and inline Mermaid/Graphviz fenced diagrams.
- Mermaid and Graphviz standalone SVG preview/export.
- SVG preview/export, sanitized SVG-to-PNG export, and pan/zoom for standalone SVG previews.
- JSON and XML linting, tree previews, prettify, and compact transforms.
- Indented Tree parsing, linting, outline preview, Cytoscape preview, and JSON/Cytoscape export.
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
2. Use `Open` to load a local text file.
3. Use `Save` or plugin exporters to download output.

Extension mode:

1. Open Edge or Chrome extension management.
2. Enable developer mode.
3. Load `editor-workbench/` as an unpacked extension.
4. Click the extension action to open `editor.html`.

## Build And Verification

Requires Node.js and npm for development-time vendoring only.

```powershell
npm install
npm run build:libs
npm run verify:syntax
```

`npm run build:libs` creates:

- `editor-workbench/libs/codemirror/editor.bundle.js` for the shared editor runtime.
- `editor-workbench/plugins/shared/sanitize/sanitize.bundle.js` for shared sanitization.
- Plugin-owned runtime bundles under `editor-workbench/plugins/**/runtime/`.

The app does not load from npm, a CDN, or a server at runtime.

## Packaged Plugins

| Plugin | Language IDs | Main capabilities |
| --- | --- | --- |
| Markdown | `markdown` | Syntax, sanitized HTML preview/export, Mermaid/Graphviz fenced diagrams |
| Mermaid | `mermaid` | SVG preview/export |
| Graphviz | `graphviz` | DOT syntax, local WASM SVG preview/export |
| SVG | `svg` | SVG syntax, sanitized SVG preview/export, PNG export |
| JSON | `json` | Syntax, parse linting, HTML tree preview, Cytoscape tree preview, format, compact |
| Cytoscape JSON | `cytoscape` | JSON syntax, graph-shape linting, Cytoscape preview, format, compact |
| Indented Tree | `indented-tree` | Syntax, parser linting, outline preview, Cytoscape preview, JSON/Cytoscape export |
| XML | `xml` | Syntax, DOMParser linting, tree preview, Prettier format, compact |
| JavaScript | `javascript` | Syntax, Prettier format |
| CSV | `csv` | Row-width linting, scrollable table preview |
| Python | `python` | Syntax, Ruff WASM format |

## Plugin Runtime Model

Plugins are classic JavaScript files that register on `window.EditorPlugins`. They can contribute:

- `languageDefinitions`
- `highlighters`
- `linters`
- `transformers`
- `renderers`
- `exporters`

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
