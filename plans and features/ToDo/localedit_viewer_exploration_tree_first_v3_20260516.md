# LocalEdit Read-Only Viewer Exploration Whitepaper — Version 3 Tree-First Update

## Purpose

This whitepaper defines a viewer-only improvement plan for LocalEdit. It focuses strictly on read-only rendering and interactive exploration of document contents.

It deliberately excludes write-back, visual editing, and turning renderers into editors. Those topics are covered in the companion whitepaper: **LocalEdit Viewer-to-Editor Evolution Whitepaper**.

The goal of this paper is to make viewers richer without changing the source document from the viewer window.

Version 3 adds an important clarification: **Indented Tree Text is a tree-first format**. The hierarchy expressed by indentation is the primary structure. Graph relationships, cross-links, styles, and views are layered on top of that tree, not a replacement for it. Viewer design should therefore prioritise tree consumption first, then add graph exploration as an overlay or alternate perspective.

## Scope

In scope:

- richer read-only viewer UI;
- consistent viewer chrome;
- zoom, pan, fit, reset, and text-size controls;
- search, filter, outline, inspector, legend, and diagnostics overlays;
- source-aware selection and navigation back to the source editor;
- preservation of viewer state across refresh;
- registration of existing but currently hidden preview implementations;
- direct semantic viewers for formats where transformer chains make the user experience unnecessarily indirect;
- tree-first viewers for tree-first formats, especially Indented Tree Text.

Out of scope for this paper:

- write-back from viewer to source document;
- visual editing of rendered content;
- opening generated/intermediate documents from the viewer;
- persisting manual visual layout into source files;
- converting viewers into editor plugins.

## Executive summary

LocalEdit already has a strong foundation for rich viewers:

- renderer contributions are first-class plugin contributions;
- render results can be `html`, `svg`, `text`, `image`, or `custom`;
- custom renderers can mount interactive UI and return cleanup functions;
- render windows know which document, renderer, pipeline, and document version they are displaying;
- render windows can request refresh from the source application;
- SVG output already receives a generic pan/zoom wrapper.

The current viewer experience is uneven:

- SVG has useful pan/zoom controls.
- jsMind is already a rich custom viewer.
- Cytoscape has basic graph layout controls but lacks search, filtering, and inspection.
- Markdown is rendered as static HTML.
- Mermaid and Graphviz go through static SVG pipelines rather than direct semantic viewers.
- CSV, JSON, XML, and Indented Tree contain useful preview code, but much of it is not registered as renderer contributions.
- Indented Tree is currently too easy to treat as only a graph source, even though its primary user model is a tree with optional graph semantics layered on top.

The recommended direction is:

1. Expose the existing hidden viewers.
2. Standardise viewer chrome and viewer services.
3. Add common zoom controls to every viewer.
4. Add dedicated text-size controls to HTML and Markdown HTML viewers.
5. Add search, filter, inspector, source navigation, diagnostics overlays, and view-state preservation.
6. Upgrade Cytoscape into the shared graph exploration viewer.
7. Make Indented Tree the flagship **tree-first semantic exploration** workflow, with graph and mind-map views as complementary projections.

## Viewer-only design principle

A viewer should help the user understand the document. It should not become the place where the document is modified.

This means a viewer may:

- highlight rendered content;
- select rendered items;
- show data behind rendered items;
- navigate to the source range in the editor;
- filter or hide items temporarily;
- preserve local view state;
- copy displayed text/data;
- refresh from the source document.

A viewer should not, in this phase:

- modify the source document;
- create new editable documents;
- save visual layout back into the document;
- act as a source of truth for document changes.

## Current viewer architecture

### Renderer contribution contract

The plugin type model defines renderers as plugin contributions with:

- `id`;
- `name`;
- accepted languages;
- `outputKind`;
- optional parameters;
- a `render` function.

Render results can be:

- `html`;
- `svg`;
- `text`;
- `image`;
- `custom`.

This is sufficient for both simple static previews and rich interactive read-only viewers.

### Render manager and render sessions

The main application opens a separate `render-shell.html` window for renderer output. The render manager applies parameter defaults, creates a render session, and sends the active document plus render metadata to the render shell.

A render session stores:

- the render window reference;
- renderer id;
- active plugin paths and uploaded plugin specs;
- renderer parameters;
- metadata.

It can send, refresh, close, and test whether the render window is still open.

### Render shell

The render shell currently has:

- a metadata bar with document identity, renderer, pipeline, version, and update time;
- a refresh button;
- an output area;
- generic display paths for `text`, `html`, `svg`, `image`, and `custom` results;
- SVG-specific pan/zoom.

The render shell should become the common host for all viewer interaction patterns.


## Tree-first versus graph-first viewer semantics

Some LocalEdit formats are naturally graphs. Cytoscape JSON is graph-first: nodes and edges are the primary structure. Mermaid and Graphviz can also be graph-first, depending on the diagram type.

Indented Tree Text is different. It is tree-first:

```text
indented hierarchy = primary structure
ids/types/tags/attributes/details = semantic annotations on tree nodes
cross-links = graph layer over the tree
%view = named projection over the tree and link layer
%style = visual styling layer over the semantic model
```

This distinction matters for viewer design.

A tree-first viewer should let the user consume the document as:

1. a navigable outline/tree;
2. a focused subtree view;
3. a mind map of the hierarchy;
4. a tree with semantic link overlays;
5. a full graph view only when relationship exploration is the task.

A graph-first viewer should instead begin with node/edge exploration and use layout, neighbourhood, and network filters as the primary interaction model.

For Indented Tree, the default viewer action should not be only `View as Graph`. The primary actions should be:

- `View as Tree` or `View as Outline`;
- `View as Mind Map`;
- `View as Relationship Graph`;
- `View Active Projection`, when `%view` directives are present.

The relationship graph should preserve the distinction between:

- parent/child containment edges from indentation;
- semantic cross-links declared with `@...` syntax;
- unresolved or ambiguous links;
- filtered-out elements due to `%view` rules.


## Common viewer chrome

All production viewers should share the same high-level structure:

```text
Render shell
  Metadata strip
  Viewer toolbar
  Optional left panel: outline/search/filter
  Main viewport/content area
  Optional right panel: inspector/legend/details
  Optional bottom strip: diagnostics/status
```

The exact panels can be hidden for simple viewers, but the layout model should be consistent.

## Common viewer controls

### Mandatory controls for all production viewers

Every viewer should expose:

- Refresh;
- Copy visible selection or selected item summary;
- Search, where meaningful;
- Reset view;
- Help/legend, where meaningful;
- viewer-level zoom out;
- viewer-level zoom in;
- viewer-level reset zoom;
- viewer-level zoom percentage.

### Viewer-level zoom

Add a shared whole-view zoom model for the render shell.

This is different from format-specific zoom. It scales the rendered viewer content as a whole, including tables, trees, HTML, pipeline diagrams, graph canvases, and custom viewers where feasible.

Recommended controls:

```text
-   +   Fit   100%   125%
```

Recommended semantics:

- `-`: reduce whole-view scale;
- `+`: increase whole-view scale;
- `Fit`: use the viewer's natural fit behaviour, if available;
- `100%`: reset whole-view scale;
- percentage label: show current viewer-level scale.

For spatial viewers such as SVG, Cytoscape, jsMind, Mermaid, and Graphviz, viewer-level zoom should map to the existing spatial zoom model where possible.

For non-spatial viewers such as HTML, Markdown HTML, JSON tree, XML tree, CSV table, and Pipeline Flow, viewer-level zoom should scale the viewer content container.

### Text zoom for HTML and Markdown HTML

HTML-like document viewers need a separate text-size control, because users may want larger text without scaling the entire page layout.

Add text zoom controls to:

- generic HTML renderer display;
- Markdown HTML Preview;
- Pipeline Flow if kept as HTML;
- JSON/XML/Indented Tree outline viewers if they remain HTML-based.

Recommended controls:

```text
A-   A+   Text 100%
```

Recommended semantics:

- `A-`: reduce text scale;
- `A+`: increase text scale;
- `Text 100%`: reset text scale;
- text scale should be independent from whole-view zoom.

Recommended state shape:

```js
{
  viewerZoom: 1,
  textZoom: 1
}
```

Recommended CSS approach:

```css
.viewer-content {
  transform: scale(var(--viewer-zoom));
  transform-origin: 0 0;
}

.viewer-text-scope {
  font-size: calc(1rem * var(--viewer-text-zoom));
}
```

The render shell should own the generic viewer zoom. HTML and Markdown viewers should additionally expose text zoom.

## Common viewer services

Introduce a read-only `ViewerServices` object passed to custom renderers.

Recommended initial shape:

```js
{
  refresh(),
  selectSourceRange(range),
  showDiagnostic(diagnosticId),
  reportSelection(selection),
  setViewState(state),
  getViewState(),
  setStatus(message),
  copyText(text)
}
```

Do not include document creation or write-back services in the viewer-only phase.

## Common viewer event protocol

A viewer should report selection using a common shape:

```js
{
  type: "viewer-selection-changed",
  bindingId,
  selection: {
    kind: "node" | "edge" | "row" | "cell" | "heading" | "path" | "element" | "step",
    id,
    label,
    sourceRange,
    data
  }
}
```

The application can use this to:

- update the status bar;
- jump to source;
- show diagnostics;
- preserve selected item across refresh.

## View-state preservation

Auto-refresh is only useful if the viewer does not constantly reset the user's context.

Each custom viewer should eventually expose:

```js
{
  getViewState() {},
  setViewState(state) {}
}
```

State should be stored per render binding id.

Common state fields:

```js
{
  viewerZoom,
  textZoom,
  pan,
  selectedItemId,
  searchQuery,
  activeMatchIndex,
  filters,
  expandedIds,
  collapsedIds,
  activeLayout,
  activeViewName
}
```

## Current viewer inventory and recommendations

## 1. Generic render shell viewer host

**Files:**

- `editor-workbench/render-shell.html`
- `editor-workbench/render-shell.js`

### Current UI

The render shell is a standalone preview window. It displays metadata at the top and rendered output below.

For SVG output, it wraps the result in a pan/zoom shell with:

- zoom out;
- zoom in;
- fit;
- 100%;
- zoom percentage label;
- mouse wheel zoom around pointer;
- drag-to-pan.

### Strengths

- Shows which document is being rendered.
- Shows renderer and pipeline metadata.
- Supports refresh from the render window.
- Has generic SVG pan/zoom.
- Supports custom renderers.
- Works within the strict CSP model.

### Weaknesses

- Viewer chrome is not standardised across all output kinds.
- Generic HTML output has no zoom controls.
- Generic HTML output has no text zoom controls.
- Generic text output has no text-size controls.
- No common side panel or inspector.
- No common search/filter UI.
- No common diagnostics overlay.
- No common source-selection protocol.
- SVG pan/zoom cleanup should be made explicit for all global event listeners.

### Recommendations

- Promote the SVG pan/zoom shell into a generic viewer zoom service.
- Add whole-view zoom for all output kinds.
- Add text zoom for HTML and text-like output.
- Add standard toolbar slots.
- Add optional left/right/bottom panels.
- Add read-only viewer services.
- Add selection and source-navigation protocol.
- Preserve viewer state by render binding id.

## 2. Markdown HTML Preview

**File:** `editor-workbench/plugins/markdown/markdown.plugin.js`

### Current UI

The Markdown plugin registers `markdown-html-preview`, which returns sanitized HTML. It adds minimal CSS for diagram blocks and loads Mermaid or Graphviz runtimes only if fenced blocks require them.

### Strengths

- Simple and useful.
- Sanitized output.
- Conditional runtime loading.
- Good baseline for document preview.

### Weaknesses

- Static HTML only.
- No table of contents.
- No heading outline.
- No preview search.
- No source-line mapping.
- No task-list summary.
- No code-block tools.
- No independent text zoom.
- Embedded diagrams do not receive full diagram viewer affordances.

### Recommendations

Create a Markdown custom viewer or enrich the HTML viewer path for Markdown.

Add:

- whole-view zoom;
- Markdown text zoom controls: `A-`, `A+`, `Text 100%`;
- heading outline panel;
- rendered text search;
- heading click-to-scroll;
- optional source navigation from headings, code blocks, diagrams, tables, and list items;
- task-list panel;
- code-block copy buttons;
- diagram blocks wrapped with viewer-level pan/zoom where feasible;
- document statistics strip: headings, words, links, diagrams, tasks.

Do not add Markdown visual editing in this phase.

## 3. Generic HTML Viewer

**Current UI**

The render shell directly injects returned HTML into a wrapper.

### Weaknesses

- No common zoom.
- No text zoom.
- No standard print/read mode.
- No search in rendered content.
- No common content width control.

### Recommendations

Add a generic HTML viewer wrapper with:

- whole-view zoom;
- text zoom;
- search;
- content width modes: narrow, normal, wide, full;
- optional generated outline if headings exist;
- common copy selected text action.

This immediately benefits Markdown, Pipeline Flow, XML tree, JSON tree, CSV table, and any future HTML renderer.

## 4. SVG Preview

**File:** `editor-workbench/plugins/svg/svg.plugin.js`

### Current UI

The SVG plugin registers `svg-preview`, which returns sanitized SVG. The render shell displays it through generic SVG pan/zoom.

### Strengths

- Good baseline for diagrams and graphics.
- Sanitized SVG.
- Reusable for direct SVG, Mermaid output, and Graphviz output.
- PNG export path exists in the SVG plugin.

### Weaknesses

- No element selection.
- No SVG DOM tree inspector.
- No search by text/id/class/title.
- No link highlighting.
- No minimap.
- No sanitization report.

### Recommendations

Add:

- SVG object explorer;
- element tree;
- text/id/class search;
- selectable elements with hover outlines;
- right inspector showing tag, id, class, title, desc, dimensions, and key attributes;
- sanitization report panel;
- minimap for large diagrams;
- background toggle: transparent, white, dark, checkerboard;
- whole-view zoom controls aligned with the shared viewer model.

Do not add SVG DOM editing in this phase.

## 5. Mermaid and Graphviz SVG pipelines

**Files:**

- `editor-workbench/plugins/mermaid/mermaid.plugin.js`
- `editor-workbench/plugins/graphviz/graphviz.plugin.js`

### Current UI

Mermaid and Graphviz do not register direct renderers. Each defines a transformer to SVG and user-facing pipelines for viewing/exporting through the SVG plugin.

The preview experience is therefore:

- generated SVG;
- generic pan/zoom;
- no semantic diagram inspector.

### Strengths

- Reuses the SVG viewer.
- Keeps export flows simple.
- Avoids duplicate pan/zoom code.

### Weaknesses

- No Mermaid/DOT-specific exploration.
- Errors are not represented as structured visual diagnostics.
- Diagram nodes are not linked back to source statements.
- No diagram-type-specific outline.
- No semantic selection of nodes, edges, clusters, states, participants, tasks, or sequence messages.

### Recommendations

Keep SVG transform/export pipelines, but add direct read-only custom viewers:

- `mermaid-diagram-viewer`;
- `graphviz-dot-viewer`.

These viewers should:

- render internally to SVG;
- use the shared spatial zoom model;
- add semantic outline panels;
- add diagram-aware inspectors;
- expose source mapping where feasible;
- support selection and neighbourhood highlighting;
- show parse/render errors in a viewer diagnostics panel.

For Graphviz DOT, add:

- graph/subgraph/cluster list;
- node and edge tables;
- rank/direction metadata;
- warnings for parse or layout errors.

For Mermaid, add:

- diagram type badge;
- node/edge/participant/task list depending on diagram type;
- parse/render error panel;
- rendered SVG element selection where Mermaid output contains useful ids/classes.

Do not add diagram editing in this phase.

## 6. Cytoscape Graph Preview

**Files:**

- `editor-workbench/plugins/cytoscape/cytoscape.plugin.js`
- `editor-workbench/plugins/shared/cytoscape-viewer/cytoscape-viewer.js`

### Current UI

The Cytoscape viewer is a custom renderer. It renders a graph shell with:

- title;
- summary text showing node/edge counts;
- layout selector;
- `Run` layout button;
- `Fit` button;
- `Reset` button;
- Cytoscape viewport.

Supported layout options:

- breadthfirst;
- cose;
- circle;
- grid;
- concentric.

### Strengths

- Already has reusable shared viewer code.
- Supports multiple layouts.
- Good target for Indented Tree and JSON graph exploration.
- Reasonable visual defaults.

### Weaknesses

- No node/edge inspector.
- No graph search.
- No type/tag/edge-kind filters.
- No legend.
- No neighbourhood focus.
- No source navigation.
- No selection persistence across refresh.
- No graph metrics.

### Recommendations

Upgrade the shared Cytoscape viewer into the standard graph exploration component.

Add toolbar controls:

- whole-graph zoom out/in/reset;
- fit graph;
- fit selection;
- search nodes/edges;
- filter by node type/class/tag;
- filter by edge kind/type;
- show/hide labels;
- show/hide isolated nodes;
- layout presets;
- reset filters.

Add interaction modes:

- click node/edge to select;
- double-click node to focus neighbourhood;
- shift-click for multi-selection;
- hover to highlight incident edges;
- keyboard next/previous search match.

Add side panels:

- **Outline:** grouped by type/tag/class;
- **Inspector:** selected node/edge data, attributes, details, source line/range;
- **Legend:** node classes, edge kinds, style rules;
- **Diagnostics:** unresolved links, duplicate ids, missing endpoints, parser warnings.

Add graph operations:

- show incoming/outgoing/both neighbourhood;
- collapse descendants visually;
- expand descendants visually;
- isolate connected component;
- hide selected in the current view;
- show shortest path between two selected nodes.

All operations are temporary viewer-state operations in this phase.

## 7. jsMind Mind Map Viewer

**File:** `editor-workbench/plugins/jsmind/jsmind.plugin.js`

### Current UI

The jsMind viewer is the richest current viewer. It renders `json.jsmind` as a custom read-only mind map and supports an Indented Tree to jsMind viewing pipeline.

Current toolbar:

- map title;
- zoom out;
- zoom in;
- fit;
- 100%;
- center;
- zoom percentage;
- decrease text size;
- increase text size;
- text scale percentage;
- collapse/wrap to first level;
- depth 2;
- expand all;
- auto-layout;
- node count/status.

Current interactions:

- draggable map;
- draggable nodes as temporary view layout;
- custom hierarchy line overlay;
- dashed cross-link overlay;
- cross-link labels;
- double-click node to collapse/expand;
- root double-click toggles broader collapse/depth behavior;
- automatic relayout preserving anchor where possible.

### Strengths

- Excellent baseline for interactive exploration.
- Has both spatial zoom and text scale.
- Strong visual treatment.
- Useful layout controls.
- Supports cross-links from Indented Tree data.
- Allows temporary manual positioning for exploration.

### Weaknesses

- No inspector panel.
- No search.
- No minimap.
- No breadcrumb/path display.
- No keyboard shortcuts.
- No source-line jump.
- Cross-links are visible but not selectable or filterable.
- No legend explaining hierarchy vs cross-link line styles.
- Manual positions are not preserved across refresh unless view-state support is added.

### Recommendations

Add:

- node search;
- next/previous match;
- filter by tag/type/attribute;
- breadcrumb path from root to selected node;
- selected node inspector with id, topic, type, tags, attributes, details, outgoing links, incoming links, and source range;
- click/hover cross-link inspection;
- hover highlight for parent path and cross-links;
- optional minimap;
- persisted viewer state for zoom, pan, expansion, selected node, text scale, and temporary manual positions;
- reset temporary manual positions.

Do not add node editing in this phase.

## 8. Pipeline Flow Viewer

**File:** `editor-workbench/plugins/pipeline/pipeline.plugin.js`

### Current UI

The Pipeline JSON plugin registers `pipeline-flow-renderer`, which renders a simple HTML flow:

- title;
- input language;
- vertical list of steps;
- downward arrows;
- each step shows step number, contribution id, and optional JSON params.

### Strengths

- Clear enough for simple pipelines.
- Useful for explaining data-only pipeline definitions.
- Low complexity.

### Weaknesses

- Static HTML only.
- No whole-view zoom.
- No text zoom.
- No validation status per step in the viewer.
- No links to contribution definitions.
- No input/output language transition display per step.
- No branching model if pipelines later become non-linear.

### Recommendations

Upgrade to an interactive read-only pipeline diagram:

- render steps as nodes in a horizontal or vertical graph;
- show input/output language at each edge;
- show contribution type per step;
- show validation status per node;
- click a step to inspect id, contribution name, plugin, parameters, input language, output language, visibility/category, and diagnostics;
- add whole-view zoom;
- add text zoom if implemented as HTML;
- show missing contribution or incompatible language links as errors on the graph.

Do not add pipeline editing in this phase.

## 9. Example Text Preview

**File:** `editor-workbench/plugins/example-smoke.plugin.js`

### Current UI

The smoke plugin registers a text renderer. It returns a simple text result containing a heading and the source text.

### Recommendation

Keep it minimal and clearly label it as a test/development plugin.

The generic text display path should still benefit from whole-view zoom and text zoom once the render shell supports them.

## 10. CSV Table Preview — implemented but not registered

**File:** `editor-workbench/plugins/csv/csv.plugin.js`

### Current UI in code

The plugin contains a CSV viewer implementation that renders:

- checkbox: `Interpret first row as titles`;
- scrollable table wrapper;
- default table view;
- alternate table view using first row as column titles;
- sticky table headers;
- row numbers;
- wrapped cell text.

The plugin currently registers `renderers: []`, so this viewer is not exposed.

### Strengths

- Good minimum table preview.
- Handles CSV/TSV delimiter detection.
- Linter warns about inconsistent row width.
- Useful first-row-as-header option.

### Weaknesses

- Not available through the renderer registry.
- Static HTML table.
- No whole-view zoom.
- No text zoom.
- No search/filter/sort.
- No pagination or virtualization.
- No column type detection.
- No row/column/cell selection model.
- No summary statistics.

### Recommendations

Register a real renderer:

```js
renderers: [
  {
    id: "csv-table-preview",
    name: "CSV Table Preview",
    inputLanguages: ["text.csv"],
    outputKind: "html",
    render: async function (documentModel, context) {
      return {
        kind: "html",
        content: renderViewer(await parseCsv(documentModel, context)),
        mimeType: "text/html"
      };
    }
  }
]
```

Then improve it with:

- whole-view zoom;
- text zoom;
- search across cells;
- column filters;
- sort by column;
- toggle first row as header;
- delimiter selector;
- pinned first column;
- copy cell/row/column text;
- column type inference;
- column statistics;
- row-width anomaly highlighting;
- virtualized rendering for large files;
- source row jump from row number.

Do not add cell editing in this phase.

## 11. JSON Tree and JSON Graph Preview — implemented but not registered

**File:** `editor-workbench/plugins/json/json.plugin.js`

### Current UI in code

The plugin contains two preview functions:

1. `renderJsonTree`:
   - monospaced tree preview;
   - nested `<details open>` nodes;
   - object/array summaries;
   - key/value leaves.

2. `renderJsonCytoscapeTree`:
   - converts JSON structure to a Cytoscape graph;
   - labels nodes with key and value summary;
   - styles root, branch, and leaf nodes differently;
   - shows node/edge/depth summary.

The plugin currently registers `renderers: []`, so neither viewer is exposed.

### Strengths

- Tree and graph views are both useful.
- Cytoscape graph generation is already mostly present.
- JSON parser diagnostics exist.

### Weaknesses

- Not exposed as renderers.
- Tree is static HTML with all details open by default.
- No whole-view zoom or text zoom.
- No lazy rendering for large JSON.
- No JSON Pointer display.
- No search/filter.
- No copy path/value action.
- No source range mapping.

### Recommendations

Register two renderers:

- `json-tree-preview`;
- `json-graph-preview`.

Tree viewer improvements:

- whole-view zoom;
- text zoom;
- collapse all / expand all;
- expand to depth;
- search by key/value/path;
- show JSON Pointer for selected item;
- copy path;
- copy value;
- copy subtree text;
- type badges;
- size badges for arrays/objects;
- lazy render large arrays/objects;
- virtualized large lists.

Graph viewer improvements:

- use shared Cytoscape viewer;
- filter leaves/branches/arrays/objects;
- collapse object subtrees visually;
- focus selected subtree;
- show selected node path and value in inspector.

Do not add JSON editing in this phase.

## 12. XML Tree Preview — implemented but not registered

**File:** `editor-workbench/plugins/xml/xml.plugin.js`

### Current UI in code

The plugin contains `renderXmlTree`, which parses XML and renders a monospaced nested tree:

- element nodes as expandable `<details>`;
- attributes summarized in element labels;
- text nodes;
- CDATA nodes;
- comments;
- processing instructions.

The plugin currently registers `renderers: []`, so this viewer is not exposed.

### Strengths

- Useful parsed view.
- Covers key XML node types.
- XML parser diagnostics and formatting already exist.

### Weaknesses

- Not exposed as a renderer.
- Static HTML only.
- No whole-view zoom or text zoom.
- No XPath-like search.
- No namespace handling UI.
- No attribute table.
- No source range mapping.
- No large-document virtualization.

### Recommendations

Register an XML tree renderer.

Improve the viewer with:

- whole-view zoom;
- text zoom;
- expand/collapse all;
- expand to depth;
- search by element name, attribute name/value, and text;
- XPath-like path display for selected element;
- namespace panel;
- attribute inspector;
- copy element path;
- copy element XML text;
- hide whitespace-only text nodes toggle;
- source jump from selected element;
- optional graph view for element hierarchy and references.

Do not add XML editing in this phase.

## 13. Indented Tree Tree, Mind Map, and Relationship Graph Views — implemented but not registered

**File:** `editor-workbench/plugins/indented-tree/indented-tree.plugin.js`

### Current UI in code

The plugin contains:

- `renderOutline`, a static tree/outline preview;
- `renderCytoscapePreview`, a relationship graph preview through the shared Cytoscape viewer;
- `buildCytoscapeDocument`, which converts parsed Indented Tree nodes, hierarchy, and links into Cytoscape JSON;
- parser support for metadata, includes, styles, views, ids, types, tags, attributes, details, indentation hierarchy, and cross-links.

The plugin currently registers `renderers: []`.

The jsMind plugin separately contributes a pipeline that views Indented Tree as a mind map.

### Interpretation

Indented Tree Text should be treated as a **tree-first semantic document format**:

- indentation defines the authoritative parent/child tree;
- node ids, types, tags, attributes, and details enrich tree nodes;
- cross-links add a graph layer on top of the tree;
- `%view` creates named projections over the tree and graph layer;
- `%style` describes how semantic selections should be displayed.

The current graph conversion is useful, but it should not become the only or default consumption mode. The primary consumption model should remain the tree.

### Strengths

- Strong parser model.
- Natural tree hierarchy as the primary structure.
- Rich semantics: ids, types, tags, attributes, details, links, styles, and views.
- Can produce Cytoscape graphs directly for relationship exploration.
- Existing jsMind pipeline proves that hierarchy-first visual exploration is valuable.
- Good candidate for several complementary views over one parsed model.

### Weaknesses

- Outline and graph viewers are not registered.
- The current graph projection can make the format appear graph-first, even though the source structure is tree-first.
- `%view` directives are parsed but not visibly applied in current viewers.
- `%style` directives are parsed but not visibly applied to outline, mind-map, or Cytoscape styling.
- Includes are parsed but unresolved.
- No source-aware inspector.
- No tree navigation panel with breadcrumbs, depth controls, subtree focus, or child counts.
- No filter panel for type/tag/attribute/link type.
- No view selector.
- No clear distinction between hierarchy and semantic cross-links beyond line style.

### Recommendations

Register the viewers:

- `indented-tree-outline-preview` or `indented-tree-tree-preview` as the primary viewer;
- `indented-tree-mindmap-preview` as the hierarchy-oriented visual viewer;
- `indented-tree-relationship-graph-preview` as the graph overlay/exploration viewer.

Add direct user-facing actions:

- `View as Tree` or `View as Outline`;
- `View as Mind Map`;
- `View as Relationship Graph`;
- `View Active Projection` when `%view` directives exist.

The default action for `text.indented-tree` should be the tree/outline viewer, not the graph viewer.

### Tree/outline viewer requirements

The tree viewer should provide:

- whole-view zoom;
- text zoom;
- expand/collapse all;
- expand to depth;
- collapse to selected branch;
- focus selected subtree;
- breadcrumb path from root to selected node;
- node count, leaf count, maximum depth, and visible node count;
- search by label, id, type, tag, attribute, and details;
- filter by type, tag, attribute, diagnostic severity, and link presence;
- badges for node type, tags, diagnostics, unresolved links, and incoming/outgoing links;
- inspector showing full node metadata, details, children, parent, links, and source location;
- source jump from selected node, detail block, id, type, tag, attribute, or link.

Tree hierarchy should be visually dominant. Cross-links should be shown as secondary affordances: badges, inspector lists, optional overlay lines, or a related-nodes side panel.

### Mind-map viewer requirements

The mind-map view should be treated as a hierarchy-first visual projection of the tree.

It should provide:

- root-centered exploration;
- expand/collapse by branch;
- depth presets;
- text scaling;
- fit/center controls;
- optional cross-link overlay;
- link badges on nodes;
- inspector for selected node metadata and relationships;
- view selector for `%view` projections.

The mind-map should not force all graph links into the main layout. Cross-links should be optional overlays because they can make a tree unreadable when overdrawn.

### Relationship graph viewer requirements

The relationship graph view should be a secondary exploration mode for questions such as:

- Which nodes reference this node?
- Which requirements are verified by which tests?
- Which risks relate to which capabilities?
- Which nodes are orphaned, unresolved, or over-connected?

It should provide:

- graph zoom for graph viewer;
- graph search;
- neighbourhood focus;
- incoming/outgoing edge filtering;
- edge-type filter;
- toggle hierarchy edges on/off;
- toggle semantic cross-links on/off;
- distinguish containment edges from semantic links using styling, labels, and legend;
- show unresolved links as warnings and optionally ghost edges;
- show duplicate ids directly in the graph;
- preserve the selected node across tree, mind-map, and graph views.

### `%view` support

Implement `%view` support consistently across tree, mind-map, and graph views:

- add a view selector in the toolbar;
- apply include/exclude rules to the parsed model before rendering;
- show active view name and rule count;
- show hidden node/link counts;
- expose warnings for unsupported selectors;
- allow a temporary `Show hidden context` toggle so users can see parents of included nodes.

For tree-first projections, filtering must preserve enough ancestor context to keep the tree understandable. If a child matches but its ancestors do not, the viewer should either show a faded ancestor chain or offer an option to show matching nodes as a flat search result.

### `%style` support

Implement `%style` support as a semantic styling layer:

- map supported style declarations to outline row styles, mind-map node styles, and Cytoscape style rules;
- show a style legend;
- warn when style properties are unsupported;
- keep semantic styling separate from temporary viewer selection and diagnostics styling.

### Cross-view synchronization

When multiple Indented Tree viewers are open for the same document, selection should be shareable by stable node id or internal id.

Recommended selection identity:

```js
{
  languageId: "text.indented-tree",
  nodeInternalId: "n17",
  declaredId: "req1",
  sourceRange: { from: 120, to: 190 },
  viewKind: "tree|mindmap|relationship-graph"
}
```

Do not add visual editing or write-back in this phase.

## Cross-viewer recommendations

### A. Make every viewer source-aware

Each parsed/rendered item should optionally carry a source reference:

```js
{
  sourceRange: {
    from: 120,
    to: 145,
    line: 8,
    column: 2
  }
}
```

The viewer should use this for:

- jump to source;
- diagnostic highlighting;
- selection synchronization;
- stable selection after refresh.

### B. Standardise viewer zoom

Add two independent zoom concepts:

1. **Viewer zoom**: scales the entire rendered view or spatial viewport.
2. **Text zoom**: scales text inside HTML/text-heavy viewers without changing the overall spatial scale.

Recommended availability:

| Viewer type | Viewer zoom | Text zoom |
|---|---:|---:|
| SVG | yes | no |
| Mermaid/Graphviz SVG | yes | no |
| Cytoscape graph | yes | optional label scale later |
| jsMind | yes | yes, already partly present |
| Markdown HTML | yes | yes |
| Generic HTML | yes | yes |
| CSV table | yes | yes |
| JSON/XML tree | yes | yes |
| Indented Tree tree/outline | yes | yes |
| Indented Tree mind map | yes | yes |
| Indented Tree relationship graph | yes | optional label scale later |
| Pipeline Flow | yes | yes if HTML-based |
| Text preview | yes | yes |

### C. Add a standard inspector panel

The inspector should show:

- selected item label;
- kind/type;
- id/path;
- source location;
- attributes/properties;
- relationships;
- diagnostics;
- read-only actions such as copy value, copy path, copy label.

### D. Add a standard search/filter service

Different viewers should implement a common search contract:

```js
viewer.search({ query, fields, options }) => {
  matches: [{ id, label, sourceRange, kind }],
  activeIndex
}
```

Filters should be declarative:

```js
{
  field: "type",
  operator: "in",
  values: ["requirement", "risk"]
}
```

### E. Add diagnostic overlays

Diagnostics should not only appear in the editor panel. Viewers should be able to render diagnostics against visual items:

- warning badge on graph node;
- red row marker in CSV;
- warning icon beside JSON/XML tree node;
- pipeline step error badge;
- Markdown diagram error panel;
- unresolved link badge in Indented Tree.

### F. Avoid unnecessary explicit transformer hops for preview UX

For user-facing preview actions, prefer direct semantic viewers:

- Indented Tree → Graph Viewer directly;
- Indented Tree → Mind Map Viewer directly;
- Mermaid → Mermaid Viewer directly;
- Graphviz → DOT Viewer directly.

Keep explicit transformer pipelines for:

- export;
- debugging;
- reusable conversions;
- automation.

### G. Support large documents

Large-document protections:

- JSON/XML trees should lazy-render children.
- CSV should virtualize rows and columns.
- Graph viewers should show progressive loading or summarised clusters.
- Markdown should avoid full reflow loops on every refresh.
- Viewers should warn when rendering is partial or sampled.

### H. Accessibility and keyboard navigation

Add:

- keyboard search focus;
- keyboard next/previous match;
- accessible names for toolbar buttons;
- focus ring on selected rendered items;
- high-contrast diagnostic markers;
- reduced-motion handling;
- keyboard pan/zoom for graph/SVG viewers;
- keyboard text zoom shortcuts where appropriate.

## Recommended implementation phases

### Phase 0 — expose existing preview code

Goal: make implemented but hidden viewers available.

Tasks:

1. Register CSV table preview.
2. Register JSON tree preview.
3. Register JSON graph preview.
4. Register XML tree preview.
5. Register Indented Tree outline preview.
6. Register Indented Tree graph preview.
7. Add smoke tests that each registered renderer appears in the action menu.

### Phase 1 — common viewer shell and zoom

Goal: make all viewers feel consistent.

Tasks:

1. Extract shared viewer chrome from render shell.
2. Add whole-view zoom controls for all output kinds.
3. Add text zoom controls for HTML/text-heavy viewers.
4. Add standard toolbar slots.
5. Add optional side panels.
6. Add view-state persistence by render binding id.
7. Add selection event protocol.
8. Add source navigation callback.
9. Add diagnostics-to-viewer service.

### Phase 2 — graph viewer upgrade

Goal: make Cytoscape the shared graph exploration component.

Tasks:

1. Add node/edge selection.
2. Add inspector panel.
3. Add search.
4. Add type/tag/edge filters.
5. Add legend.
6. Add neighbourhood focus.
7. Apply this to Cytoscape JSON, Indented Tree graph, JSON graph, contribution catalog, and future graph-like viewers.

### Phase 3 — document/tree/table viewer upgrades

Goal: make non-graph viewers useful for exploration.

Tasks:

1. Upgrade Markdown with outline/search/task/code-block tooling.
2. Upgrade CSV with search/filter/sort/pagination/virtualization.
3. Upgrade JSON with JSON Pointer, copy path, search, and lazy expansion.
4. Upgrade XML with XPath-like path, namespace handling, search, and attributes inspector.
5. Upgrade Pipeline Flow with step inspection and validation badges.

### Phase 4 — semantic Indented Tree experience

Goal: make Indented Tree the main semantic viewing workflow.

Tasks:

1. Implement `%view` selector in outline, graph, and mind-map viewers.
2. Implement `%style` mapping for graph and outline viewers.
3. Add source-aware inspector.
4. Add diagnostics overlay.
5. Add unresolved link / duplicate id visual indicators.
6. Add view filtering and temporary visual subgraph isolation.

## Suggested renderer registration fixes

### CSV

Add `csv-table-preview` to the CSV plugin `renderers` array.

### JSON

Add:

- `json-tree-preview`;
- `json-graph-preview`.

The graph preview should return the existing `renderJsonCytoscapeTree` custom result.

### XML

Add:

- `xml-tree-preview`.

### Indented Tree

Add:

- `indented-tree-outline-preview`;
- `indented-tree-graph-preview`.

## Proposed viewer capability metadata

Each renderer should optionally declare capabilities:

```js
capabilities: {
  searchable: true,
  filterable: true,
  selectable: true,
  hasInspector: true,
  supportsSourceNavigation: true,
  supportsDiagnosticsOverlay: true,
  supportsViewState: true,
  supportsViewerZoom: true,
  supportsTextZoom: false,
  spatial: true,
  hierarchical: true,
  tabular: false
}
```

This lets the render shell decide which common UI slots to show.

## Proposed custom viewer lifecycle

Current custom viewers return `mount(target)` and optionally a cleanup function.

Extend this gradually without breaking existing viewers:

```js
content: {
  mount(target, services) {
    return {
      dispose() {},
      getViewState() {},
      setViewState(state) {},
      focusSelection(selection) {},
      search(query) {},
      clearSearch() {},
      setViewerZoom(scale) {},
      setTextZoom(scale) {}
    };
  }
}
```

For backward compatibility, if `mount` returns a function, treat it as `dispose`.

## Implementation principles

1. **Viewers are read-only.** They explore and explain source documents; they do not change them.
2. **Direct preview should feel direct.** Users should not have to understand internal transformer chains to view common formats.
3. **Pipelines remain valuable.** Use them for export, automation, reusable conversions, and debugging intermediate representations.
4. **Every visual item should be inspectable.** If the viewer renders a node, row, step, heading, or element, the user should be able to click it and see what it represents.
5. **Diagnostics should appear where the problem is visible.** Editor diagnostics and visual diagnostics should be connected.
6. **Viewers should survive refresh.** Auto-refresh must not reset zoom, pan, selected node, expanded state, or filters.
7. **Large files need graceful degradation.** Render samples, lazy-load, virtualize, cluster, or warn rather than locking the browser.
8. **The strict CSP model must remain intact.** Viewer improvements should use local bundled libraries and no network access.

## Priority backlog

### Must do

- Register existing hidden viewers for CSV, JSON, XML, and Indented Tree.
- Add common whole-view zoom.
- Add text zoom for HTML and Markdown HTML.
- Add common viewer state preservation.
- Add node/item selection and inspector to Cytoscape viewer.
- Add search to graph, tree, and table viewers.
- Add source navigation from viewer selection.

### Important

- Add diagnostics overlays to viewers.
- Add filter panels for graph/table/tree viewers.
- Add Markdown outline and source-aware heading navigation.
- Add Mermaid and Graphviz direct custom viewers.
- Add Indented Tree `%view` support.

### Useful

- Add minimaps for large spatial viewers.
- Add graph metrics.
- Add JSON/XML schema-aware validation views.
- Add pipeline graph inspection.
- Add view-state export/import as read-only viewer preferences.

### Optional

- Multi-view synchronized exploration windows.
- Advanced graph algorithms such as shortest path, centrality, and clustering.
- Reader-mode themes for Markdown/HTML.

## Conclusion

LocalEdit already has the architecture needed for rich read-only viewers. The fastest improvement is to expose the preview code that already exists but is hidden, then standardise viewer controls across all renderers.

The highest-value shared capabilities are:

- whole-view zoom;
- text zoom for HTML and Markdown HTML;
- search;
- filters;
- inspector panels;
- source navigation;
- diagnostics overlays;
- view-state preservation.

The most strategically important viewer stack is Indented Tree, Cytoscape, and jsMind: tree/outline for the primary hierarchy, mind map for readable hierarchy exploration, and relationship graph for cross-links and semantic network analysis. This keeps Indented Tree Text tree-first while still leveraging graph exploration where it adds value.
