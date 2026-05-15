# LocalEdit White Paper: Text-Centered Language Workbench Architecture

## Executive Summary

LocalEdit should evolve from a CodeMirror-centered local editor into a **text-centered, language-mediated editor workbench**.

The central architectural decision is that the application owns the canonical document as:

```text
text blob + language id + metadata + diagnostics + state
```

Editors, renderers, transformers, exporters, linters, and visual tools do not own the document. They operate on text in declared languages. This keeps the application local-first, transparent, recoverable, and compatible with both direct `file://` hosting and packaged browser-extension hosting.

This white paper explains the revised architecture, the design decisions behind it, and the concrete changes required in the current application.

---

## 1. Context and Motivation

The original LocalEdit concept is a local/extension dual-hosted editor workbench for structured text languages. It is intended to run without a backend, without external web resources, and without network access.

The current implementation direction is centered around CodeMirror as the primary editor. That is a sensible starting point, but it becomes limiting when the application should support other editing experiences, such as:

- visual mind-map editing with jsMind
- tree editors
- graph editors
- outline editors
- form-based editors for structured data
- specialized domain-specific editors

The goal is not to abandon text. The goal is to make text the stable source of truth while allowing multiple ways to edit, transform, inspect, render, and export it.

---

## 2. Core Architectural Principle

The main principle is:

> Text remains the canonical source of truth. Languages are the contracts. Pipelines are explicit compositions of language-to-language operations.

The application maintains the current document. Plugins operate on that document through declared capabilities.

```text
Current document
  - text
  - language id
  - metadata
  - diagnostics
  - dirty/saved state
  - autosave state
```

Every operation is mediated by a language declaration.

Examples of languages:

```text
plain-text
markdown
indented-tree
localedit-graph-json
jsmind-json
freemind-xml
mermaid
svg
html
json
yaml
localedit-pipeline
```

The language id is the common link between plugin contributions.

---

## 3. Conceptual Model

LocalEdit becomes a language workbench with these core entities:

```text
Application
  owns the canonical document and orchestration services

Document
  text + language + metadata + state

Language
  named text format understood by one or more plugins

Plugin
  package that contributes capabilities

Contribution
  editor, editor extension, transformer, renderer, exporter, linter, terminal step, pipeline

Pipeline
  explicit chain of compatible steps from one language to another, ending in an action
```

A simple flow:

```text
Document text in Language A
  → Transformer: Language A to Language B
  → Transformer: Language B to Language C
  → Renderer / Exporter / Editor / Replace Current / Open New Document
```

---

## 4. Revised Plugin Model

Plugins should not be treated as all-or-nothing capability blocks. Instead, each plugin can expose many **contributions**, and each contribution declares its own dependencies.

This allows partial activation. A plugin may load successfully and expose some capabilities even when other capabilities are unavailable because optional dependencies are missing.

### 4.1 Plugin

A plugin is a package of possible contributions.

Example:

```js
{
  id: "mindmap-tools",
  name: "Mind Map Tools",
  version: "0.1.0",

  contributes: {
    languages: [],
    editors: [],
    editorExtensions: [],
    transformers: [],
    renderers: [],
    exporters: [],
    linters: [],
    terminalSteps: [],
    pipelines: []
  }
}
```

### 4.2 Contribution-Level Dependencies

Each contribution should declare its own requirements.

Example:

```js
{
  id: "jsmind-renderer",
  kind: "renderer",
  accepts: ["jsmind-json"],
  requires: [
    { kind: "language", id: "jsmind-json" },
    { kind: "runtime", id: "jsmind", version: ">=0.8.7" }
  ]
}
```

The `version` field is optional. When present, use a simple SemVer-style constraint such as:

```text
>=0.8.7
=0.8.7
```

A contribution can be in one of these states:

```text
available
unavailable: missing dependency
unavailable: incompatible dependency version
disabled by user
failed to initialize
```

This is better than making the whole plugin unavailable when only one part is missing.

---

## 5. Languages

Languages are first-class registry entries.

A language describes a text format. It does not necessarily define a full parser, but it gives the system a stable identifier for compatibility checks.

Example:

```js
{
  id: "indented-tree",
  name: "Indented Tree",
  mediaType: "text/x-localedit-indented-tree",
  fileExtensions: [".tree", ".itree"],
  description: "A simple indentation-based tree format."
}
```

Languages can be:

- user-facing source formats
- intermediate transformation formats
- renderer-specific formats
- exporter-specific formats
- configuration formats
- pipeline definition formats
- ...

Intermediate languages should remain explicit. They are not merely internal implementation details. They are part of the value of the application because users can inspect, edit, save, debug, and reuse them.

---

## 6. Editors

Editors are interactive tools that modify text in a declared language.

The current CodeMirror editor should become the first editor contribution, not a hard-coded application component.

Examples:

```text
CodeMirror editor
  accepts many languages
  edits raw text

Textarea editor
  fallback editor
  edits raw text

jsMind editor
  accepts indented-tree or jsmind-json
  edits visually
  writes back serialized text

Tree table editor
  accepts indented-tree or JSON tree
  edits visually
  writes back text
```

### 6.1 Editor Interface

All editors should expose a common minimal interface:

```js
{
  mount(container),
  destroy(),

  setText(text, languageId, context),
  getText(),

  onTextChanged(callback),

  setDiagnostics(diagnostics),

  focus()
}
```

Text-oriented editors may expose optional capabilities:

```js
{
  getSelection(),
  replaceSelection(text),
  selectRange(from, to),
  setLanguage(languageId, context)
}
```

Visual editors may expose optional capabilities:

```js
{
  getSelectedNode(),
  selectNode(nodeId),
  expandAll(),
  collapseAll()
}
```

The app should only depend on the common interface. Optional features should be capability-checked.

### 6.2 Editor Switching

The application owns the text. When switching editors:

```text
current editor getText()
  → application updates canonical document
  → old editor destroyed
  → new editor mounted
  → application passes canonical text and language to new editor
```

The application should remain the authority for the current document state.

---

## 7. Editor-Specific Extensions

Some contributions are not standalone editors. They extend a specific editor.

Examples:

```text
CodeMirror Markdown highlighter
CodeMirror JSON language support
CodeMirror Mermaid syntax highlighting
CodeMirror lint gutter integration
jsMind theme extension
jsMind command extension
```

These should be modeled as editor extensions.

Example:

```js
{
  id: "codemirror-markdown-support",
  kind: "editor-extension",
  editor: "codemirror",
  languages: ["markdown"],
  requires: [
    { kind: "editor", id: "codemirror" },
    { kind: "language", id: "markdown" }
  ]
}
```

This avoids forcing every language plugin to know every editor, and avoids forcing every editor to support every language internally.

---

## 8. Transformers

Transformers take text in one language and output text in another language, or the same language.

Examples:

```text
markdown → indented-tree
indented-tree → jsmind-json
indented-tree → localedit-graph-json
localedit-graph-json → graphml
json → formatted-json
yaml → json
mermaid → svg
markdown → html
```

### 8.1 Transformer Contract

```js
{
  id: "markdown-to-outline",
  kind: "transformer",
  inputLanguage: "markdown",
  outputLanguage: "indented-tree",

  parameters: {
    minHeadingLevel: { type: "number", default: 1 },
    maxHeadingLevel: { type: "number", default: 6 },
    includeListItems: { type: "boolean", default: false }
  },

  transform({ text, languageId, params, context }) {
    return {
      text: "...",
      languageId: "indented-tree",
      diagnostics: []
    };
  }
}
```

### 8.2 Parameters

Transformers, renderers, exporters, editors, and terminal steps may all accept parameters.

Every parameter must have a default value. This is important because:

- pipelines remain executable even when options are omitted
- old pipeline definitions survive when new parameters are added
- UI controls can be generated automatically
- plugins can be invoked programmatically without excessive boilerplate

A pipeline stores only the chosen parameter overrides. Missing values are resolved from contribution defaults.

---

## 9. Renderers

Renderers are read-only views over text in a declared language.

Examples:

```text
markdown → HTML preview
mermaid → diagram preview
indented-tree → read-only jsMind map
localedit-graph-json → Cytoscape graph explorer
svg → SVG preview
json → tree/table viewer
```

Renderers should not modify the canonical document directly. They may produce:

- visual output
- diagnostics
- navigation events
- selection events
- warnings
- exportable rendered output

Renderer contract:

```js
{
  id: "cytoscape-graph-renderer",
  kind: "renderer",
  accepts: ["localedit-graph-json"],

  parameters: {
    layout: { type: "string", default: "cose" }
  },

  render({ text, languageId, params, container, context }) {
    return {
      diagnostics: []
    };
  }
}
```

---

## 10. Exporters

Exporters take text in a declared language and produce a downloadable file blob.

Examples:

```text
markdown → .html
mermaid → .svg
localedit-graph-json → .json
localedit-graph-json → .graphml
indented-tree → .mm FreeMind file
svg → .svg
html → .html
```

Exporter contract:

```js
{
  id: "freemind-exporter",
  kind: "exporter",
  accepts: ["freemind-xml"],

  parameters: {
    prettyPrint: { type: "boolean", default: true }
  },

  export({ text, languageId, params, context }) {
    return {
      blob: new Blob([text], { type: "application/xml" }),
      filename: "mindmap.mm",
      diagnostics: []
    };
  }
}
```

Exporters are terminal steps in pipelines.

---

## 11. Linters and Diagnostics

Linters analyse text and produce diagnostics.

However, diagnostics should not be limited to linters. Any contribution that processes text may produce diagnostics:

```text
editor extension: syntax diagnostics
transformer: conversion warnings
renderer: rendering errors
exporter: unsupported feature warnings
linter: validation errors
terminal step: write-back warnings
```

Diagnostics should be reported to the application through a shared diagnostics service exposed in the plugin context.

```js
context.diagnostics.publish(source, diagnostics);
context.diagnostics.clear(source);
context.diagnostics.subscribe(callback);
```

The application aggregates diagnostics by source and forwards the relevant diagnostics to the active editor or renderer for display.

Diagnostic shape:

```js
{
  source: "markdown-to-outline",
  severity: "warning",
  message: "Heading level skipped from h2 to h4.",
  languageId: "markdown",

  range: {
    start: { line: 12, column: 1 },
    end: { line: 12, column: 20 }
  },

  target: {
    kind: "heading",
    ref: "heading:introduction"
  }
}
```

Recommended severities:

```text
error
warning
information
observation
```

A diagnostic may contain both a text range and a language-specific target reference. The text range supports highlighting in text editors. The target reference supports navigation to semantic objects in visual editors, renderers, and diagnostics views.

Each language should define a textual reference scheme for identifying objects inside documents of that language. Examples include:

```text
node:customer-system
edge:a->b
path:/Root/Child
step[2]
```

Language plugins may provide resolver functions that map these references back to text ranges or semantic objects.

Diagnostics should indicate:

* source contribution
* severity
* message
* language to which the diagnostic applies
* optional text range
* optional target reference
* optional pipeline step
* optional fix action, later

Migration note for current implementations:

```text
During migration, diagnostics may also be accepted in a legacy offset form
with from/to positions. The diagnostics service should normalize these legacy
entries into the canonical shape above while preserving offset information
where available.
```

---

## 12. Pipelines

A pipeline is an explicit chain of compatible steps.

The pipeline starts with a source language. Each step consumes the output language of the previous step. The final step determines the outcome.

Example:

```text
markdown
  → markdown-to-outline
  → outline-to-jsmind-json
  → jsmind-renderer
```

Example:

```text
indented-tree
  → indented-tree-to-localedit-graph-json
  → cytoscape-renderer
```

Example:

```text
indented-tree
  → indented-tree-to-freemind-xml
  → freemind-exporter
```

Example:

```text
markdown
  → markdown-to-outline
  → open-new-document
```

### 12.1 Pipeline Validation

The application should validate pipelines mechanically:

```text
Step 1 input must match pipeline source language.
Step N input must match Step N-1 output.
Final step must be a terminal-capable contribution.
All required dependencies must be available.
All parameters must be valid or defaultable.
```

### 12.2 Terminal Steps

Write-back behavior is defined by the final step of the chain.

Terminal step types include:

```text
renderer
exporter
editor
replace-current-text
open-new-document
copy-to-clipboard
```

This is preferable to a separate pipeline-level write-back flag. The pipeline says what happens by selecting the final contribution.

### 12.3 Explicit Intermediate Languages

Intermediate languages should be visible in the UI and in pipeline definitions.

A good UI pattern:

```text
Markdown
  ↓ Extract heading outline
Indented Tree
  ↓ Convert tree to graph JSON
LocalEdit Graph JSON
  ↓ Render graph
Cytoscape Renderer
```

Users should be able to open intermediate results as documents where useful.

---

## 13. Pipelines as a Language

Pipeline definitions should themselves be text documents in a registered language.

Example language id:

```text
localedit-pipeline
```

This allows LocalEdit to edit its own pipeline definitions using the same workbench.

Benefits:

- pipelines can be versioned as text
- pipelines can be shared as files
- pipelines can be linted
- pipelines can be rendered visually
- pipelines can be transformed
- pipelines can be edited with CodeMirror or a future visual pipeline editor

Example YAML-like pipeline definition:

```yaml
id: view-markdown-as-mindmap
name: View Markdown as Mind Map
input: markdown

steps:
  - use: markdown-to-outline
    params:
      includeListItems: false

  - use: outline-to-jsmind-json

  - use: jsmind-renderer
```

Example compact DSL:

```text
pipeline "View Markdown as Mind Map"
from markdown

markdown-to-outline {
  includeListItems: false
}

outline-to-jsmind-json

render jsmind-renderer
```

The initial implementation should use a simple JSON or YAML-like format. A custom DSL can come later.

---

## 14. jsMind Use Case

jsMind is a good first visual editor/renderer candidate because it maps naturally to the tree/mind-map use case.

### 14.1 Renderer Mode

First implementation should be read-only:

```text
indented-tree
  → indented-tree-to-jsmind-json
  → jsmind-renderer
```

This is low-risk. It does not require visual editing or write-back.

### 14.2 Editor Mode

Second implementation can support visual editing:

```text
indented-tree
  → indented-tree-to-jsmind-json
  → jsmind-editor
  → jsmind-json-to-indented-tree
  → replace-current-text
```

Or more simply, the jsMind editor can accept `indented-tree` directly by handling parse and serialization internally.

However, visual editors need an explicit round-trip policy.

They should declare whether editing is:

```text
lossless
lossy but safe
lossy with warning
not write-back capable
```

Potential losses include:

- comments
- formatting
- ordering
- unknown attributes
- metadata
- style annotations
- unsupported node types

The editor should warn before replacing source text if the round-trip is not lossless.

---

## 15. Impact on the Current Application

The existing application should not be restarted. It should be refactored incrementally.

The current CodeMirror wrapper is already a useful seam. The major change is to move from a hard-coded editor and simple plugin registry toward a contribution registry and pipeline executor.

### 15.1 Current Assumptions to Change

Current assumption:

```text
The application has one main CodeMirror editor.
```

New assumption:

```text
The application has a current editor selected from registered editor contributions.
```

Current assumption:

```text
Plugins expose highlighters, linters, transformers, renderers, exporters.
```

New assumption:

```text
Plugins expose contribution types, each with its own dependencies, parameters, compatibility declarations, and activation state.
```

Current assumption:

```text
Transformers are invoked directly from menus.
```

New assumption:

```text
Transformers are steps that can be used in pipelines, and pipeline terminal steps determine the outcome.
```

Current assumption:

```text
The current selected language drives available tools.
```

New assumption:

```text
The current selected language drives available editors, pipelines, direct renderers, direct exporters, linters, and transformations.
```

---

## 16. Required Refactoring

### 16.1 Introduce a Language Registry

Add a registry for language definitions.

Responsibilities:

- register languages from core and plugins
- infer language from file extension
- provide display names
- validate known language ids
- support intermediate languages

Suggested file:

```text
core/language-registry.js
```

### 16.2 Convert CodeMirror into an Editor Contribution

Refactor current `EditorCore` into:

```text
core/editor-manager.js
plugins/codemirror/codemirror-editor.js
plugins/textarea/textarea-editor.js
```

The editor manager should:

- list available editors for the current language
- create/destroy editor instances
- switch editors
- synchronize editor text with the canonical document
- pass diagnostics to the active editor

### 16.3 Add Editor Extension Contributions

Move CodeMirror-specific highlighters and language support into editor extensions.

Avoid generic plugin contracts such as:

```js
getCodeMirrorExtensions()
```

at the workbench level.

Instead, make them CodeMirror editor extensions.

```js
{
  kind: "editor-extension",
  editor: "codemirror",
  languages: ["markdown"],
  createExtension(context) { ... }
}
```

### 16.4 Introduce Contribution Registry

Replace or extend the current plugin registry with a contribution registry.

Responsibilities:

- register plugins
- register contributions
- resolve contribution-level dependencies
- track availability state
- expose active contributions by kind and language
- report missing dependencies
- allow disabling contributions individually

Suggested file:

```text
core/contribution-registry.js
```

### 16.5 Add Parameter Schema Support

Add a simple parameter schema model.

Minimum supported types:

```text
string
number
integer
boolean
enum
```

Each parameter requires:

```text
type
default
optional label
optional description
optional enum values
```

Suggested file:

```text
core/parameter-schema.js
```

### 16.6 Add Pipeline Registry

Add a registry for pipeline definitions.

Responsibilities:

- register pipelines from plugins
- load user-defined pipelines from IndexedDB or files
- validate pipeline steps
- expose executable pipelines for the current language
- show missing dependencies
- store parameter overrides

Suggested file:

```text
core/pipeline-registry.js
```

### 16.7 Add Pipeline Executor

Add a runtime executor.

Responsibilities:

- execute steps in sequence
- pass text, language, parameters, and context
- collect diagnostics from every step
- expose intermediate results
- call terminal step
- handle failure and partial diagnostics

Suggested file:

```text
core/pipeline-executor.js
```

Execution context:

```js
{
  sourceDocument,
  currentText,
  currentLanguageId,
  params,
  diagnostics,
  services: {
    languageRegistry,
    contributionRegistry,
    storage,
    download,
    renderShell,
    editorManager
  }
}
```

Use `context.diagnostics` as the canonical diagnostics API. For migration,
`context.services.diagnostics` may be provided as an alias to the same service.

### 16.8 Add Terminal Steps

Implement terminal steps as first-class contributions.

Initial terminal steps:

```text
replace-current-text
open-new-document
open-editor
copy-to-clipboard
```

Renderers and exporters are also terminal-capable.

### 16.9 Update Renderer Model

Renderers should be callable both directly and as pipeline terminal steps.

The render shell should receive:

```text
renderer id
input text
input language id
parameters
pipeline metadata, if applicable
```

### 16.10 Update Exporter Model

Exporters should be callable both directly and as pipeline terminal steps.

Export should remain local and Blob-based.

### 16.11 Update Diagnostics Service

Diagnostics should collect results from:

```text
linters
editors
editor extensions
transformers
renderers
exporters
terminal steps
pipeline validation
pipeline execution
```

Diagnostics should be grouped by source and, where applicable, by pipeline step.

### 16.12 Add Pipeline Definition Language

Create an initial language for pipeline definitions.

Start with JSON or YAML-like syntax.

Suggested initial language id:

```text
localedit-pipeline-json
```

Later aliases or higher-level syntax can be added:

```text
localedit-pipeline
localedit-pipeline-yaml
localedit-pipeline-dsl
```

Add:

- linter for pipeline validation
- renderer for visual pipeline flow
- optional editor extension for CodeMirror
- optional transformer from pipeline DSL to pipeline JSON

---

## 17. Suggested Implementation Sequence

### Phase 1: Stabilize Core Contracts

1. Add language registry.
2. Add contribution registry with per-contribution dependencies.
3. Keep existing plugins working through compatibility adapters.
4. Define common contribution shapes.
5. Introduce diagnostics service and legacy-to-canonical diagnostic normalization.
6. Define diagnostics shape.

### Phase 2: Extract Editors

1. Introduce editor manager.
2. Convert CodeMirror to editor contribution.
3. Add textarea fallback as editor contribution.
4. Move CodeMirror-specific language/highlighting support to editor extensions.
5. Add editor selector UI.

### Phase 3: Add Pipelines

1. Add pipeline registry.
2. Add parameter schema support.
3. Add pipeline validation.
4. Add pipeline executor.
5. Add terminal steps:
   - render
   - export
   - replace current text
   - open new document
6. Show executable pipelines for the current language.

### Phase 4: Add Explicit Intermediate Languages

1. Register intermediate languages.
2. Allow users to inspect intermediate outputs.
3. Add “open intermediate result as document.”
4. Show pipeline language flow in the UI.

### Phase 5: Add Pipeline-as-Document

1. Add pipeline definition language.
2. Add pipeline linter.
3. Add pipeline renderer.
4. Allow loading/saving user pipelines.
5. Allow user pipelines to appear in the action menu.

### Phase 6: Add jsMind

1. Vendor jsMind locally.
2. Add `jsmind-json` language.
3. Add `indented-tree → jsmind-json` transformer.
4. Add read-only jsMind renderer.
5. Add pipeline: “View as Mind Map.”
6. Later add jsMind editor with write-back.
7. Add round-trip diagnostics and lossiness warnings.

---

## 18. Recommended Initial Contribution Shapes

### 18.1 Language

```js
{
  kind: "language",
  id: "indented-tree",
  name: "Indented Tree",
  fileExtensions: [".tree"],
  mediaType: "text/x-localedit-indented-tree"
}
```

### 18.2 Editor

```js
{
  kind: "editor",
  id: "codemirror",
  name: "CodeMirror",
  accepts: ["*"],
  requires: [
    { kind: "runtime", id: "codemirror" }
  ],

  createEditor(context) {
    return {
      mount(container) {},
      destroy() {},
      setText(text, languageId, context) {},
      getText() {},
      onTextChanged(callback) {},
      setDiagnostics(diagnostics) {},
      focus() {}
    };
  }
}
```

### 18.3 Transformer

```js
{
  kind: "transformer",
  id: "indented-tree-to-jsmind-json",
  name: "Indented Tree to jsMind JSON",
  inputLanguage: "indented-tree",
  outputLanguage: "jsmind-json",

  parameters: {},

  transform({ text, params, context }) {
    return {
      text: "...",
      languageId: "jsmind-json",
      diagnostics: []
    };
  }
}
```

### 18.4 Renderer

```js
{
  kind: "renderer",
  id: "jsmind-renderer",
  name: "jsMind Renderer",
  accepts: ["jsmind-json"],
  requires: [
    { kind: "runtime", id: "jsmind" }
  ],

  parameters: {
    theme: { type: "string", default: "primary" }
  },

  render({ text, languageId, params, container, context }) {
    return {
      diagnostics: []
    };
  }
}
```

### 18.5 Exporter

```js
{
  kind: "exporter",
  id: "freemind-exporter",
  name: "FreeMind Exporter",
  accepts: ["freemind-xml"],

  parameters: {},

  export({ text, languageId, params, context }) {
    return {
      blob: new Blob([text], { type: "application/xml" }),
      filename: "mindmap.mm",
      diagnostics: []
    };
  }
}
```

### 18.6 Linter

```js
{
  kind: "linter",
  id: "indented-tree-linter",
  name: "Indented Tree Linter",
  accepts: ["indented-tree"],

  lint({ text, languageId, context }) {
    return [];
  }
}
```

Migration note:

```text
Legacy linter output compatibility is intentionally dropped. Linters must
return Diagnostic[] directly. The { diagnostics: [...] } return shape is
removed in this refactor.
```

### 18.7 Pipeline

```js
{
  kind: "pipeline",
  id: "view-indented-tree-as-mindmap",
  name: "View as Mind Map",
  inputLanguage: "indented-tree",

  steps: [
    {
      use: "indented-tree-to-jsmind-json",
      params: {}
    },
    {
      use: "jsmind-renderer",
      params: {
        theme: "primary"
      }
    }
  ]
}
```

---

## 19. User Experience Implications

The UI should distinguish:

```text
Edit with...
View / render as...
Transform to...
Export as...
Run pipeline...
Inspect intermediate result...
```

For a selected language, the application should show:

- compatible editors
- compatible linters
- direct renderers
- direct exporters
- direct transformers
- compatible pipelines
- unavailable capabilities with reasons

Example for `indented-tree`:

```text
Editors:
  - CodeMirror
  - Textarea
  - jsMind Visual Editor, if installed

Render:
  - jsMind Mind Map
  - Cytoscape Graph, via pipeline

Transform:
  - To jsMind JSON
  - To LocalEdit Graph JSON
  - To FreeMind XML

Export:
  - FreeMind .mm, via pipeline
  - JSON tree

Pipelines:
  - View as Mind Map
  - View as Graph
  - Export as FreeMind
```

---

## 20. Security and Containment Implications

This revised architecture remains compatible with the existing security model:

```text
no backend
no external URLs
no CDN
no network access
local resources only
extension CSP compatible
trusted packaged plugins
```

The main security concern remains exfiltration prevention, not protection against trusted plugins corrupting the workspace.

Contribution-level dependencies improve security review because a plugin can expose only the safe subset of capabilities available in a given host configuration.

Pipeline definitions are data, not executable code. They should reference registered contributions by id and pass parameter values. They should not contain arbitrary JavaScript.

---

## 21. Key Design Decisions

### Decision 1: Text is canonical

All documents remain text blobs in declared languages.

### Decision 2: Language is the interoperability contract

Editors, transformers, renderers, exporters, linters, and pipelines all declare input and output languages.

### Decision 3: Editors are plugins

CodeMirror is no longer the application. It is one editor contribution.

### Decision 4: Dependencies are per contribution

Plugins may partially activate. Capabilities are individually available, unavailable, disabled, or failed.

### Decision 5: Pipelines are explicit

Intermediate languages are visible and inspectable.

### Decision 6: Final pipeline step defines the outcome

Render, export, edit, replace, open new document, and copy are terminal steps.

### Decision 7: Parameters are schema-based and defaulted

Every parameter must have a default value.

### Decision 8: Pipelines are themselves documents

Pipeline definitions become a registered language and can be edited, linted, rendered, and versioned.

---

## 22. Development Guidance

Do not restart the application. Refactor incrementally.

The most important architectural move is to prevent CodeMirror-specific assumptions from spreading further. Extract the editor role now, before adding jsMind or other visual editors.

Use compatibility layers where needed. Existing transformer, renderer, linter, and exporter concepts can remain, but they should be normalized into contribution records with declared language compatibility, parameters, dependencies, and diagnostics.

Avoid building a complex visual pipeline editor first. Start with registered pipelines exposed as menu actions. Once the pipeline language and executor are stable, add visual editing.

---

## 23. Minimal Target Architecture After Refactoring

This section describes the post-refactor target structure. Several current
modules are expected to evolve rather than be replaced one-for-one. For example,
plugin-registry.js can evolve into or be wrapped by contribution-registry.js,
diagnostics-manager.js can evolve into diagnostics-service.js, and editor-core.js
can be extracted behind editor-manager.js.

```text
core/
  app-core.js
  document-model.js
  language-registry.js
  contribution-registry.js
  editor-manager.js
  diagnostics-service.js
  parameter-schema.js
  pipeline-registry.js
  pipeline-executor.js
  storage.js
  file-open.js
  file-download.js
  render-shell-client.js

plugins/
  codemirror/
    codemirror-editor.js
    codemirror-markdown-extension.js
    codemirror-json-extension.js

  textarea/
    textarea-editor.js

  pipeline/
    pipeline-language.js
    pipeline-linter.js
    pipeline-renderer.js

  indented-tree/
    indented-tree-language.js
    indented-tree-linter.js

  jsmind/
    runtime/
      jsmind.js
      jsmind.css
    jsmind-language.js
    indented-tree-to-jsmind-json.js
    jsmind-renderer.js
    jsmind-editor.js
```

---

## 24. Conclusion

The revised architecture strengthens LocalEdit by making it a general-purpose local language workbench rather than a single code editor with extra tools.

It preserves the original strengths:

- local-first operation
- no backend
- no external runtime or network-loaded dependencies
- extension compatibility
- plugin extensibility
- text transparency

It adds a more scalable conceptual model:

- multiple editors
- explicit languages
- explicit intermediate formats
- contribution-level dependencies
- parameterized transformations
- reusable pipelines
- pipeline definitions as editable documents

The recommended path is incremental refactoring, not a restart. The current CodeMirror wrapper can become the first editor plugin, and the existing plugin concepts can evolve into a richer contribution registry and pipeline executor.

The resulting system will be able to support source editing, visual editing, mind maps, graphs, diagrams, previews, validations, conversions, exports, and user-defined workflows while keeping text as the recoverable, inspectable source of truth.
