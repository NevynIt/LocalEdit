# LocalEdit Viewer-to-Editor Evolution Whitepaper — Version 3 Tree-First Update

## Purpose

This whitepaper describes the next step after the read-only viewer improvements: extending selected viewers into actual editors.

The companion viewer-only paper keeps viewers strictly read-only. This paper assumes that the viewer foundation has been strengthened with consistent chrome, zoom, search, selection, source mapping, diagnostics overlays, inspectors, and view-state preservation.

The goal here is to define how some viewers can safely become visual or structured editors without losing LocalEdit's text-first architecture.

Version 3 adds a specific correction for Indented Tree Text: it is a **tree-first format**, not merely a graph format. Indentation defines the primary hierarchy; semantic links form a graph layer on top. Therefore, Indented Tree editing should start with tree/outline editing, then mind-map hierarchy editing, and only later graph-oriented relationship editing.

## Executive summary

Many LocalEdit viewers are natural candidates for visual editing:

- jsMind can become a mind-map editor.
- Cytoscape can become a graph editor.
- CSV table preview can become a table editor.
- JSON/XML tree viewers can become structured tree editors.
- Pipeline Flow can become a pipeline graph editor.
- Markdown preview can support limited structured editing of headings, tasks, and sections.
- Indented Tree tree/outline, mind-map, and relationship-graph views can become semantic model editors, with the tree as the primary editing surface.

However, this should not be done by letting every renderer directly mutate source text. Instead, LocalEdit should introduce a distinct editor-capability layer on top of the viewer layer.

The core rule should be:

> A viewer becomes an editor only when it can explain and validate how visual operations map back to the source document.

For tree-first formats, an additional rule applies:

> Do not flatten the source model into a generic graph editor unless the user is explicitly editing the graph layer. Preserve the parent/child tree as the main document structure.

## Relationship to the viewer-only phase

The viewer-only phase should establish:

- consistent viewer shell;
- whole-view zoom;
- text zoom for HTML/text-heavy viewers;
- selection model;
- inspector model;
- source ranges;
- diagnostics overlays;
- view-state persistence;
- search and filters.

The editor phase builds on those capabilities by adding:

- edit commands;
- source patches;
- undo/redo integration;
- validation before commit;
- conflict handling after source changes;
- safe write-back policies;
- editor-specific affordances.

## Design principle: text remains the source of truth

LocalEdit's core format is text. Visual editors should not replace that principle.

A visual editor should be a structured editing surface for a text document. It should produce changes that can be represented as source text changes.

Recommended principle:

```text
Source text -> parser/model -> visual editor -> edit command -> patch -> source text
```

The document text remains authoritative. The visual editor is a synchronized projection.


## Tree-first editing model for Indented Tree Text

Indented Tree Text has three conceptual layers:

```text
1. Tree layer: indentation-based parent/child hierarchy
2. Semantic node layer: ids, types, tags, attributes, details
3. Graph overlay layer: cross-links, views, styles, relationship projections
```

The editor strategy should respect those layers.

Primary editing surface:

- tree/outline editor;
- subtree-focused editor;
- mind-map hierarchy editor.

Secondary editing surface:

- relationship graph editor for cross-links;
- style/view rule editors;
- diagnostics and reference management panels.

This avoids a common modelling mistake: treating a tree source format as if it were only a graph. A graph editor is useful for exploring and editing semantic relationships, but it should not obscure the fact that moving a node in Indented Tree means changing indentation and parent/child position in the source text.

Recommended command grouping:

```text
Tree commands:
  add child
  add sibling
  rename node
  move subtree
  reorder siblings
  promote/demote node
  delete subtree

Semantic node commands:
  set id
  set type
  add/remove tag
  set attribute
  edit details

Graph overlay commands:
  add cross-link
  remove cross-link
  change link type
  repair unresolved link

Projection/style commands:
  add/edit %view rule
  add/edit %style rule
```

Tree commands should be implemented before graph overlay commands.


## Distinguish renderers from editors

Do not overload renderer contributions with write-back responsibilities.

Keep:

- `renderer`: read-only presentation and exploration;
- `editor`: source-authoritative editing surface;
- `editorExtension`: CodeMirror or other source editor extensions;
- `transformer`: conversion from one representation to another;
- `exporter`: file output;
- `pipeline`: composition of transformations, renderers, exporters, and terminal actions.

A viewer may share code with an editor, but the plugin contribution should clearly declare whether it is read-only or editable.

## Proposed editable viewer/editor contribution model

Add or extend editor contributions with richer optional capabilities:

```js
{
  id: "indented-tree-graph-editor",
  name: "Indented Tree Graph Editor",
  accepts: ["text.indented-tree"],
  createEditor(context) {
    return {
      mount(target, services) {},
      setDocument(documentModel) {},
      getDocument() {},
      applyExternalDocumentChange(documentModel) {},
      getViewState() {},
      setViewState(state) {},
      dispose() {}
    };
  },
  capabilities: {
    visualEditing: true,
    sourceBacked: true,
    supportsStructuredCommands: true,
    supportsSourcePatches: true,
    supportsUndoRedo: true,
    supportsDiagnostics: true
  }
}
```

The existing viewer lifecycle can provide the UI foundation, but editor contributions should explicitly participate in document mutation.

## Proposed editor services

Visual editors need a richer service surface than viewers.

Recommended shape:

```js
{
  getDocument(),
  requestApplyPatch(patch, options),
  requestReplaceDocument(documentModel, options),
  runDiagnostics(),
  reportSelection(selection),
  selectSourceRange(range),
  getViewState(),
  setViewState(state),
  pushUndoBoundary(label),
  setStatus(message),
  confirmRisk(message)
}
```

Write operations should flow through application services, not directly through arbitrary DOM handlers.

## Edit command model

Visual editors should generate semantic edit commands first, then convert commands into source patches.

Example command shapes:

```js
{
  type: "rename-node",
  nodeId: "req1",
  nextLabel: "System shall retain audit logs"
}
```

```js
{
  type: "add-edge",
  sourceId: "req1",
  targetId: "test1",
  edgeType: "verified-by"
}
```

```js
{
  type: "set-cell-value",
  row: 12,
  column: 3,
  value: "Approved"
}
```

The command processor should:

1. validate the command against the parsed model;
2. compute a source patch;
3. apply the patch through the application;
4. reparse the document;
5. update the visual editor;
6. show diagnostics if the result is invalid.

## Patch model

Use source patches rather than direct full-document replacement where possible.

Recommended patch shape:

```js
{
  sourceDocumentId,
  baseVersion,
  edits: [
    {
      from: 120,
      to: 145,
      text: "new text"
    }
  ],
  description: "Rename node req1"
}
```

Patch application should verify:

- document id matches;
- base version is still current or conflict resolution is possible;
- edit ranges are valid;
- edits do not overlap incorrectly;
- result parses if the language requires parse validity.

## Conflict handling

Visual editors must assume the source text can change outside the visual editor.

Examples:

- the user edits the source text directly;
- auto-refresh updates the rendered model;
- another tab contains the same document;
- a transform replaces the document.

Recommended behaviour:

- keep a `baseVersion` for every visual edit;
- reject or rebase patches if the source changed;
- reparse after source changes;
- preserve selection where possible using stable ids, not line numbers;
- if stable ids are absent, fall back to source ranges and labels;
- show a non-destructive conflict message if a visual edit can no longer be applied.

## Undo and redo

Visual edits should integrate with the same undo/redo model as source edits.

Recommended approach:

- every visual command becomes a labelled source patch;
- the application pushes an undo boundary before/after command groups;
- multi-step gestures, such as dragging several nodes, are grouped as one operation;
- temporary view-only changes, such as zoom, pan, filters, and expansion, are not part of document undo.

## Validation before commit

Every visual edit should be checked before committing to source text.

Validation layers:

1. **Structural validation:** command makes sense for the current model.
2. **Language validation:** resulting source parses correctly.
3. **Semantic validation:** ids, references, required fields, or schema constraints remain valid.
4. **Policy validation:** editor is allowed to modify this language and field.

If validation fails, the editor should not silently write invalid text. It should show a clear error and leave the source unchanged, unless the user explicitly accepts an invalid intermediate state for that editor type.

## Source mapping requirements

Visual editing depends on precise source mapping.

Each editable item should have:

```js
{
  id,
  kind,
  label,
  sourceRange,
  editableRanges: {
    label,
    id,
    type,
    tags,
    attributes,
    details,
    links
  }
}
```

The parser should not merely produce a display model. It should produce an editable model with ranges for individual fields.

## Editor state vs document state

Separate persistent document state from local view/editor state.

Document state:

- source text;
- semantic content;
- ids;
- labels;
- links;
- values;
- attributes;
- pipeline steps.

View/editor state:

- zoom;
- pan;
- selected item;
- filters;
- expanded/collapsed nodes;
- temporary layout;
- active search;
- open inspector tab.

Only document state should be written back to the source document. View state may be stored in workspace/session preferences, not in the document, unless a later explicit design allows view metadata in the document format.

## Candidate viewer-to-editor upgrades

## 1. jsMind Mind Map Editor

### Starting point

The jsMind viewer already supports:

- zoom;
- text scaling;
- fit/center;
- expand/collapse;
- temporary node dragging;
- hierarchy and cross-link overlays.

### Editor potential

A mind-map editor could support:

- rename node;
- add child;
- add sibling;
- delete node/subtree;
- reorder siblings;
- move subtree;
- edit type/tags/attributes/details where backed by Indented Tree;
- create cross-link;
- remove cross-link.

### Write-back targets

Possible targets:

- `json.jsmind` directly;
- `text.indented-tree` through the Indented Tree parser/model.

### Recommendation

Start with `json.jsmind` editing because the JSON tree structure is direct. Then add Indented Tree-backed mind-map editing once field-level source ranges are available.

For Indented Tree, treat the mind map as a hierarchy editor, not a graph editor. Prefer tree and semantic commands such as `rename-node`, `add-child`, `add-sibling`, `move-subtree`, `promote-node`, `demote-node`, and `set-tags` rather than raw string manipulation. Cross-link editing can be added later as an overlay.

## 2. Cytoscape Graph Editor

### Starting point

The Cytoscape viewer is a natural base for graph exploration and graph editing.

### Editor potential

A graph editor could support:

- add node;
- delete node;
- rename node;
- edit node type/tags/attributes;
- add edge;
- delete edge;
- edit edge type;
- move nodes in the visual layout;
- group or collapse subgraphs.

### Write-back targets

Possible targets:

- Cytoscape JSON;
- Indented Tree relationship overlays, not the primary tree hierarchy;
- JSON graph-like documents;
- pipeline definitions, if represented as graph nodes/edges.

### Recommendation

Do not make the shared Cytoscape viewer itself editable. Instead, create specific graph editors per source language:

- Cytoscape JSON Graph Editor;
- Indented Tree Relationship Graph Editor;
- Pipeline Graph Editor.

Each editor should define its own command-to-source mapping. For Indented Tree, Cytoscape should initially edit cross-links and relationship metadata, while hierarchy edits remain owned by the tree/outline or mind-map editor.

## 3. CSV Table Editor

### Starting point

CSV already has table preview code.

### Editor potential

A table editor could support:

- edit cell;
- add row;
- delete row;
- add column;
- delete column;
- rename header;
- sort as view-only or source-changing operation;
- fill down;
- copy/paste rectangular ranges.

### Write-back challenges

CSV editing is deceptively difficult because source-preserving edits must handle:

- delimiters;
- quotes;
- escaped quotes;
- newlines inside quoted fields;
- inconsistent row width;
- first-row-as-header mode;
- preserving comments if any custom dialect allows them.

### Recommendation

Start with safe full-document serialization for CSV edits, clearly preserving delimiter choice. Later, add source-range-preserving patches if needed.

Use table edit commands, not raw text edits.

## 4. JSON Tree Editor

### Starting point

The JSON plugin already parses JSON and has tree/graph preview helper functions.

### Editor potential

A JSON tree editor could support:

- edit scalar value;
- rename object key;
- add property;
- delete property;
- add array item;
- delete array item;
- reorder array items;
- copy/paste subtree;
- change value type.

### Write-back targets

- JSON source text.

### Recommendation

Start with a structured JSON editor that serializes formatted JSON after each edit. Preserve formatting later if source-preserving JSON patching becomes necessary.

Expose JSON Pointer for every editable node.

Commands can map naturally to JSON Patch-style operations:

```js
{ op: "replace", path: "/items/0/name", value: "New name" }
```

## 5. XML Tree Editor

### Starting point

The XML plugin parses XML and can render a tree.

### Editor potential

An XML tree editor could support:

- edit text node;
- edit attribute;
- add attribute;
- remove attribute;
- rename element;
- add child element;
- delete element;
- reorder children.

### Write-back challenges

XML editing needs care around:

- namespaces;
- attribute order;
- comments;
- CDATA;
- processing instructions;
- whitespace and formatting;
- schema validity.

### Recommendation

Defer XML editing until JSON and CSV editing patterns are proven. XML should require a strong source mapping and serialization strategy before becoming editable.

## 6. Pipeline Flow Editor

### Starting point

Pipeline Flow is currently static HTML but maps naturally to a graph-like editor.

### Editor potential

A pipeline editor could support:

- add step;
- remove step;
- reorder step;
- select contribution from registry;
- edit parameters through generated forms;
- validate input/output language compatibility;
- duplicate step;
- disable step if the pipeline schema supports it later.

### Write-back target

- `localedit.pipeline-json`.

### Recommendation

Pipeline editing is a good early candidate because the source format is JSON and the structure is simple.

Represent the pipeline as a graph or vertical stepper, but write back to JSON using structured commands.

## 7. Markdown Structured Editor

### Starting point

Markdown currently renders to sanitized HTML.

### Editor potential

A Markdown visual/structured editor could support limited operations:

- rename heading;
- move section;
- collapse section in editor view;
- toggle task checkbox;
- edit table cells;
- edit link target;
- edit image alt text;
- copy section.

### Recommendation

Do not attempt a full WYSIWYG Markdown editor initially.

Start with targeted source-backed commands:

- toggle task checkbox;
- rename heading;
- jump to section;
- move section later.

Markdown is flexible and ambiguous, so editing should be conservative.

## 8. Indented Tree Tree-First Semantic Editor

### Starting point

Indented Tree has the richest semantic model in the current project, but its primary structure is the indentation tree:

- parent/child hierarchy from indentation;
- ids;
- types;
- tags;
- attributes;
- details;
- cross-links;
- views;
- styles.

The hierarchy is not merely one edge type among many. It is the source structure that gives the document its name and its basic editing semantics.

### Editor potential

A tree-first semantic editor should support tree operations first:

- add child node;
- add sibling node;
- delete node/subtree;
- rename node;
- move subtree under a new parent;
- reorder siblings;
- promote/demote node by changing indentation;
- focus subtree;
- edit details block.

Then support semantic node operations:

- set or change id;
- change type;
- edit tags;
- edit attributes;
- validate duplicate ids;
- repair invalid identifiers.

Then support graph overlay operations:

- add/remove semantic link;
- edit link type;
- repair unresolved link target;
- inspect incoming/outgoing references;
- convert an unresolved textual link into a valid declared id target.

Finally support projection and style operations:

- edit `%view` rules;
- edit `%style` rules;
- preview view/style effects before committing.

### Recommended editor surfaces

Use three related editor surfaces over the same parsed model:

1. **Tree/Outline Editor** — primary source-backed editor for hierarchy and node fields.
2. **Mind-Map Editor** — hierarchy-first spatial editor for readable tree restructuring.
3. **Relationship Graph Editor** — secondary editor for cross-links and relationship analysis.

The tree/outline editor should be the first implementation target. It is closest to the source syntax and easiest to map to text patches.

The mind-map editor should come next because it still preserves the hierarchy-first model.

The relationship graph editor should come after stable tree editing because graph layout can tempt users to interpret all relationships as equivalent. In Indented Tree, hierarchy edges and cross-links must remain semantically different.

### Recommendation

Indented Tree should become the flagship visual editing target, but only after the parser exposes field-level editable ranges.

Implement in stages:

1. Tree/outline editor for hierarchy, labels, tags, attributes, and details.
2. Mind-map editor for hierarchy-first readable editing.
3. Relationship graph editor for cross-links and relationship repair.
4. View/style editors for `%view` and `%style` directives.

Do not make the relationship graph the primary Indented Tree editor.

## Required infrastructure

## A. Editable parsed models

Parsers should produce models that include both semantic values and source ranges.

Example:

```js
{
  id: "req1",
  label: "System shall log events",
  type: "requirement",
  tags: ["security"],
  sourceRange: { from: 120, to: 190 },
  parentInternalId: "n3",
  children: ["n8", "n9"],
  ranges: {
    lineIndent: { from: 118, to: 120 },
    id: { from: 120, to: 125 },
    type: { from: 126, to: 139 },
    label: { from: 140, to: 164 },
    tags: [{ value: "security", from: 165, to: 174 }],
    detailsBlock: { from: 191, to: 260 }
  }
}
```

## B. Command processors

Each editable language should have a command processor:

```js
processCommand(documentModel, command) => {
  patch,
  diagnostics,
  previewModel
}
```

The command processor is the only place that knows how a semantic action maps to source text.

## C. Tree-specific command processors

Indented Tree needs tree-aware command processing before graph-aware editing.

Example tree command:

```js
{
  type: "move-subtree",
  nodeId: "req1",
  nextParentId: "capability7",
  insertAfterSiblingId: "req0"
}
```

This is not a generic graph edge update. It changes indentation, sibling order, and the source span of an entire subtree.

Example graph overlay command:

```js
{
  type: "add-cross-link",
  sourceId: "req1",
  linkType: "verified-by",
  targetId: "test1"
}
```

This should modify the link declaration on the source node without changing the node's parent/child position.

Tree and graph overlay commands should remain separate because they have different source-editing semantics.

## D. Patch application service

The application should own patch application:

```js
applyPatch(documentId, patch, options) => result
```

The result should include:

- new document version;
- diagnostics;
- applied edits;
- conflict status;
- updated document model.

## E. Generated forms for structured properties

Visual editors need safe property editing without hand-building UI for every plugin.

Use parameter/schema-like definitions for editable fields:

```js
fields: {
  type: { type: "string", enumSource: "nodeTypes" },
  tags: { type: "string[]" },
  priority: { type: "enum", values: ["low", "medium", "high"] }
}
```

This can drive inspector forms for nodes, edges, pipeline steps, JSON values, and CSV columns.

## F. Diagnostics-aware editing

Editors should show diagnostics before and after edits.

Recommended flow:

1. user edits visually;
2. command processor predicts patch;
3. patch is applied;
4. document is reparsed;
5. diagnostics run;
6. editor highlights any new errors;
7. user can undo if needed.

## G. Safe mode and advanced mode

Some edits are clearly safe, others are risky.

Safe examples:

- toggle Markdown checkbox;
- edit JSON scalar;
- edit CSV cell;
- rename Indented Tree node label with a precise label range.

Riskier examples:

- move Markdown section;
- edit XML namespace declarations;
- auto-format an entire document after a small visual change;
- reorder nodes in a source format where comments or details may move unexpectedly.

Use conservative defaults. Put risky operations behind explicit commands or advanced mode.

## Editor-specific zoom and layout

Editors should inherit the viewer zoom model:

- whole-view zoom;
- text zoom where relevant;
- fit/reset for spatial editors;
- persistent view state.

Document edits and view changes must remain separate.

Examples:

- zooming a graph is not a document edit;
- dragging a node may be only view state unless the specific editor supports layout persistence;
- editing a label is a document edit;
- filtering rows is view state;
- deleting a row is a document edit.

## Recommended implementation phases

### Phase 0 — finish viewer foundations

Before visual editing, complete the viewer-only foundation:

1. register hidden viewers;
2. add common viewer shell;
3. add whole-view zoom;
4. add text zoom for HTML/text-heavy viewers;
5. add selection protocol;
6. add source ranges;
7. add diagnostics overlays;
8. add view-state preservation.

### Phase 1 — introduce edit command and patch infrastructure

Tasks:

1. define source patch shape;
2. add application-level patch application service;
3. add undo/redo integration for visual patches;
4. define semantic command contracts;
5. add validation-before-commit pattern;
6. add conflict detection using document version.

### Phase 2 — first simple structured editors

Good first candidates:

1. CSV table editor;
2. JSON tree editor;
3. Pipeline Flow editor.

These formats have relatively direct data structures and clear serialization paths.

### Phase 3 — Indented Tree tree/outline editor

Tasks:

1. extend parser with field-level editable ranges;
2. support rename node;
3. support edit tags;
4. support edit attributes;
5. support edit details;
6. support add/delete/move nodes;
7. preserve diagnostics and source navigation.

### Phase 4 — mind-map and relationship graph editors

Tasks:

1. add jsMind-backed editor for jsMind JSON;
2. add Indented Tree mind-map editor once hierarchy patching is reliable;
3. add Cytoscape-backed graph editor for Cytoscape JSON;
4. add Indented Tree relationship graph editor for semantic links, keeping hierarchy editing in the tree/mind-map editors.

### Phase 5 — advanced structured editors

Later candidates:

- XML tree editor;
- Markdown section/task/table editor;
- Mermaid/Graphviz diagram-specific editors if the source mapping is strong enough;
- `%view` and `%style` visual editors for Indented Tree.

## Proposed capability metadata

Editable viewers/editors should declare capabilities explicitly:

```js
capabilities: {
  readOnly: false,
  sourceBacked: true,
  supportsCommands: true,
  supportsPatches: true,
  supportsUndoRedo: true,
  supportsConflictDetection: true,
  supportsValidationBeforeCommit: true,
  supportsFieldLevelRanges: true,
  supportsViewerZoom: true,
  supportsTextZoom: true
}
```

A read-only renderer should not expose these write-capability flags.

## Risks and mitigations

### Risk: visual edit corrupts source formatting

Mitigation:

- start with formats where full serialization is acceptable;
- use source-preserving patches where formatting matters;
- show preview or diff for risky operations.

### Risk: edit applies to stale source

Mitigation:

- require base document version;
- reject or rebase stale patches;
- reparse before applying if needed.

### Risk: source mapping is incomplete

Mitigation:

- mark operations unavailable unless required ranges exist;
- fall back to source navigation rather than editing;
- add parser diagnostics for ambiguous structures.

### Risk: viewer state is mistaken for document state

Mitigation:

- separate view state from document state;
- label temporary layout and filters clearly;
- do not write layout unless the editor explicitly supports layout metadata.

### Risk: too many editor-specific implementations

Mitigation:

- share the viewer shell;
- share inspector/forms;
- share command/patch infrastructure;
- implement language-specific command processors only where necessary.

## Implementation principles

1. **Do not make renderers write to documents.** Promote selected viewers into explicit editors.
2. **Text remains authoritative.** Visual edits must map back to source text.
3. **Commands before patches.** Visual UI emits semantic commands, not raw text edits.
4. **Validate before commit.** Prevent silent invalid write-back.
5. **Undo must be source-level.** A visual edit should undo like a text edit.
6. **View state is not document state.** Zoom, pan, filters, and temporary layout stay local unless explicitly persisted by a dedicated feature.
7. **Start with simple formats.** CSV, JSON, and Pipeline JSON are safer first targets than XML, Markdown, or Indented Tree relationship graph editing.
8. **Respect tree-first formats.** For Indented Tree, implement hierarchy editing before graph overlay editing.
9. **Use conservative editing for flexible languages.** Markdown and XML need careful, limited editing first.

## Priority backlog

### Must do

- Define edit command model.
- Define source patch model.
- Add app-level patch application service.
- Add visual edit undo/redo integration.
- Add conflict detection by document version.
- Extend parsed models with source ranges for editable fields.

### Important

- Build CSV table editor.
- Build JSON tree editor.
- Build Pipeline Flow editor.
- Add generated inspector forms for structured properties.
- Add validation-before-commit pipeline.

### Useful

- Build Indented Tree tree/outline editor.
- Build Cytoscape JSON graph editor.
- Build jsMind JSON mind-map editor.
- Add diff preview for risky operations.
- Add schema-aware forms for JSON/XML and pipeline parameters.

### Optional

- Markdown section editor.
- XML tree editor.
- Indented Tree mind-map editor.
- Indented Tree relationship graph editor.
- Visual `%view` and `%style` editors.
- Layout metadata persistence.

## Conclusion

The viewer work should first make LocalEdit excellent at read-only exploration. Once that foundation is stable, selected viewers can evolve into editors by adding explicit command, patch, validation, and undo infrastructure.

The safest path is incremental:

1. finish viewer foundations;
2. add command/patch infrastructure;
3. start with CSV, JSON, and Pipeline JSON;
4. move to Indented Tree tree/outline editing;
5. then add Indented Tree mind-map editing for hierarchy;
6. finally add relationship graph editing where source mapping is reliable.

This preserves LocalEdit's text-first architecture while enabling richer visual and structured editing over time.
