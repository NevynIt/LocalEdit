# LocalEdit Whitepaper — Plugin Streamlining Foundation

## 1. Purpose

This whitepaper defines a preliminary foundation step for LocalEdit before adding many new domain plugins and format bridges.

The goal is to avoid growing the plugin ecosystem as a matrix of direct source-to-viewer implementations, where each source language has its own custom tree preview, graph preview, table preview, SVG export, and data export logic.

Instead, the workbench should move toward this pattern:

```text
text source language
  -> explicit transformer(s)
  -> reusable intermediate language or dialect
  -> reusable renderer / exporter / terminal contribution
```

The user experience should remain simple. A user may still select a command such as **View as graph**, **View as table**, or **Export SVG**. Internally, however, those actions should be implemented as named pipelines composed of small, reusable contributions.

This preliminary work is important because it makes later plugin development cheaper, more consistent, and easier to test. It also creates the foundation for language inheritance, dialects, lossy transformation warnings, and domain-specific profiles.

---

## 2. Current repository baseline

The current repository already has many of the required pieces:

- a local-first text workbench;
- a single text document as the core editable source;
- language-specific plugins;
- contribution collections for languages, editors, editor extensions, transformers, renderers, exporters, linters, terminal steps, and pipelines;
- pipeline JSON documents;
- render windows;
- lazy local runtime loading;
- packaged plugins for Markdown, Mermaid, Graphviz, SVG, JSON, Cytoscape JSON, Indented Tree, XML, JavaScript, CSV, Python, Pipeline JSON, and jsMind.

The current packaged plugins already provide useful functionality:

| Current plugin | Current capabilities |
| --- | --- |
| Markdown | syntax, sanitized HTML preview/export, Mermaid/Graphviz fenced diagrams |
| Mermaid | SVG preview/export |
| Graphviz | DOT syntax, local WASM SVG preview/export |
| SVG | SVG syntax, sanitized SVG preview/export, PNG export |
| JSON | syntax, parse linting, HTML tree preview, Cytoscape tree preview, format, compact |
| Cytoscape JSON | JSON syntax, Cytoscape graph-shape linting, graph preview, format, compact |
| Indented Tree | syntax, parser linting, outline preview, Cytoscape preview, JSON/Cytoscape export |
| XML | syntax, DOMParser linting, tree preview, Prettier format, compact |
| JavaScript | syntax, Prettier format |
| CSV | row-width linting, scrollable table preview |
| Python | syntax, Ruff WASM format |
| Pipeline JSON | pipeline document linting, flow preview, registration |
| jsMind | Indented Tree to jsMind JSON transform and read-only mind-map preview |

This is already enough to prove the architectural direction. The issue is that some current plugins duplicate rendering and transformation responsibilities that should become reusable intermediate steps.

---

## 3. Problem to solve

Several current features follow this pattern:

```text
source language
  -> custom renderer that parses and transforms internally
```

Examples:

```text
Indented Tree
  -> custom outline preview

Indented Tree
  -> custom Cytoscape preview

JSON
  -> custom HTML tree preview

JSON
  -> custom Cytoscape tree preview

XML
  -> custom XML tree preview

CSV
  -> custom table preview
```

This works for a small plugin set, but it does not scale. Once YAML, OpenAPI, BPMN, ArchiMate, architecture graphs, process graphs, action lists, risk registers, and traceability matrices are added, the system would otherwise drift toward this shape:

```text
N source formats x M viewer types
```

That would create repeated parsers, repeated tree builders, repeated table renderers, repeated Cytoscape adapters, and repeated exporters.

The preferred shape is:

```text
N source formats
  -> small number of intermediate languages
  -> M reusable viewers/exporters
```

---

## 4. Core design principle

LocalEdit should distinguish four things:

1. **source text language** — the language of the editable text buffer;
2. **parsed or normalized intermediate dialect** — a reusable structured representation encoded as text, usually JSON or XML;
3. **renderer/exporter target dialect** — a representation directly understood by a renderer or exporter;
4. **named pipeline action** — a user-facing command that hides the intermediate steps.

For example, an Indented Tree graph preview should not be a special renderer that directly parses ITT and mounts Cytoscape. It should be a pipeline:

```text
text.indented-tree
  -> json.indented-tree
  -> json.model-graph
  -> json.cytoscape
  -> Cytoscape renderer
```

The toolbar may still show this as:

```text
View as Cytoscape graph
```

The same approach should apply to tree previews, table previews, SVG export, mind maps, charts, and domain-specific reports.

---

## 5. Language hierarchy foundation

The editor core uses text as the actual editable format. Therefore the language hierarchy must be rooted in `text`.

```text
text
  text.plain
  text.markdown
  text.mermaid
  text.graphviz-dot
  text.indented-tree
  text.csv
  text.json
    json.tree
    json.table
      json.table.action-list
      json.table.risk-register
      json.table.endpoint-list
      json.table.traceability-matrix
    json.model-graph
      json.model-graph.process
      json.model-graph.architecture
      json.model-graph.traceability
    json.cytoscape
    json.jsmind
    json.chart
    json.schema
    json.openapi
    localedit.pipeline-json
  text.xml
    xml.svg
    xml.bpmn
    xml.archimate-exchange
    xml.opml
  text.yaml
    yaml.openapi
    yaml.frontmatter
    yaml.config
  text.javascript
  text.python
```

All documents remain text. More specific languages only add syntax, dialect, schema, semantics, or renderer expectations.

A contribution that applies to a parent language applies to all descendants. There is no contributor opt-out from inheritance. If a generic contribution is likely to discard semantics from a more specific child language, the UI may warn the user, but the contribution remains available.

Example:

```text
json formatter applies to json.table.action-list
json tree renderer applies to json.cytoscape
text search applies to xml.bpmn
xml formatter applies to xml.svg
```

This is similar to base-class behavior in code: a subclass can use base-class operations, even if the operation is not domain-aware.

---

## 6. Intermediate dialects to introduce first

The streamlining work should define a small set of reusable intermediate dialects before adding more domain plugins.

| Dialect | Purpose |
| --- | --- |
| `json.tree` | generic tree representation for JSON, XML, YAML, Markdown outline, and Indented Tree outline previews |
| `json.table` | generic table representation for CSV, Markdown tables, OpenAPI endpoints, action lists, risk registers, traceability matrices, and data profiling |
| `json.model-graph` | generic semantic graph representation for architecture, process, traceability, dependencies, and brainstorming |
| `json.cytoscape` | Cytoscape.js graph document ready for the Cytoscape renderer |
| `json.jsmind` | jsMind document ready for the jsMind renderer |
| `json.chart` | chart intent/configuration for chart renderers |
| `xml.svg` | sanitized/renderable SVG dialect shared by SVG, Mermaid, Graphviz, and chart outputs |

These should be treated as first-class languages/dialects, not hidden internal objects.

Because the workbench core is text-based, each intermediate representation should be serializable as text. For JSON dialects, the serialized form should be pretty-printed JSON by default. For XML dialects, the serialized form should be XML text.

---

## 7. Reusable renderer and exporter targets

The following renderer/exporter plugins should become the shared targets.

| Renderer/exporter | Accepts | Used by |
| --- | --- | --- |
| Tree renderer | `json.tree` | JSON, XML, YAML, Markdown outline, ITT outline |
| Table renderer | `json.table` | CSV, Markdown tables, OpenAPI endpoints, action lists, risk registers |
| Cytoscape renderer | `json.cytoscape` | model graphs, ITT graphs, JSON trees, process graphs, architecture graphs |
| jsMind renderer | `json.jsmind` | ITT mind maps, OPML outlines, Markdown outlines |
| SVG renderer/exporter | `xml.svg` | SVG files, Mermaid output, Graphviz output, chart output |
| Chart renderer | `json.chart` | table charts, profile charts, architecture metrics |
| Markdown report renderer | `text.markdown` | generated reports from tables, graphs, profiles, and domains |

This reduces the need for source-specific renderers.

---

## 8. Existing plugins to streamline

### 8.1 Indented Tree

The Indented Tree plugin should become primarily the owner of:

```text
text.indented-tree
parser / linter
text.indented-tree -> json.indented-tree
```

Its direct outline preview, direct Cytoscape preview, direct JSON export, and direct Cytoscape export should be replaced or hidden behind pipelines.

Proposed pipelines:

```text
View ITT as tree:
text.indented-tree
  -> json.indented-tree
  -> json.tree
  -> tree renderer

View ITT as graph:
text.indented-tree
  -> json.indented-tree
  -> json.model-graph
  -> json.cytoscape
  -> Cytoscape renderer

View ITT as mind map:
text.indented-tree
  -> json.indented-tree
  -> json.jsmind
  -> jsMind renderer

Export ITT JSON:
text.indented-tree
  -> json.indented-tree
  -> JSON exporter

Export ITT Cytoscape JSON:
text.indented-tree
  -> json.indented-tree
  -> json.model-graph
  -> json.cytoscape
  -> JSON exporter
```

### 8.2 JSON

The JSON plugin should own generic JSON syntax and operations:

```text
text.json
parse linter
format
compact
text.json -> json
```

Its direct HTML tree preview and direct Cytoscape tree preview should be replaced by pipelines:

```text
View JSON as tree:
text.json
  -> json.tree
  -> tree renderer

View JSON as Cytoscape tree:
text.json
  -> json.tree
  -> json.cytoscape
  -> Cytoscape renderer
```

This makes JSON tree rendering reusable by XML, YAML, and other structured text formats.

### 8.3 XML

The XML plugin should own:

```text
text.xml
DOMParser linter
format
compact
text.xml -> xml
```

Its direct XML tree preview should become:

```text
View XML as tree:
text.xml
  -> json.tree*
  -> tree renderer
```

Specific XML dialects should be handled by downstream plugins:

```text
xml.svg -> SVG renderer/exporter
xml.bpmn -> json.model-graph.process*
xml.archimate-exchange -> json.model-graph.architecture*
xml.opml -> json.indented-tree*
```

`*` means lossy or potentially lossy.

### 8.4 CSV

The CSV plugin should own:

```text
text.csv
CSV/TSV parser linter
text.csv -> json.table
json.table -> text.csv
```

Its direct table preview should become:

```text
View CSV as table:
text.csv
  -> json.table
  -> table renderer
```

The same table renderer can then support Markdown tables, OpenAPI endpoint lists, risk registers, action lists, and data profiling tables.

### 8.5 Cytoscape JSON

The Cytoscape plugin is already close to the preferred structure. It should become the sole owner of:

```text
json.cytoscape
Cytoscape graph-shape linter
Cytoscape renderer
Cytoscape formatter/compact
```

Other plugins should not implement custom Cytoscape renderers. They should transform into `json.cytoscape` and call the Cytoscape renderer.

One additional cleanup is recommended: Cytoscape should have its own runtime bundle and plugin-owned loading boundary. It should not appear as if Cytoscape is loaded indirectly through the Mermaid runtime bundle.

### 8.6 Mermaid and Graphviz

Mermaid and Graphviz should remain source languages, but their preview/export logic should target `xml.svg`.

```text
text.mermaid
  -> xml.svg*
  -> SVG renderer/exporter

text.graphviz-dot
  -> xml.svg*
  -> SVG renderer/exporter
```

The Mermaid and Graphviz plugins should not each own separate SVG export behavior when the SVG plugin can own sanitized SVG rendering and export.

### 8.7 SVG

The SVG plugin should be reframed as the owner of the `xml.svg` dialect.

It should own:

```text
xml.svg syntax/highlighting
xml.svg linter/sanitizer
xml.svg renderer
xml.svg exporter
xml.svg -> image.png exporter
```

This makes it the common sink for SVG files, Mermaid output, Graphviz output, chart output, and future diagram renderers.

### 8.8 Markdown

Markdown rendering is naturally direct and should mostly remain direct:

```text
text.markdown -> HTML preview/export
```

However, structured Markdown extraction should become explicit:

```text
text.markdown -> json.tree*                    # headings/outline
text.markdown -> json.table*                   # Markdown tables
text.markdown -> json.table.action-list*       # task lists
text.markdown fenced mermaid -> text.mermaid*
text.markdown fenced graphviz -> text.graphviz-dot*
```

### 8.9 jsMind

The jsMind plugin should own:

```text
json.jsmind -> jsMind renderer
```

The ITT-to-jsMind transform can remain, but should be framed as a normal transformer that can also be used by pipelines from OPML and Markdown outline.

---

## 9. User-facing pipelines instead of direct renderers

A user should not need to manually run every transformer. The application should offer named actions that behave like previews or exports.

Examples:

```text
View as Tree
View as Table
View as Graph
View as Mind Map
Export as SVG
Export as PNG
Export as CSV
Export as Markdown Report
```

Internally these may be direct renderer calls or pipelines. The user interface should not make this distinction prominent.

A pipeline action should be displayed beside direct renderers when it ends in a renderer, beside exporters when it ends in an exporter, and beside document actions when it ends in a terminal step.

This allows the application to keep a simple UX while improving the internal plugin architecture.

---

## 10. Contribution visibility and migration

Existing direct renderers/exporters should not be deleted immediately. They should be migrated in stages.

Recommended metadata:

```js
{
  id: "indented-tree-cytoscape-preview",
  visibility: "advanced",
  deprecatedBy: "view-indented-tree-as-cytoscape"
}
```

Suggested values:

| Field | Meaning |
| --- | --- |
| `visibility: "default"` | normal user-facing contribution |
| `visibility: "advanced"` | available, but hidden from the main simple toolbar |
| `visibility: "internal"` | callable by pipelines or tests, but not shown directly |
| `deprecatedBy` | points to the replacement contribution or pipeline |

The first migration pass can leave old direct renderers in place but hide them from the primary menus once equivalent pipelines exist.

---

## 11. Recommended implementation sequence

### Phase 0 — Inventory and naming alignment

- Align README packaged plugin inventory with the actual autoload list.
- Give every current plugin contribution a stable id, display name, language id, and intended role.
- Identify source-specific renderers/exporters that should become pipelines.

### Phase 1 — Language hierarchy support

- Add a language registry with parent/ancestor lookup.
- Register `text` as the root language.
- Convert existing language ids gradually to the hierarchy, using aliases for backward compatibility.
- Update contribution matching so parent contributions apply to descendant languages.

### Phase 2 — Intermediate dialect plugins

Add the first intermediate dialects:

```text
json.tree
json.table
json.model-graph
json.cytoscape
json.jsmind
xml.svg
```

At this phase, the dialects can be minimal. Their purpose is to create stable targets for transformers and renderers.

### Phase 3 — Shared renderers/exporters

Implement or extract:

```text
tree renderer accepts json.tree
table renderer accepts json.table
Cytoscape renderer accepts json.cytoscape
jsMind renderer accepts json.jsmind
SVG renderer/exporter accepts xml.svg
```

### Phase 4 — Transformer extraction

Extract transformations currently hidden inside renderers:

```text
text.indented-tree -> json.indented-tree
json.indented-tree -> json.tree
json.indented-tree -> json.model-graph
json.model-graph -> json.cytoscape
text.json -> json.tree
json.tree -> json.cytoscape
text.xml -> json.tree*
text.csv -> json.table
text.mermaid -> xml.svg*
text.graphviz-dot -> xml.svg*
```

### Phase 5 — Named pipeline replacement

Create named pipelines such as:

```text
view-indented-tree-as-tree
view-indented-tree-as-graph
view-json-as-tree
view-json-as-graph
view-xml-as-tree
view-csv-as-table
view-mermaid-as-svg
view-graphviz-as-svg
export-mermaid-as-svg
export-graphviz-as-svg
```

Then demote the old direct renderers/exporters to `advanced` or `internal`.

### Phase 6 — Foundation tests

Add tests for:

- language ancestry lookup;
- contribution inheritance matching;
- transformer input/output language correctness;
- pipeline execution across multiple transformations;
- replacement pipelines producing equivalent output to previous direct renderers;
- lossy warning metadata;
- deprecated contribution visibility.

---

## 12. Foundation-first priority list

The preliminary foundation should be delivered before heavy domain plugins.

| Priority | Work item | Why it matters |
| --- | --- | --- |
| 1 | Language hierarchy rooted at `text` | Enables inheritance-aware contribution matching |
| 2 | `json.tree` + tree renderer | Replaces JSON/XML/ITT/Markdown-specific tree previews |
| 3 | `json.table` + table renderer | Replaces CSV-specific table preview and enables business/data tables |
| 4 | `json.cytoscape` renderer boundary | Prevents every source plugin from embedding Cytoscape logic |
| 5 | `xml.svg` renderer/exporter boundary | Prevents duplicated SVG export in Mermaid/Graphviz/charts |
| 6 | Extract ITT transformers | Highest-value cleanup and best proof of the pipeline approach |
| 7 | Extract JSON/XML/CSV preview pipelines | Generalizes tree/table rendering |
| 8 | Contribution visibility/deprecation | Allows migration without breaking old features |

---

## 13. Design decision summary

The foundation work should establish the following rules:

```text
1. The only core editable format is text.
2. All languages are descendants of text.
3. Dialects and profiles are language specializations.
4. Parent contributions always apply to descendants.
5. Warnings may be shown for generic or lossy operations, but inheritance is not optional.
6. Renderers should accept reusable target dialects where possible.
7. Source-specific rendering should be replaced by explicit transformers plus reusable renderers.
8. User-facing preview/export actions should usually be named pipelines.
9. Old direct renderers should be migrated gradually through visibility and deprecation metadata.
```

---

## 14. Conclusion

Before adding many new language and domain plugins, LocalEdit should first streamline the existing plugin offering around reusable intermediate dialects, shared renderers, and named pipelines.

This does not reduce the user-facing capability of the workbench. It makes the same capabilities more composable.

The immediate payoff is that Indented Tree, JSON, XML, CSV, Mermaid, Graphviz, SVG, Cytoscape, and jsMind become examples of a clean architecture rather than isolated plugin implementations. The longer-term payoff is that YAML, OpenAPI, BPMN, ArchiMate, architecture modelling, process modelling, data analysis, and business analysis can all build on the same small set of reusable foundations.
