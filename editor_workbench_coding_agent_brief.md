# Editor Workbench — Coding Agent Implementation Brief

## 1. Goal

Build a minimal local-first structured text editor workbench that can run in two ways from the same package:

1. **Local file mode**: the user unzips the folder and opens `index.html` directly.
2. **Browser extension mode**: the same folder can be packaged as an Edge/Chrome extension using `manifest.json`, with `editor.html` as the extension page.

The workbench must have:

- a full-page code editor;
- local file opening through a browser file picker;
- save/download of the current source file;
- IndexedDB autosave and settings persistence;
- a plugin manager;
- plugin contracts for highlighters, linters, transformers, renderers, and exporters;
- no actual plugins implemented yet.

The first implementation should focus on the application shell and the plugin architecture, not on Markdown, Mermaid, JSON, YAML, or any other concrete language support.

---

## 2. Key design constraints

### 2.1 Dual hosting

The same package must work as:

```text
editor-workbench/
  index.html          # opened directly from disk
  editor.html         # used as the extension page
  manifest.json       # extension manifest
  ...same core files...
```

The root folder must contain the main local and extension entry files so that the folder can be used directly in both scenarios.

### 2.2 No backend

Do not add:

- a server;
- a build server dependency;
- cloud callbacks;
- remote APIs;
- analytics;
- telemetry;
- CDN dependencies.

Everything needed at runtime must be local to the folder/package.

### 2.3 No plugins yet

Do not implement concrete plugins yet. Only implement:

- the plugin registry;
- plugin loading infrastructure;
- plugin manager UI;
- plugin type interfaces/contracts;
- empty `plugins/` folder.

### 2.4 Security posture

The main security objective is to prevent plugins or renderers from contacting external servers.

Accepted risks:

- a plugin may corrupt the current editor document;
- a plugin may corrupt IndexedDB autosave/settings;
- a plugin may produce misleading diagnostics, transformations, renders, or exports;
- a plugin may freeze or degrade the editor;
- a plugin may interfere with other loaded plugins.

The system is not trying to sandbox trusted plugins from the current editor state. The main goal is to avoid network exfiltration.

Implementation must avoid:

- remote scripts;
- remote stylesheets;
- remote fonts;
- remote images;
- remote workers;
- `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or `sendBeacon` in app code;
- extension host permissions;
- broad extension permissions;
- `eval` and `new Function`.

---

## 3. Target project structure

Create the project with this minimal structure:

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

  render-shell.html
  render-shell.js

  libs/
    codemirror/
    other-local-libs/

  plugins/
    .gitkeep
```

Keep the structure flat enough to remain understandable. Do not introduce excessive folders or framework conventions.

---

## 4. Root files

### 4.1 `index.html`

Purpose: local-file entry point.

It must be possible to open this directly:

```text
file:///.../editor-workbench/index.html
```

Responsibilities:

- define the main application shell;
- include local CSS files only;
- include required local JavaScript files only;
- load `local-bootstrap.js`;
- avoid inline JavaScript.

Expected script pattern:

```html
<script src="core/host-adapter.js"></script>
<script src="core/document-model.js"></script>
<script src="core/language-registry.js"></script>
<script src="core/plugin-types.js"></script>
<script src="core/plugin-registry.js"></script>
<script src="core/plugin-loader.js"></script>
<script src="core/plugin-manager.js"></script>
<script src="core/storage.js"></script>
<script src="core/file-open.js"></script>
<script src="core/file-download.js"></script>
<script src="core/editor-core.js"></script>
<script src="core/diagnostics-manager.js"></script>
<script src="core/transform-manager.js"></script>
<script src="core/render-session.js"></script>
<script src="core/render-manager.js"></script>
<script src="core/export-manager.js"></script>
<script src="core/toolbar.js"></script>
<script src="core/plugin-manager-panel.js"></script>
<script src="core/diagnostics-panel.js"></script>
<script src="core/editor-layout.js"></script>
<script src="core/app.js"></script>
<script src="local-bootstrap.js"></script>
```

If the implementation later uses bundling, keep the generated output local and extension-compatible.

### 4.2 `editor.html`

Purpose: extension page entry point.

It should share the same app shell shape as `index.html`, but load:

```html
<script src="extension-bootstrap.js"></script>
```

It should avoid inline JavaScript and be compatible with a strict extension CSP.

### 4.3 `manifest.json`

Purpose: browser extension manifest.

Minimal expected posture:

```json
{
  "manifest_version": 3,
  "name": "Local Editor Workbench",
  "version": "0.1.0",
  "action": {
    "default_title": "Editor Workbench"
  },
  "background": {
    "service_worker": "background.js"
  },
  "permissions": [],
  "host_permissions": [],
  "content_security_policy": {
    "extension_pages": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'none'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none';"
  }
}
```

Do not add permissions unless explicitly required.

### 4.4 `background.js`

Purpose: minimal extension service worker.

Behavior:

- when the extension action button is clicked, open `editor.html`;
- do not perform network access;
- do not inject scripts into web pages;
- do not request tabs, scripting, or host permissions unless a later explicit requirement adds them.

### 4.5 `local-bootstrap.js`

Purpose: start the app in local-file mode.

Expected behavior:

```js
(function () {
  const host = new LocalHostAdapter();
  const app = new App(host);
  app.start();
})();
```

### 4.6 `extension-bootstrap.js`

Purpose: start the app in extension mode.

Expected behavior:

```js
(function () {
  const host = new ExtensionHostAdapter();
  const app = new App(host);
  app.start();
})();
```

---

## 5. Main application classes

### 5.1 `App`

File:

```text
core/app.js
```

Responsibility:

The central coordinator. It wires together the host adapter, editor, language registry, plugin manager, diagnostics, transforms, rendering, exporting, file operations, storage, and UI.

Interface:

```ts
class App {
  constructor(host: HostAdapter)

  async start(): Promise<void>

  async openFile(): Promise<void>
  async saveSourceAsDownload(): Promise<void>

  getDocument(): DocumentModel
  setDocument(document: DocumentModel): void

  setLanguage(languageId: string): void

  async runLinters(): Promise<void>
  async runTransformer(transformerId: string): Promise<void>
  async openRenderer(rendererId: string): Promise<void>
  async runExporter(exporterId: string): Promise<void>
}
```

Startup sequence:

1. initialize storage;
2. initialize language registry;
3. mount the editor;
4. initialize plugin registry and plugin manager;
5. load saved settings and autosave state;
6. load known plugin list;
7. auto-load plugins marked for startup;
8. update toolbar, plugin panel, diagnostics panel, and available actions.

### 5.2 `HostAdapter`

File:

```text
core/host-adapter.js
```

Purpose:

Keep local-file and extension-specific behavior out of the core application.

Interface:

```ts
interface HostAdapter {
  mode: "local" | "extension"

  resolveAppUrl(path: string): string

  getDefaultKnownPlugins(): KnownPluginConfig[]

  canAddPluginPath(): boolean
  validatePluginPath(path: string): boolean
}
```

Implementations:

```ts
class LocalHostAdapter implements HostAdapter {}
class ExtensionHostAdapter implements HostAdapter {}
```

Expected behavior:

```text
LocalHostAdapter:
- mode = "local"
- resolve URLs as relative paths
- may allow user-added local plugin paths, subject to validation
- no network paths

ExtensionHostAdapter:
- mode = "extension"
- resolve URLs with chrome.runtime.getURL(path)
- normally allow packaged plugin paths only
- no arbitrary external plugin paths
```

Path validation rule:

```js
function isAllowedPluginPath(path) {
  return (
    path.startsWith("plugins/") &&
    path.endsWith(".js") &&
    !path.includes("://") &&
    !path.startsWith("//") &&
    !path.includes("..")
  );
}
```

### 5.3 `EditorCore`

File:

```text
core/editor-core.js
```

Purpose:

Wrap the actual editor implementation. Prefer CodeMirror 6, but do not leak CodeMirror details throughout the rest of the app.

Interface:

```ts
class EditorCore {
  mount(container: HTMLElement): void

  getText(): string
  setText(text: string): void

  getSelection(): TextRange | null
  replaceSelection(text: string): void

  setLanguage(languageId: string): void
  setDiagnostics(diagnostics: Diagnostic[]): void

  focus(): void
}
```

Supporting type:

```ts
interface TextRange {
  from: number
  to: number
}
```

Initial minimal behavior:

- display and edit text;
- expose get/set text;
- allow language setting, even if no highlighter is active yet;
- allow diagnostics setting, even if initially rendered only in a side panel.

### 5.4 `DocumentModel`

File:

```text
core/document-model.js
```

Purpose:

Represent the current open document.

Interface:

```ts
interface DocumentModel {
  text: string
  languageId: string
  fileName?: string
  mimeType?: string
  lastModified?: number
}
```

### 5.5 `LanguageRegistry`

File:

```text
core/language-registry.js
```

Purpose:

Maintain known languages and infer language from filenames.

Interface:

```ts
class LanguageRegistry {
  register(language: LanguageDefinition): void
  get(languageId: string): LanguageDefinition | undefined
  list(): LanguageDefinition[]
  inferFromFileName(fileName: string): string | undefined
}
```

```ts
interface LanguageDefinition {
  id: string
  label: string
  extensions: string[]
  mimeTypes?: string[]
}
```

Initial built-in languages may be only generic placeholders, for example:

```text
plain-text
```

Do not implement language-specific behavior yet.

---

## 6. Plugin system

### 6.1 Plugin registration model

Plugins are classic JavaScript files that self-register into a global array.

The loader must not use `eval`, `new Function`, remote imports, or remote scripts.

Plugin files should use this pattern:

```js
(function () {
  window.EditorPlugins = window.EditorPlugins || [];

  window.EditorPlugins.push({
    id: "plugin-id",
    name: "Plugin Name",
    version: "0.1.0",
    description: "Optional description",

    languages: [],

    highlighters: [],
    linters: [],
    transformers: [],
    renderers: [],
    exporters: []
  });
})();
```

No plugin files should be implemented yet except `.gitkeep` in `plugins/`.

### 6.2 `plugin-types.js`

File:

```text
core/plugin-types.js
```

Purpose:

Document runtime plugin contracts. Since this is plain JavaScript, implement this as comments/JSDoc typedefs rather than TypeScript unless the project later adopts a build step.

Main plugin shape:

```ts
interface EditorPlugin {
  id: string
  name: string
  version: string
  description?: string

  languages?: string[]

  highlighters?: HighlighterProvider[]
  linters?: LinterProvider[]
  transformers?: TransformerProvider[]
  renderers?: RendererProvider[]
  exporters?: ExporterProvider[]
}
```

### 6.3 `PluginRegistry`

File:

```text
core/plugin-registry.js
```

Purpose:

Store loaded plugin metadata and provide active engines by type and language.

Interface:

```ts
class PluginRegistry {
  registerPlugin(plugin: EditorPlugin): void

  listPlugins(): RegisteredPlugin[]
  getPlugin(pluginId: string): RegisteredPlugin | undefined

  activatePlugin(pluginId: string): void
  deactivatePlugin(pluginId: string): void

  getHighlighters(languageId: string): HighlighterProvider[]
  getLinters(languageId: string): LinterProvider[]
  getTransformers(languageId: string): TransformerProvider[]
  getRenderers(languageId: string): RendererProvider[]
  getExporters(languageId: string): ExporterProvider[]
}
```

Supporting type:

```ts
interface RegisteredPlugin {
  id: string
  name: string
  version: string
  description?: string
  path?: string
  languages?: string[]
  active: boolean
  status: "loaded" | "inactive" | "failed"
  error?: string
  plugin: EditorPlugin
}
```

Important behavior:

- a loaded plugin can be deactivated;
- deactivation removes its engines from menus and execution;
- deactivation does not undo arbitrary JavaScript side effects already caused by the plugin script.

### 6.4 `PluginLoader`

File:

```text
core/plugin-loader.js
```

Purpose:

Load plugin scripts through dynamic classic script injection.

Interface:

```ts
class PluginLoader {
  constructor(host: HostAdapter, registry: PluginRegistry)

  async load(path: string): Promise<PluginLoadResult>
}
```

Supporting type:

```ts
interface PluginLoadResult {
  path: string
  status: "loaded" | "failed"
  pluginId?: string
  error?: string
}
```

Expected behavior:

1. validate the plugin path through the host adapter;
2. snapshot `window.EditorPlugins.length` before loading;
3. inject a script element using `script.src = host.resolveAppUrl(path)`;
4. wait for `onload` or `onerror`;
5. detect newly pushed plugin objects;
6. validate minimal plugin metadata;
7. register each new plugin in `PluginRegistry`;
8. return a load result.

Do not use dynamic `import()` for plugins in the first version.

### 6.5 `PluginManager`

File:

```text
core/plugin-manager.js
```

Purpose:

Manage known plugin configuration, plugin loading, active state, and auto-load settings.

Interface:

```ts
class PluginManager {
  async loadKnownPlugins(): Promise<KnownPluginConfig[]>
  async saveKnownPlugins(configs: KnownPluginConfig[]): Promise<void>

  async loadPlugin(pluginId: string): Promise<void>
  disablePlugin(pluginId: string): void

  async setAutoLoad(pluginId: string, autoLoad: boolean): Promise<void>

  async addKnownPlugin(path: string): Promise<void>
  async removeKnownPlugin(pluginId: string): Promise<void>
}
```

Known plugin config:

```ts
interface KnownPluginConfig {
  id?: string
  path: string
  known: true
  autoLoad: boolean
  lastStatus?: "loaded" | "unloaded" | "failed"
  lastError?: string
}
```

Startup behavior:

1. read known plugin list from IndexedDB;
2. merge with default known plugins from the host adapter;
3. list them in the plugin manager UI;
4. auto-load only those marked `autoLoad`;
5. save status and errors after load attempts.

UI behavior:

The plugin manager panel should show, for each known plugin:

- plugin name, once known;
- plugin ID, once known;
- plugin file path;
- version, once known;
- description, once known;
- supported languages, once known;
- engine types exposed, once known;
- status: loaded, unloaded, failed;
- auto-load toggle.

Actions:

- load known plugin;
- disable loaded plugin;
- toggle auto-load;
- view load error;
- remove known plugin, where host permits.

In extension mode, adding arbitrary plugin paths should normally be disabled.

---

## 7. Plugin type interfaces

### 7.1 Highlighter provider

Purpose:

Provide editor syntax highlighting or editor extensions for a language.

Interface:

```ts
interface HighlighterProvider {
  id: string
  name: string
  languages: string[]

  getCodeMirrorExtensions(context: HighlighterContext): unknown[]
}
```

```ts
interface HighlighterContext {
  languageId: string
}
```

First implementation may define the interface and leave integration minimal until real plugins exist.

### 7.2 Linter provider

Purpose:

Analyze the current document and return diagnostics.

Interface:

```ts
interface LinterProvider {
  id: string
  name: string
  languages: string[]

  lint(
    document: DocumentModel,
    context: LinterContext
  ): Diagnostic[] | Promise<Diagnostic[]>
}
```

```ts
interface LinterContext {
  languageId: string
}
```

Diagnostic type:

```ts
interface Diagnostic {
  from: number
  to: number
  severity: "error" | "warning" | "observation"
  message: string
  source?: string
}
```

### 7.3 Transformer provider

Purpose:

Transform the current document into another source document or downloadable output.

Interface:

```ts
interface TransformerProvider {
  id: string
  name: string
  inputLanguages: string[]
  outputLanguage?: string

  transform(
    document: DocumentModel,
    context: TransformerContext
  ): TransformResult | Promise<TransformResult>
}
```

```ts
interface TransformerContext {
  languageId: string
}
```

```ts
interface TransformResult {
  text: string
  languageId?: string
  fileName?: string
  mode: "replace-current" | "new-document" | "download"
}
```

Minimum behavior:

- `replace-current`: replace editor text;
- `download`: download returned text;
- `new-document`: may initially behave like `replace-current` with a warning or be left as a later enhancement.

### 7.4 Renderer provider

Purpose:

Render source text into a displayable output.

Interface:

```ts
interface RendererProvider {
  id: string
  name: string
  inputLanguages: string[]
  outputKind: "html" | "svg" | "text" | "image" | "custom"

  render(
    document: DocumentModel,
    context: RendererContext
  ): RenderResult | Promise<RenderResult>
}
```

```ts
interface RendererContext {
  languageId: string
  options?: object
}
```

```ts
interface RenderResult {
  kind: "html" | "svg" | "text" | "image" | "custom"
  content: string | Blob
  mimeType?: string
}
```

### 7.5 Exporter provider

Purpose:

Produce downloadable output from source text or rendered output.

Interface:

```ts
interface ExporterProvider {
  id: string
  name: string
  inputKinds: Array<"source" | "rendered">
  outputFileExtension: string
  mimeType: string

  export(
    input: ExportInput,
    context: ExporterContext
  ): ExportResult | Promise<ExportResult>
}
```

```ts
interface ExportInput {
  sourceDocument?: DocumentModel
  renderedResult?: RenderResult
}
```

```ts
interface ExporterContext {
  suggestedFileName?: string
}
```

```ts
interface ExportResult {
  fileName: string
  mimeType: string
  content: string | Blob | ArrayBuffer
}
```

---

## 8. Managers

### 8.1 `DiagnosticsManager`

File:

```text
core/diagnostics-manager.js
```

Purpose:

Run active linters and collect diagnostics.

Interface:

```ts
class DiagnosticsManager {
  constructor(registry: PluginRegistry)

  async run(document: DocumentModel): Promise<Diagnostic[]>
  clear(): void
}
```

Behavior:

- find active linters for the current language;
- run them;
- catch linter errors and convert them into diagnostics or panel messages;
- return a single diagnostics list;
- do not stop all linting because one linter failed.

### 8.2 `TransformManager`

File:

```text
core/transform-manager.js
```

Purpose:

List and run active transformers.

Interface:

```ts
class TransformManager {
  constructor(registry: PluginRegistry)

  list(languageId: string): TransformerProvider[]
  async run(transformerId: string, document: DocumentModel): Promise<TransformResult>
}
```

### 8.3 `RenderManager`

File:

```text
core/render-manager.js
```

Purpose:

List available renderers and open a generic render window.

Interface:

```ts
class RenderManager {
  constructor(registry: PluginRegistry, host: HostAdapter)

  list(languageId: string): RendererProvider[]
  open(rendererId: string, document: DocumentModel): RenderSession
}
```

Behavior:

- open `render-shell.html`;
- create a `RenderSession`;
- send document and renderer ID to the render window with `postMessage`;
- support refresh.

### 8.4 `RenderSession`

File:

```text
core/render-session.js
```

Purpose:

Represent communication with one render window.

Interface:

```ts
class RenderSession {
  constructor(windowRef: Window, rendererId: string)

  send(document: DocumentModel): void
  refresh(document: DocumentModel): void
  close(): void
}
```

### 8.5 `ExportManager`

File:

```text
core/export-manager.js
```

Purpose:

List and run active exporters.

Interface:

```ts
class ExportManager {
  constructor(registry: PluginRegistry)

  list(languageId: string): ExporterProvider[]
  async export(exporterId: string, input: ExportInput): Promise<ExportResult>
}
```

---

## 9. Storage and file operations

### 9.1 `Storage`

File:

```text
core/storage.js
```

Purpose:

Simple wrapper around IndexedDB.

Interface:

```ts
class Storage {
  async get<T>(key: string): Promise<T | undefined>
  async set<T>(key: string, value: T): Promise<void>
  async remove(key: string): Promise<void>
}
```

Store at least:

- current autosave document;
- selected language;
- known plugin list;
- plugin auto-load settings;
- UI preferences, if any.

### 9.2 `file-open.js`

Purpose:

Open a local file through the browser file picker.

Interface:

```ts
async function openTextFile(): Promise<DocumentModel>
```

Behavior:

- use `<input type="file">` or File System Access API only if explicitly added later;
- read file as text;
- return `DocumentModel` with text, filename, MIME type, and last modified timestamp;
- infer language elsewhere via `LanguageRegistry`.

### 9.3 `file-download.js`

Purpose:

Save output through browser download.

Interface:

```ts
function downloadBlob(fileName: string, blob: Blob): void
function downloadText(fileName: string, text: string, mimeType: string): void
```

Behavior:

- create a Blob;
- create an object URL;
- click a temporary anchor;
- revoke object URL.

Do not try to overwrite the original file directly.

---

## 10. UI files

### 10.1 `editor-layout.js`

Purpose:

Find and expose main DOM regions.

Expected regions:

```text
- toolbar
- editor container
- plugin manager panel
- diagnostics panel
- status bar
```

### 10.2 `toolbar.js`

Purpose:

Wire buttons and menus to `App` methods.

Minimum controls:

- open file;
- save/download source;
- language selector;
- run linters;
- transformers dropdown;
- renderers dropdown;
- exporters dropdown;
- open plugin manager.

### 10.3 `plugin-manager-panel.js`

Purpose:

Display known plugins and actions.

Minimum fields:

- path;
- plugin ID, when known;
- name, when known;
- version, when known;
- status;
- error, if failed;
- auto-load toggle;
- load button;
- disable button.

### 10.4 `diagnostics-panel.js`

Purpose:

Display diagnostics returned by linters.

Minimum fields:

- severity;
- message;
- source;
- range.

Clicking a diagnostic may later move the editor selection, but this is optional in the first version.

---

## 11. Render shell

### 11.1 `render-shell.html`

Purpose:

Generic render window.

It should load `render-shell.js` and the same core/plugin files required to find and run renderers.

Initial version may be minimal.

### 11.2 `render-shell.js`

Purpose:

Receive render instructions from the main window.

Expected message shape:

```ts
interface RenderMessage {
  type: "render"
  rendererId: string
  document: DocumentModel
  options?: object
}
```

Minimum behavior:

- listen for `message` events;
- identify renderer by ID;
- call renderer;
- display returned HTML, SVG, text, image, or custom result;
- display renderer errors visibly inside the render window.

The render shell should be generic. Do not hard-code Markdown, Mermaid, SVG, or other concrete languages.

---

## 12. Security and CSP implementation notes

### 12.1 Local mode

`index.html` may include a CSP meta tag. It may need to be more permissive than extension mode because of local-file behavior.

Suggested starting point:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: data:; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';">
```

Avoid inline scripts even in local mode.

### 12.2 Extension mode

Use the manifest CSP. Keep it strict:

```text
connect-src 'none'
```

Do not add remote origins.

### 12.3 Runtime checks

Add simple defensive validation where practical:

- reject plugin paths containing `://`;
- reject paths starting with `//`;
- reject paths containing `..`;
- reject non-`.js` plugin paths;
- in extension mode, reject plugin paths outside packaged allowed paths.

---

## 13. Implementation order

Implement in this order:

1. create root HTML files: `index.html`, `editor.html`;
2. create `manifest.json` and `background.js`;
3. create host adapters and bootstraps;
4. create `App` skeleton;
5. create layout, toolbar, and basic panels;
6. create `EditorCore` with a basic editable text area or CodeMirror wrapper;
7. create `DocumentModel` and `LanguageRegistry`;
8. create `Storage` wrapper around IndexedDB;
9. create file open and download helpers;
10. implement autosave and restore;
11. create plugin type definitions/JSDoc;
12. create `PluginRegistry`;
13. create `PluginLoader` with classic script injection;
14. create `PluginManager` and its panel;
15. create `DiagnosticsManager`;
16. create `TransformManager`;
17. create `RenderManager` and `RenderSession`;
18. create `render-shell.html` and `render-shell.js`;
19. create `ExportManager`;
20. verify local mode by opening `index.html` directly;
21. verify extension mode by loading the same folder as an unpacked extension;
22. verify no network requests are made.

Do not add concrete plugins during this work.

---

## 14. Initial acceptance criteria

The work is complete when all of the following are true:

### Local mode

- opening `index.html` from disk starts the editor;
- the user can type and edit text;
- the user can open a local text file;
- the user can download/save the current source text;
- autosave restores the last edited text;
- plugin manager opens and shows known plugin configuration, even if empty;
- no external network requests are made.

### Extension mode

- the same folder can be loaded as an unpacked Edge/Chrome extension;
- clicking the extension action opens `editor.html`;
- the editor works in the extension page;
- no host permissions are requested;
- no network permissions are requested;
- CSP does not require inline scripts, remote scripts, or eval;
- no external network requests are made.

### Plugin infrastructure

- known plugin list is stored in IndexedDB;
- plugin auto-load setting is stored in IndexedDB;
- plugin paths are validated;
- plugin scripts are loaded only through classic script injection;
- loaded plugins are registered from `window.EditorPlugins`;
- loaded plugins can be deactivated at registry level;
- highlighter, linter, transformer, renderer, and exporter interfaces are documented and represented in code.

---

## 15. What not to build yet

Do not build:

- Markdown plugin;
- Mermaid plugin;
- JSON/YAML plugin;
- SVG renderer;
- Graphviz/DOT renderer;
- PDF exporter;
- PNG exporter;
- server-side conversion;
- remote plugin marketplace;
- automatic plugin discovery by scanning folders;
- direct write-back to opened files;
- cloud sync;
- authentication;
- collaboration features.

---

## 16. Final architectural summary

Build a minimal local-first editor workbench as:

```text
root package
  + local entry: index.html
  + extension entry: editor.html
  + shared core app
  + host adapter boundary
  + CodeMirror/editor wrapper
  + IndexedDB storage
  + explicit file open/download
  + plugin registry
  + plugin manager
  + plugin type contracts
  + generic render shell
  + no concrete plugins yet
  + no network dependency
```

The implementation must keep the two usage modes aligned from the beginning: the local version is easy to unzip and run, while the extension version uses the same files with stricter containment.
