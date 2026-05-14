# Third-Party Runtime Libraries

The runtime files under `editor-workbench/libs/` are generated local bundles. They must be packaged with the app and must not be loaded from a CDN at runtime.

## Bundled Dependencies

- CodeMirror packages: MIT license
  - `codemirror`
  - `@codemirror/state`
  - `@codemirror/view`
  - `@codemirror/lang-markdown`
- CodeMirror HTML language package: MIT license
  - `@codemirror/lang-html`
- Marked: MIT license
- DOMPurify: Apache-2.0 OR MPL-2.0 license
- Mermaid: MIT license
- Viz.js / Graphviz runtime: MIT license for `@viz-js/viz`; generated bundle legal notes are emitted beside the bundle.
- CodeMirror DOT language support: MIT license
  - `@viz-js/lang-dot`

Generated bundles may include additional package notices in adjacent `.LEGAL.txt` files. Keep those files with the matching bundles when packaging the app.

Regenerate the local bundles with:

```powershell
npm install
npm run build:libs
```
