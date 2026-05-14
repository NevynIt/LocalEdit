# Editor Workbench

A browser-based code editor with plugin architecture, supporting Markdown, Mermaid diagrams, GraphViz/DOT, and SVG. Runs locally or as a browser extension.

## Features

- **Code editing** via CodeMirror with syntax highlighting
- **Markdown** rendering and HTML export
- **Mermaid** diagram preview
- **GraphViz/DOT** diagram rendering (via Viz.js)
- **SVG** file support
- **Plugin system** — load custom plugins at runtime (local mode)
- **Auto-save** to browser IndexedDB with debounced preview refresh
- **Diagnostics panel** for errors and warnings

## Modes

| Mode | Entry Point | File Operations | Plugin Upload |
|------|-------------|-----------------|---------------|
| Local / Browser | `index.html` | Open / Save | Yes |
| Extension | `editor.html` | Open / Save | No |

## Getting Started

### Local Mode

Open `editor-workbench/index.html` directly in a browser. No server required.

### Browser Extension

Install via `manifest.json` (Chrome/Edge MV3). Load the `editor-workbench/` folder as an unpacked extension.

## Build

Requires Node.js.

```bash
npm install
npm run build        # bundle all dependencies
npm run verify       # syntax-check all JS files
```

Bundled outputs land in `editor-workbench/libs/`.

## Project Structure

```
editor-workbench/
├── core/            # App, editor, plugin registry, storage, UI
├── plugins/         # Built-in plugins (markdown, mermaid, graphviz, svg)
├── libs/            # Pre-built dependency bundles (esbuild IIFE)
├── index.html       # Local mode entry
├── editor.html      # Extension mode entry
└── render-shell.html# Isolated preview renderer

scripts/
├── build-libs.js    # Bundles npm deps with esbuild
└── verify-js-syntax.js

tools/bundle-src/    # Source files fed to esbuild
```

## Plugin API

Plugins follow a standard contract and may implement any combination of:

- **Language** — syntax highlighting definition
- **Linter** — diagnostics producer
- **Transformer** — code modification
- **Renderer** — preview generator
- **Exporter** — file download handler

Drop a `.plugin.js` file via the Plugin Manager panel in local mode to load it at runtime.

## Dependencies

All dependencies are vendored as local bundles — no CDN calls at runtime.

| Library | Version | Purpose |
|---------|---------|---------|
| CodeMirror | 6.42.1 | Editor core |
| Marked | 18.0.3 | Markdown parsing |
| DOMPurify | 3.4.3 | HTML sanitisation |
| Mermaid | 11.15.0 | Diagram rendering |
| Viz.js | 3.27.0 | GraphViz rendering |
| esbuild | 0.28.0 | Build bundler |

## Security

### Content Security Policy (CSP)

Enforced via Chrome MV3 manifest:

```
default-src 'none'
script-src 'self' 'wasm-unsafe-eval'
style-src 'self' 'unsafe-inline'
img-src 'self' blob: data:
font-src 'self'
worker-src 'self'
connect-src 'none'
form-action 'none'
base-uri 'none'
object-src 'none'
```

Prevents network access, form submission, plugins/objects, and only allows scripts from the extension itself (+ WebAssembly for GraphViz rendering).

### Input Sanitization

**HTML & SVG** sanitised with DOMPurify (HTML & SVG profiles enabled):
- Forbids: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<video>`, `<audio>`, `<link>`, `<meta>`, `<base>`, animation tags
- Forbids attributes: `href`, `xlink:href`, `src`, `srcset`, `poster`, `style`, `formaction`, `data-*`
- Post-sanitization hook blocks all protocols: `javascript:`, `vbscript:`, `data:`, `file:`, `http:`, `https:` in attribute values
- Blocks `url()` CSS functions that don't reference local fragments

**Diagram rendering** (Mermaid, Graphviz) produces SVG in isolated contexts; output is sanitized before display.

### Extension Mode Restrictions

When deployed as a browser extension, the editor:
- **Disables plugin upload UI** — only built-in plugins available
- **No host permissions** — cannot access website data

File open/save operations work normally via the browser's standard file picker and download APIs.

### Data Isolation

- **IndexedDB storage** is browser-sandboxed per origin
- **Render session** spawns in isolated window with message-based communication
- **No cookies, localStorage, or cross-origin access**

### Dependency Vendoring

All runtime dependencies are bundled locally (no CDN), reducing supply chain risk and ensuring CSP compliance.
