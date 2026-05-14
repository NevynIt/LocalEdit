# Editor Workbench - Coding Agent Implementation Brief

## 1. Current Goal

Maintain and extend a local-first structured text editor workbench that runs in two modes from the same package:

1. Local file mode: open `editor-workbench/index.html` directly from disk.
2. Browser extension mode: load `editor-workbench/` as an unpacked Edge/Chrome MV3 extension and open `editor.html`.

The implementation is plain local HTML, CSS, and JavaScript. It has no backend, no build server at runtime, no CDN, no telemetry, no remote API calls, and no runtime network dependency.

## 2. Current Capabilities

The workbench currently includes:

- CodeMirror editor wrapper with textarea fallback.
- IndexedDB autosave and settings persistence.
- File open through browser file picker and downloads through Blob URLs.
- Plugin manager with default packaged plugins and local uploaded plugin support in local mode.
- Diagnostics, transformers, renderers, exporters, render sessions, manual render refresh, and 3-second stable-source auto-refresh.
- Generic render shell with standalone SVG pan/zoom.
- Plugin-owned lazy runtime bundles loaded through `RuntimeLoader`.

Packaged plugins currently shipped:

- Markdown: syntax highlighting, sanitized HTML preview/export, inline Mermaid and Graphviz fenced diagrams.
- Mermaid: SVG preview/export.
- Graphviz: DOT syntax highlighting, local WASM SVG preview/export.
- SVG: syntax highlighting, sanitized SVG preview/export, sanitized SVG-to-PNG export.
- JSON: syntax highlighting, parse linting, expandable tree preview, format, compact.
- XML: syntax highlighting, DOMParser linting, expandable tree preview, Prettier format, compact.
- JavaScript: syntax highlighting, Prettier format.
- CSV: row-width linting, scrollable table preview.
- Python: syntax highlighting, Ruff WASM format.

## 3. Runtime And Dependency Model

Development uses npm and esbuild only to vendor browser-ready local bundles.

Runtime files are local:

```text
editor-workbench/libs/codemirror/editor.bundle.js
editor-workbench/plugins/shared/sanitize/sanitize.bundle.js
editor-workbench/plugins/**/runtime/*.bundle.js
```

Only the shared CodeMirror base bundle is loaded eagerly by root HTML pages. Plugin-specific runtimes are loaded lazily by plugin providers through `context.runtime.ensureScripts(...)`.

Do not add new eager scripts to `index.html`, `editor.html`, or `render-shell.html` unless the shared app shell truly needs them before any plugin provider runs.

Current important vendored dependencies:

- CodeMirror base and language packages.
- Marked and DOMPurify.
- Mermaid.
- `@viz-js/viz` and `@viz-js/lang-dot`.
- Prettier and `@prettier/plugin-xml`.
- PapaParse.
- Ruff WASM web bindings.

## 4. Security Constraints

The main security objective is preventing network exfiltration.

Implementation must avoid app-code use of:

- `fetch`
- `XMLHttpRequest`
- `WebSocket`
- `EventSource`
- `sendBeacon`
- `eval`
- `new Function`

Do not add:

- remote scripts, styles, fonts, images, workers, or APIs;
- extension host permissions;
- broad extension permissions;
- runtime CDN dependencies;
- server-side conversion.

Allowed CSP exception:

- `'wasm-unsafe-eval'` is allowed for local packaged WASM runtimes such as Graphviz and Ruff.

Keep `connect-src 'none'`.

Plugins are trusted local code, not sandboxed from the editor state. Accepted risks include document mutation, IndexedDB/settings mutation, misleading diagnostics or output, and performance degradation. The no-network posture remains the primary boundary.

## 5. Project Structure

```text
editor-workbench/
  index.html
  editor.html
  manifest.json
  local-bootstrap.js
  extension-bootstrap.js
  background.js

  core/
    app.js
    host-adapter.js
    runtime-loader.js
    editor-core.js
    document-model.js
    language-registry.js
    plugin-types.js
    plugin-registry.js
    plugin-loader.js
    plugin-manager.js
    diagnostics-manager.js
    transform-manager.js
    render-manager.js
    render-session.js
    export-manager.js
    storage.js
    file-open.js
    file-download.js
    toolbar.js
    plugin-manager-panel.js
    diagnostics-panel.js
    editor-layout.js

  libs/
    codemirror/

  plugins/
    shared/sanitize/
    markdown/
    mermaid/
    graphviz/
    svg/
    json/
    xml/
    javascript/
    csv/
    python/

  render-shell.html
  render-shell.js
```

## 6. Core Interfaces

### HostAdapter

Host adapters isolate local-file and extension behavior.

```ts
interface HostAdapter {
  mode: "local" | "extension"
  resolveAppUrl(path: string): string
  getDefaultKnownPlugins(): KnownPluginConfig[]
  canAddPluginPath(): boolean
  canUploadPluginFile(): boolean
  validatePluginPath(path: string): boolean
  validatePluginFile(file: File): boolean
  validateRuntimePath(path: string): boolean
}
```

Plugin paths must be safe local `plugins/**/*.js` paths. Runtime paths must be safe local `.js` paths under `plugins/` or the shared `libs/codemirror/editor.bundle.js`.

### DocumentModel

Use this shape consistently:

```ts
interface DocumentModel {
  text: string
  languageId: string
  fileName?: string
  mimeType?: string
  lastModified?: number
}
```

### RuntimeLoader

Runtime loading is the current dependency model for plugins.

```ts
interface RuntimeLoader {
  ensureScripts(paths: string[] | string): Promise<void>
}
```

Provider contexts include `runtime?: RuntimeLoader`.

### Plugin Registration

Plugins are classic scripts that push plugin objects into `window.EditorPlugins`.

```js
(function () {
  window.EditorPlugins = window.EditorPlugins || [];
  window.EditorPlugins.push({
    id: "plugin-id",
    name: "Plugin Name",
    version: "0.1.0",
    languages: [],
    languageDefinitions: [],
    highlighters: [],
    linters: [],
    transformers: [],
    renderers: [],
    exporters: []
  });
})();
```

The plugin loader must not use `eval`, `new Function`, dynamic import, or remote script URLs.

## 7. Plugin Provider Contracts

Providers may be synchronous or asynchronous where already supported by core managers.

```ts
interface HighlighterProvider {
  id: string
  name: string
  languages: string[]
  getCodeMirrorExtensions(context: HighlighterContext): unknown[] | Promise<unknown[]>
}

interface LinterProvider {
  id: string
  name: string
  languages: string[]
  lint(document: DocumentModel, context: LinterContext): Diagnostic[] | Promise<Diagnostic[]>
}

interface TransformerProvider {
  id: string
  name: string
  inputLanguages: string[]
  outputLanguage?: string
  transform(document: DocumentModel, context: TransformerContext): TransformResult | Promise<TransformResult>
}

interface RendererProvider {
  id: string
  name: string
  inputLanguages: string[]
  outputKind: "html" | "svg" | "text" | "image" | "custom"
  render(document: DocumentModel, context: RendererContext): RenderResult | Promise<RenderResult>
}

interface ExporterProvider {
  id: string
  name: string
  languages?: string[]
  inputKinds: Array<"source" | "rendered">
  outputFileExtension: string
  mimeType: string
  export(input: ExportInput, context: ExporterContext): ExportResult | Promise<ExportResult>
}
```

Diagnostics use:

```ts
interface Diagnostic {
  from: number
  to: number
  severity: "error" | "warning" | "observation"
  message: string
  source?: string
}
```

Transform results use:

```ts
interface TransformResult {
  text: string
  languageId?: string
  fileName?: string
  mode: "replace-current" | "new-document" | "download"
}
```

Render/export results use string, Blob, or ArrayBuffer content as documented in `core/plugin-types.js`.

## 8. Default Packaged Plugins

`HostAdapter.getDefaultKnownPlugins()` should include these packaged plugin paths with `autoLoad: true`:

```text
plugins/markdown/markdown.plugin.js
plugins/mermaid/mermaid.plugin.js
plugins/graphviz/graphviz.plugin.js
plugins/svg/svg.plugin.js
plugins/json/json.plugin.js
plugins/xml/xml.plugin.js
plugins/javascript/javascript.plugin.js
plugins/csv/csv.plugin.js
plugins/python/python.plugin.js
```

## 9. Render Shell Requirements

`render-shell.html` loads core plugin infrastructure, receives render messages, loads active plugin specs, executes the selected renderer, and displays:

- HTML output through sanitized or plugin-produced HTML strings.
- SVG output in the standalone SVG pan/zoom viewer.
- Image output via Blob/object URL or string URL.
- Text/custom output as text.

Do not hard-code language-specific rendering in the shell. The only generic special case is SVG pan/zoom for `RenderResult.kind === "svg"`.

## 10. Current Acceptance Criteria

Local mode:

- Opening `editor-workbench/index.html` from disk starts the editor.
- User can edit text, open files, download source, and restore autosave.
- All default packaged plugins auto-load.
- Language inference works for packaged plugin extensions.
- Plugin manager can upload local `.js` plugins in local mode.
- Render refresh and 3-second stable-source auto-refresh work.
- JSON/XML/CSV diagnostics and previews work.
- JSON/XML/JavaScript/Python transforms work.
- Markdown/Mermaid/Graphviz/SVG previews and exports work.
- SVG source exports to sanitized PNG.
- Standalone SVG render windows support pan/zoom.
- No external network requests are made by app code.

Extension mode:

- `editor-workbench/` can be loaded as an unpacked Edge/Chrome extension.
- Clicking the extension action opens `editor.html`.
- No host permissions or network permissions are requested.
- Uploaded arbitrary plugin files are disabled unless a future design explicitly permits them.
- CSP uses local scripts only, allows local WASM where needed, and keeps `connect-src 'none'`.

## 11. Current Non-Goals

Do not build unless explicitly requested:

- YAML-specific tooling.
- Markdown linting or formatting.
- Mermaid or Graphviz transforms.
- Mermaid/Graphviz PNG export.
- PDF export.
- Remote plugin marketplace.
- Automatic plugin discovery by scanning folders.
- Direct write-back to opened files.
- Cloud sync, authentication, or collaboration.

## 12. Development Checks

Before marking implementation complete, run:

```powershell
npm install
npm run build:libs
npm run verify:syntax
```

Also verify:

- `manifest.json` and `package-lock.json` parse as JSON.
- HTML files contain no inline scripts, inline event handlers, or `javascript:` URLs.
- App code outside generated bundles has no forbidden network or dynamic-code APIs.
- Source outside generated bundles has no runtime remote references.
- Headless/local browser smoke tests cover any changed plugin behavior.
