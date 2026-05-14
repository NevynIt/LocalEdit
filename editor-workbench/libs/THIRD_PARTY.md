# Third-Party Runtime Libraries

The runtime files under `editor-workbench/libs/` are generated local bundles. They must be packaged with the app and must not be loaded from a CDN at runtime.

## Bundled Dependencies

- CodeMirror packages: MIT license
  - `codemirror`
  - `@codemirror/state`
  - `@codemirror/view`
  - `@codemirror/lang-markdown`
- Marked: MIT license
- DOMPurify: Apache-2.0 OR MPL-2.0 license

Regenerate the local bundles with:

```powershell
npm install
npm run build:libs
```

