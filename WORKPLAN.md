# Editor Workbench Workplan

## Current Status

Implementation completed for the v1 shell, plugin infrastructure, dependency vendoring workflow, CodeMirror editor integration, Markdown plugin, Mermaid plugin, Graphviz plugin, SVG plugin, Markdown inline diagram rendering, lazy plugin-owned runtime bundles, JSON/XML/JavaScript/CSV/Python plugins, SVG PNG export, and standalone SVG pan/zoom. Static checks and local Edge smoke verification passed on 2026-05-14. Manual unpacked extension testing remains pending.

## Phase Checklist

- [x] Phase 1: Create this tracker and scaffold `editor-workbench/`.
- [x] Phase 2: Add root HTML files, extension manifest, service worker, bootstraps, and local CSS.
- [x] Phase 3: Implement the app shell and textarea-backed `EditorCore`.
- [x] Phase 4: Add IndexedDB storage, autosave restore, language persistence, file open, and source download.
- [x] Phase 5: Implement plugin contracts, registry, loader, manager, known plugin storage, and plugin manager UI.
- [x] Phase 6: Implement diagnostics, transform, render session, render shell, and export infrastructure.
- [x] Phase 7: Verify browser-mode acceptance criteria manually.
- [x] Phase 8: Add npm-based development workflow for identifying and vendoring local runtime dependencies.
- [x] Phase 9: Replace textarea-primary editor with CodeMirror, retaining textarea fallback.
- [x] Phase 10: Implement first Markdown plugin with syntax support, sanitized HTML preview, and HTML export.
- [x] Phase 11: Add render manual refresh and 3-second stable-source auto-refresh controls.
- [x] Phase 12: Add local-mode uploaded plugin loading through the plugin manager file picker.
- [x] Phase 13: Add pinned Mermaid, Graphviz/Viz, DOT, and HTML editor dependencies.
- [x] Phase 14: Build local Mermaid and Graphviz browser bundles under `editor-workbench/libs/`.
- [x] Phase 15: Add packaged Mermaid, Graphviz, and SVG plugins with default auto-load entries.
- [x] Phase 16: Extend Markdown preview/export to render Mermaid and Graphviz fenced diagrams inline.
- [x] Phase 17: Verify diagram plugin security posture and local Edge smoke behavior.
- [x] Phase 18: Add pinned dependencies for JSON, XML, JavaScript, CSV, Python, Prettier, XML Prettier, PapaParse, and Ruff WASM.
- [x] Phase 19: Extend plugin-owned runtime bundling for the new language highlighters and formatter/parser runtimes.
- [x] Phase 20: Add packaged JSON and XML plugins with linting, tree preview, prettify, and compact transforms.
- [x] Phase 21: Add packaged JavaScript and Python plugins with syntax highlighting and prettifier transforms.
- [x] Phase 22: Add packaged CSV plugin with row-width linting and scrollable table preview.
- [x] Phase 23: Extend SVG plugin with sanitized PNG export and add SVG render pan/zoom controls.
- [x] Phase 24: Verify structured language plugins, SVG PNG export, SVG pan/zoom, and security posture.

## Verification Log

- [x] Project file structure created under `editor-workbench/`.
- [x] `manifest.json` parses as valid JSON.
- [x] All JavaScript files pass `node --check`.
- [x] Static source scan found no forbidden network or dynamic-code APIs in app code outside vendored bundles.
- [x] HTML scan found no inline scripts, inline event handlers, or `javascript:` URLs.
- [x] Core smoke test passed for plugin path validation, document model loading, language registry loading, and plugin registry provider lookup.
- [x] Edge headless opened `file:///C:/Stuff/LocalEdit/editor-workbench/index.html` and exposed the page through DevTools.
- [x] Manual local interaction test completed: type text, open a local file, download source, reload for autosave, and open plugin manager.
- [x] npm exact dependency install completed and `package-lock.json` was generated.
- [x] Local bundles generated:
  - `editor-workbench/libs/codemirror/editor.bundle.js`
  - `editor-workbench/plugins/shared/sanitize/sanitize.bundle.js`
  - `editor-workbench/plugins/markdown/runtime/markdown.bundle.js`
  - `editor-workbench/plugins/markdown/runtime/codemirror-markdown.bundle.js`
- [x] `npm audit --audit-level=moderate` reported 0 vulnerabilities.
- [x] CodeMirror rendered in Edge headless with no textarea fallback.
- [x] Markdown language auto-loaded from `plugins/markdown/markdown.plugin.js`.
- [x] Markdown render/export actions appeared after selecting Markdown.
- [x] Markdown sanitizer removed `<script>` and remote image content in preview/export smoke tests.
- [x] Generic render shell loaded the Markdown plugin and rendered sanitized preview output.
- [x] `editor.html` extension entry loaded directly in Edge headless, started in extension mode, and rendered CodeMirror with Markdown registered.
- [x] `editor.html` direct smoke confirmed arbitrary uploaded plugin control is hidden in extension mode.
- [x] Render refresh smoke test passed: manual refresh updated an open Markdown preview.
- [x] Auto-refresh smoke test passed: preview updated after the 3-second stable-source delay.
- [x] Uploaded local plugin smoke test passed: plugin manager loaded an in-memory `.js` file and exposed its renderer.
- [x] Example plugin added at `editor-workbench/plugins/example-smoke.plugin.js` for manual path-load or upload testing.
- [x] Additional exact dependencies installed: `mermaid@11.15.0`, `@viz-js/viz@3.27.0`, `@viz-js/lang-dot@1.0.5`, and `@codemirror/lang-html@6.4.11`.
- [x] Additional local bundles generated:
  - `editor-workbench/plugins/mermaid/runtime/mermaid.bundle.js`
  - `editor-workbench/plugins/graphviz/runtime/graphviz.bundle.js`
  - `editor-workbench/plugins/graphviz/runtime/codemirror-dot.bundle.js`
  - `editor-workbench/plugins/svg/runtime/codemirror-html.bundle.js`
- [x] Manifest and local/render-shell CSP allow only local Graphviz WASM support through `'wasm-unsafe-eval'`; `connect-src 'none'` and empty host permissions remain in place.
- [x] App-code forbidden API scan passed with no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `eval`, or `new Function` usage outside vendored bundles.
- [x] Third-party bundle static scan reviewed package-internal network/dynamic-code strings in generated Mermaid/Graphviz/DOMPurify bundles; Edge runtime smoke observed no HTTP(S) requests, page errors, or console errors.
- [x] Mermaid standalone smoke rendered sanitized SVG.
- [x] Graphviz standalone smoke rendered sanitized SVG through local WASM.
- [x] SVG sanitizer smoke stripped `<script>`, event handlers, remote image references, and unsafe links while preserving safe SVG content.
- [x] Markdown preview smoke rendered Mermaid and Graphviz fenced code blocks inline.
- [x] Markdown HTML export smoke embedded sanitized inline SVG and did not add runtime scripts or remote assets.
- [x] Additional exact dependencies installed: `@codemirror/lang-json@6.0.2`, `@codemirror/lang-xml@6.1.0`, `@codemirror/lang-javascript@6.2.5`, `@codemirror/lang-python@6.2.1`, `prettier@3.8.3`, `@prettier/plugin-xml@3.4.2`, `papaparse@5.5.3`, and `@astral-sh/ruff-wasm-web@0.15.13`.
- [x] Additional plugin-owned runtime bundles generated for JSON, XML, JavaScript, CSV, and Python.
- [x] `npm run verify:syntax` checked 70 JavaScript files after the structured language implementation.
- [x] JSON parse checks passed for `manifest.json` and `package-lock.json`.
- [x] HTML inline script/event/`javascript:` scan passed.
- [x] App-code forbidden API scan passed outside vendored generated bundles.
- [x] Remote-reference scan passed outside vendored generated bundles.
- [x] Edge local smoke confirmed JSON lint, tree preview, prettify, compact, and lazy CodeMirror runtime loading.
- [x] Edge local smoke confirmed XML lint, tree preview, Prettier XML formatting, compacting, and lazy CodeMirror runtime loading.
- [x] Edge local smoke confirmed JavaScript Prettier formatting and invalid-input failure reporting.
- [x] Edge local smoke confirmed CSV row-width linting and table preview.
- [x] Edge local smoke confirmed Python Ruff WASM formatting and invalid-input failure reporting.
- [x] Edge local smoke confirmed SVG PNG export returns a valid PNG blob signature.
- [x] Render-shell smoke confirmed pan/zoom controls for SVG, Mermaid, and Graphviz standalone previews.
- [ ] Manual extension test pending: load `editor-workbench/` as an unpacked Edge/Chrome extension.

## Implementation Notes

- Project package: `editor-workbench/`
- Local entry: `editor-workbench/index.html`
- Extension entry: `editor-workbench/editor.html`
- Runtime style: plain local HTML, CSS, and JavaScript.
- Editor v2: CodeMirror wrapped by `EditorCore`, with textarea fallback if the local CodeMirror bundle is unavailable.
- Dependency workflow: npm is used only for development/build-time vendoring; runtime dependencies are local files under `editor-workbench/libs/` and `editor-workbench/plugins/**/runtime/`.
- First plugin: Markdown support is implemented in `plugins/markdown/markdown.plugin.js`.
- Render refresh: the main toolbar includes a manual refresh button and an auto-refresh toggle that refreshes open render windows only after 3 seconds of stable source.
- Uploaded plugins: local-file mode can load `.js` plugin files from the plugin manager via a file picker; extension mode keeps arbitrary uploaded plugin files disabled.
- Packaged plugins: Markdown, Mermaid, Graphviz, and SVG are registered as default known plugins with `autoLoad: true`.
- Markdown diagrams: Markdown preview and HTML export render `mermaid`, `mmd`, `dot`, `gv`, and `graphviz` fenced code blocks inline as sanitized SVG.
- Packaged structured plugins: JSON, XML, JavaScript, CSV, and Python are registered as default known plugins with `autoLoad: true`.
- SVG export/viewer: SVG source can export to sanitized PNG, and standalone SVG render results include pan/zoom controls.
- Plugin scope still excludes YAML-specific tooling, Markdown linting/formatting, Mermaid or Graphviz transforms, Mermaid/Graphviz PNG export, PDF, cloud, collaboration, and remote plugin marketplace features.

## Dependency Vendoring Checklist

- [x] Identify exact versions for runtime dependencies.
- [x] Add `package.json` with exact pinned dependencies and dev tooling.
- [x] Generate `package-lock.json` via `npm install`.
- [x] Add bundling script at `scripts/build-libs.js`.
- [x] Build local browser bundles with `npm run build:libs`.
- [x] Document bundled dependency attribution in `editor-workbench/libs/THIRD_PARTY.md`.
- [x] Keep `node_modules/` ignored and out of runtime packaging.
- [x] Add and pin Mermaid, Viz.js/Graphviz, DOT language, and HTML language dependencies.
- [x] Build Mermaid and Graphviz runtime bundles under plugin runtime directories.
- [x] Build plugin-owned CodeMirror language bundles for Markdown, DOT, and SVG/HTML.
- [x] Keep runtime dependency loading local with no CDN, remote font, remote style, or remote script references.
- [x] Add and pin `@codemirror/lang-json@6.0.2`, `@codemirror/lang-xml@6.1.0`, `@codemirror/lang-javascript@6.2.5`, `@codemirror/lang-python@6.2.1`, `prettier@3.8.3`, `@prettier/plugin-xml@3.4.2`, `papaparse@5.5.3`, and `@astral-sh/ruff-wasm-web@0.15.13`.
- [x] Build JSON, XML, JavaScript, CSV, and Python plugin-owned runtime bundles under `editor-workbench/plugins/**/runtime/`.

## Markdown Plugin Checklist

- [x] Register Markdown language definition.
- [x] Infer Markdown language from `.md`, `.markdown`, `.mdown`, and `.mkd`.
- [x] Provide CodeMirror Markdown highlighter.
- [x] Provide sanitized HTML renderer.
- [x] Provide sanitized HTML exporter.
- [x] Render Mermaid and Graphviz fenced code blocks inline for preview/export.
- [x] Failed diagram blocks render as visible escaped placeholders without breaking the whole Markdown document.
- [x] Avoid Markdown linting, transforms, PDF, PNG, or remote rendering in this phase.

## Diagram Plugin Checklist

- [x] Register Mermaid language `mermaid` for `.mmd` and `.mermaid`.
- [x] Add Mermaid SVG preview renderer and SVG exporter.
- [x] Initialize Mermaid with `startOnLoad: false` and `securityLevel: "strict"`.
- [x] Sanitize Mermaid SVG before display/export.
- [x] Register Graphviz language `graphviz` for `.dot` and `.gv`.
- [x] Add CodeMirror DOT highlighting through the vendored DOT language package.
- [x] Add Graphviz SVG preview renderer and SVG exporter through local `@viz-js/viz` WASM.
- [x] Sanitize Graphviz SVG before display/export.
- [x] Register SVG language `svg` for `.svg` files.
- [x] Add CodeMirror HTML/XML-style highlighting for SVG.
- [x] Add SVG preview renderer and sanitized SVG exporter.
- [x] Strip scriptable and external-reference SVG surfaces before display/export.

## Structured Language Plugin Checklist

- [x] Register JSON language and lazy CodeMirror JSON highlighter.
- [x] Add JSON parse linter, tree preview, prettify transform, and compact transform.
- [x] Register XML language and lazy CodeMirror XML highlighter.
- [x] Add XML DOMParser linter, tree preview, Prettier XML transform, and compact transform.
- [x] Register JavaScript language and lazy CodeMirror JavaScript highlighter.
- [x] Add JavaScript Prettier transform using local standalone Prettier plus Babel/Estree plugins.
- [x] Register CSV language and add PapaParse-backed row-width linter and scrollable table preview.
- [x] Register Python language and lazy CodeMirror Python highlighter.
- [x] Add Python formatter transform using local Ruff WASM.
- [x] Add packaged plugin default auto-load entries for JSON, XML, JavaScript, CSV, and Python.

## SVG Export And Viewer Checklist

- [x] Add sanitized SVG source to PNG exporter for the SVG plugin.
- [x] Rasterize SVG through local browser canvas with viewBox/dimension detection, fallback sizing, and max-side cap.
- [x] Add pan/zoom controls for standalone SVG render results in `render-shell.js`.
- [x] Verify pan/zoom with SVG, Mermaid, and Graphviz standalone previews.

## Acceptance Checklist

### Local Mode

- [x] Opening `editor-workbench/index.html` from disk starts the editor.
- [x] User can type and edit text.
- [x] User can open a local text file.
- [x] User can download the current source text.
- [x] Autosave restores the last edited text.
- [x] Plugin manager opens and shows known plugin configuration, even if empty.
- [x] CodeMirror editor loads from local bundled files.
- [x] Markdown plugin auto-loads and contributes language, preview, and export actions.
- [x] Manual render refresh updates open render windows.
- [x] Auto-refresh updates open render windows after 3 seconds of stable source.
- [x] Plugin manager can upload and load a local `.js` plugin file in local-file mode.
- [x] Mermaid, Graphviz, and SVG plugins auto-load from packaged plugin paths.
- [x] Mermaid standalone preview/export renders sanitized SVG.
- [x] Graphviz standalone preview/export renders sanitized SVG.
- [x] SVG preview/export sanitizes script, event-handler, remote image, and unsafe-link content.
- [x] Markdown preview/export renders Mermaid and Graphviz fenced diagrams inline.
- [x] JSON plugin auto-loads and supports lint, tree preview, prettify, and compact transforms.
- [x] XML plugin auto-loads and supports lint, tree preview, prettify, and compact transforms.
- [x] JavaScript plugin auto-loads and supports Prettier formatting.
- [x] CSV plugin auto-loads and supports row-width linting and scrollable table preview.
- [x] Python plugin auto-loads and supports Ruff formatting.
- [x] SVG plugin exports sanitized SVG source as PNG.
- [x] Standalone SVG render windows support pan and zoom controls.
- [x] No external network requests are made by app code.

### Extension Mode

- [ ] `editor-workbench/` can be loaded as an unpacked Edge/Chrome extension.
- [ ] Clicking the extension action opens `editor.html`.
- [ ] The editor works in the extension page.
- [x] No host permissions are requested.
- [x] No network permissions are requested.
- [x] CSP does not require inline scripts, remote scripts, or `unsafe-eval`.
- [x] CSP permits local Graphviz WASM through `'wasm-unsafe-eval'` while keeping `connect-src 'none'`.
- [x] No external network requests are made by app code.

### Plugin Infrastructure

- [x] Known plugin list is stored in IndexedDB.
- [x] Plugin auto-load setting is stored in IndexedDB.
- [x] Plugin paths are validated.
- [x] Plugin scripts are loaded only through classic script injection.
- [x] Loaded plugins are registered from `window.EditorPlugins`.
- [x] Loaded plugins can be deactivated at registry level.
- [x] Highlighter, linter, transformer, renderer, and exporter contracts are documented and represented in code.
- [x] Uploaded plugin files are loaded via classic script injection from a local Blob URL, not by `eval`, `new Function`, or dynamic import.
- [x] Packaged Markdown, Mermaid, Graphviz, and SVG plugin paths are included in the default known plugin list.
- [x] Packaged JSON, XML, JavaScript, CSV, and Python plugin paths are included in the default known plugin list.
