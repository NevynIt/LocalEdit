# LocalEdit Whitepaper 1 — Structural Changes for Language Hierarchies

## 1. Purpose

This whitepaper proposes the structural changes required to evolve LocalEdit from a flat language registry into an inheritance-aware language, dialect, and profile system.

The core principle is simple:

> LocalEdit edits text. Every supported format is a specialized kind of text.

The editor should continue to store and edit the current document as a text buffer. Language metadata should describe how that text should be interpreted, validated, transformed, rendered, and exported.

The proposed change does not require replacing the editor core, changing the local-first security posture, or introducing a binary document model. It mainly requires making the language registry and contribution matching logic aware of parent/child relationships between languages.

---

## 2. Current situation

The current implementation already has the right high-level architecture:

- a `DocumentModel` containing source text and a selected `languageId`;
- a `LanguageRegistry` for language definitions;
- a `PluginRegistry` for highlighters, linters, transformers, renderers, and exporters;
- managers for diagnostics, transformations, rendering, and export;
- plugin-owned lazy runtime dependencies;
- local-file and extension modes using the same core;
- no backend and no runtime network dependency.

However, language matching is currently flat. A contribution declares the exact language IDs it supports. For example, a JSON tree renderer can support `json`, but it will not automatically appear for `json.table`, `json.cytoscape`, `json.model-graph`, or any future JSON dialect unless every child language is explicitly listed.

This becomes limiting as LocalEdit grows from basic syntax support into a pipeline workbench for related formats.

---

## 3. Target concept

### 3.1 Text as the root language

All languages are ultimately specializations of text:

```text
text
  text.plain
  markdown
  csv
  json
    json.table
      json.table.action-list
      json.table.risk-register
      json.table.endpoint-list
    json.model-graph
      json.model-graph.process
      json.model-graph.architecture
      json.model-graph.traceability
    json.cytoscape
    json.jsmind
    json.chart
    json.schema
      json.openapi
  xml
    xml.svg
    xml.bpmn
    xml.archimate-exchange
    xml.opml
  yaml
    yaml.openapi
    yaml.frontmatter
    yaml.config
  mermaid
  graphviz.dot
  javascript
  python
```

The editor still stores only text. The selected language tells the workbench which interpretations and tools are applicable.

### 3.2 Language levels

Use three practical levels:

| Level | Meaning | Examples |
|---|---|---|
| Syntax family | The general textual syntax or notation | `json`, `xml`, `yaml`, `markdown`, `csv` |
| Dialect | A structured convention within a syntax family | `json.table`, `json.model-graph`, `xml.bpmn`, `xml.svg` |
| Profile | A narrower semantic specialization | `json.table.action-list`, `json.model-graph.architecture` |

The terms are descriptive only. Internally, everything is a language node with an optional parent.

---

## 4. Non-negotiable inheritance rule

A contribution that applies to a parent language also applies to all descendants.

Examples:

- a `text` exporter applies to every document;
- a `json` formatter applies to `json.table`, `json.cytoscape`, and `json.model-graph.architecture`;
- a `json.table` renderer applies to `json.table.action-list` and `json.table.risk-register`;
- a `xml` tree renderer applies to `xml.svg`, `xml.bpmn`, and `xml.opml`.

Contributors should not be able to opt out of inheritance.

The system may warn the user when a generic contribution is being applied to a more specific child and semantic loss is likely, but inheritance itself should remain predictable and automatic.

---

## 5. Proposed language definition shape

Extend language definitions to include parentage, aliases, detection hints, and optional schema/profile metadata.

```js
{
  id: "json.table.action-list",
  name: "JSON Table - Action List",
  parentLanguageId: "json.table",

  syntaxFamily: "json",
  dialect: "table",
  profile: "action-list",

  fileExtensions: ["actions.json", "action-list.json"],
  mediaTypes: [
    "application/vnd.localedit.table.action-list+json"
  ],

  description: "A JSON-Table profile for action lists.",

  schema: "plugins/table/schemas/json-table-action-list.schema.json",

  detection: {
    confidence: "profile",
    requiredKeys: ["columns", "rows"],
    profileKey: "action-list"
  }
}
```

Keep the current flat fields where possible, but add normalized fields:

```js
{
  id: string,
  name: string,
  parentLanguageId: string | null,
  fileExtensions: string[],
  mediaTypes: string[],
  aliases: string[],
  description: string,
  schema?: string,
  detection?: object
}
```

For backward compatibility, the registry should accept both current and proposed naming variants:

```text
name or label
fileExtensions or extensions
mediaTypes or mimeTypes
mediaType or mediaTypes[0]
```

---

## 6. Language registry changes

### 6.1 Register the text root first

The core should register a root language:

```js
{
  id: "text",
  name: "Text",
  parentLanguageId: null,
  fileExtensions: [],
  mediaTypes: ["text/plain"]
}
```

Then register plain text as a child:

```js
{
  id: "text.plain",
  name: "Plain Text",
  parentLanguageId: "text",
  aliases: ["plain-text"],
  fileExtensions: ["txt", "text", "log"],
  mediaTypes: ["text/plain"]
}
```

The existing `plain-text` ID can remain as an alias during migration.

### 6.2 Parent validation

When registering a language:

1. normalize the definition;
2. validate `id` and `name`;
3. default missing parent to `text`, except for `text` itself;
4. reject parent cycles;
5. allow parent registration before or after child registration if the registry supports deferred validation;
6. keep aliases for compatibility.

### 6.3 Ancestry functions

Add functions like:

```js
get(languageId)
getCanonicalId(languageId)
getAncestors(languageId)
isSameOrDescendantOf(languageId, candidateParentId)
getSpecificityDistance(languageId, candidateParentId)
listApplicableLanguages(languageId)
```

For example:

```text
getAncestors("json.table.action-list")
  => ["json.table", "json", "text"]
```

```text
listApplicableLanguages("json.table.action-list")
  => ["json.table.action-list", "json.table", "json", "text"]
```

The order should be most-specific to least-specific.

---

## 7. Contribution matching changes

### 7.1 Current problem

Contribution matching currently behaves like:

```js
provider.languages.includes(currentLanguageId)
```

or equivalent exact matching.

This should be replaced by inheritance-aware matching.

### 7.2 New rule

A contribution matches a document if any declared supported language is equal to, or an ancestor of, the current document language.

Example:

```js
provider.languages = ["json"]
document.languageId = "json.table.action-list"
```

This matches because `json.table.action-list` descends from `json`.

### 7.3 Matching algorithm

```js
function contributionMatchesLanguage(providerLanguages, documentLanguageId, languageRegistry) {
  const declared = Array.isArray(providerLanguages) ? providerLanguages : [];

  // Empty still means global contribution.
  if (declared.length === 0) {
    return true;
  }

  return declared.some((supportedLanguageId) =>
    languageRegistry.isSameOrDescendantOf(documentLanguageId, supportedLanguageId)
  );
}
```

### 7.4 Sorting applicable contributions

When multiple contributions apply, sort by specificity:

1. contributions targeting the exact selected language;
2. contributions targeting the closest parent;
3. contributions targeting more generic parents;
4. global contributions.

For `json.table.action-list`, the preferred order is:

```text
json.table.action-list
json.table
json
text
<global>
```

This avoids hiding generic tools while still making the most relevant tools appear first.

---

## 8. Contribution metadata changes

The existing contribution shape can be preserved, but the meaning of language fields changes.

### 8.1 Highlighters

```js
{
  id: "json-highlighter",
  name: "JSON syntax highlighting",
  languages: ["json"]
}
```

This applies to all JSON descendants.

A more specific highlighter can still be added:

```js
{
  id: "json-table-highlighter",
  name: "JSON Table semantic highlighting",
  languages: ["json.table"]
}
```

### 8.2 Linters

Generic JSON parser linting applies to every JSON dialect:

```js
{
  id: "json-parse-linter",
  languages: ["json"]
}
```

Profile checks apply to profile descendants:

```js
{
  id: "action-list-linter",
  languages: ["json.table.action-list"]
}
```

### 8.3 Transformers

Transformers declare source and target language levels:

```js
{
  id: "json-table-to-csv",
  name: "JSON Table to CSV",
  inputLanguages: ["json.table"],
  outputLanguage: "csv",
  lossy: true,
  lossNotes: "Profile-specific metadata may be discarded."
}
```

When the current document is `json.table.action-list`, this transformer still applies.

### 8.4 Renderers

Renderers follow the same rule:

```js
{
  id: "json-tree-renderer",
  inputLanguages: ["json"]
}
```

```js
{
  id: "table-renderer",
  inputLanguages: ["json.table"]
}
```

### 8.5 Exporters

Exporters use `languages` inheritance:

```js
{
  id: "source-text-exporter",
  languages: ["text"]
}
```

This applies to every document.

---

## 9. Warning model

Because inheritance is mandatory, warnings should be advisory rather than blocking.

Warnings can be generated when:

- a transformer targets a parent language but the document is a more specific profile;
- the transformer is marked `lossy: true`;
- the contribution has `lossNotes`;
- the output language is less specific than the input language;
- a dialect/profile schema exists but the transformer does not declare that it preserves it.

Example warning:

```text
This transformer accepts JSON-Table, but the current document is JSON-Table-ActionList.
The transformation can run, but action-list-specific fields may be lost.
```

Warnings can be shown:

- in the transformer menu tooltip;
- in a pre-run confirmation if desired;
- in the status bar after execution;
- as informational diagnostics.

The warning is useful but not essential for the first implementation.

---

## 10. Document model changes

The current document model can remain text-based.

Recommended minimal extension:

```js
class DocumentModel {
  constructor(data) {
    this.text = typeof data.text === "string" ? data.text : "";
    this.languageId = data.languageId || "text.plain";
    this.fileName = data.fileName;
    this.mimeType = data.mimeType;
    this.lastModified = data.lastModified;
    this.languageDetection = data.languageDetection;
  }
}
```

Optional detection metadata:

```js
languageDetection: {
  source: "extension" | "mime" | "content" | "manual" | "transformer",
  confidence: 0.0-1.0,
  candidates: [
    { languageId: "json.table.action-list", confidence: 0.92 },
    { languageId: "json.table", confidence: 0.78 },
    { languageId: "json", confidence: 0.70 }
  ]
}
```

This remains metadata only. The editor still edits the `text` string.

---

## 11. File and content detection

Language detection should work in layers:

1. explicit language selected by user;
2. transformer output language;
3. file extension;
4. media type;
5. content sniffing;
6. fallback to `text.plain`.

When content sniffing is added, it should be conservative:

- file extension should select `json`, `xml`, `yaml`, etc.;
- content detection may refine `json` to `json.table`, `json.cytoscape`, or `json.model-graph`;
- profile detection may refine `json.table` to `json.table.action-list`.

The system should avoid surprising automatic changes after the user manually selects a language.

---

## 12. Pipeline model implications

Pipelines become easier to describe because each step has explicit language input and output.

Example:

```json
{
  "id": "markdown-tasks-to-action-list-table",
  "name": "Markdown tasks to Action List table",
  "steps": [
    {
      "transformerId": "markdown-tasks-to-json-table-action-list",
      "from": "markdown",
      "to": "json.table.action-list"
    },
    {
      "rendererId": "table-renderer",
      "accepts": "json.table"
    }
  ]
}
```

A pipeline planner can also find implicit routes:

```text
markdown
  -> json.table.action-list
  -> json.table
  -> csv
```

because `json.table.action-list` can be treated as `json.table` when needed.

---

## 13. UI changes

### 13.1 Language selector

The language selector should show a hierarchy or grouped list:

```text
Text
  Plain Text
  Markdown
  CSV
  JSON
    JSON Table
      Action List
      Risk Register
      Endpoint List
    JSON Model Graph
      Architecture
      Process
      Traceability
    Cytoscape JSON
  XML
    SVG
    BPMN
    ArchiMate Exchange
  YAML
    OpenAPI
    Front Matter
```

### 13.2 Contribution menus

Transformer, renderer, diagnostics, and exporter menus should include inherited contributions, ideally grouped by specificity:

```text
For JSON-Table-ActionList:

Action List tools
Table tools
JSON tools
Text tools
```

### 13.3 Tooltips

For inherited tools, tooltips should show why the tool appears:

```text
Available because JSON-Table-ActionList extends JSON-Table.
```

For lossy transformations:

```text
May discard ActionList-specific metadata.
```

---

## 14. Render session implications

Render sessions should keep both:

- the renderer ID;
- the document language ID used when the renderer was opened.

This helps the render window display something like:

```text
Rendering: JSON-ModelGraph-Architecture using Cytoscape Graph Renderer
```

If the source document later changes language, refresh should still run if the renderer applies through inheritance. If not, the render window should show a clear message rather than silently failing.

---

## 15. Suggested core file changes

### 15.1 `core/language-registry.js`

Add:

- canonicalization;
- alias handling;
- parent links;
- ancestor lookup;
- descendant matching;
- specificity distance;
- hierarchical list output;
- extension and media-type inference using longest extension and most specific language.

### 15.2 `core/plugin-registry.js`

Replace exact language matching with registry-backed inheritance matching.

Current-style calls:

```js
getProviders(kind, languageId, languageField)
```

should use:

```js
getProviders(kind, languageId, languageField, languageRegistry)
```

or the plugin registry should receive the language registry in its constructor.

### 15.3 `core/app.js`

Register `text` and `text.plain` before plugin languages.

When registering plugin languages, ensure parents are known or queued.

When updating UI, pass inherited contribution matches to toolbar and panels.

### 15.4 `core/toolbar.js`

Display hierarchical languages and inherited contributions.

Optionally group tools by specificity.

### 15.5 `core/transform-manager.js`

When running a transformer:

- compute whether it is exact or inherited;
- pass `matchedLanguageId` and `specificityDistance` in context;
- preserve output language when provided;
- support warnings for lossy inherited transforms.

### 15.6 `core/render-manager.js`

Pass language metadata to render sessions so render windows can display the specific document language and inherited renderer match.

### 15.7 `core/export-manager.js`

Use inherited exporter matching.

Generic source/text export should become a `text` exporter.

### 15.8 `core/diagnostics-manager.js`

Run all inherited linters from most generic to most specific or from most specific to most generic.

Recommended order:

```text
text parser/checks
syntax-family parser checks
specific dialect/profile checks
```

For example:

```text
text checks
json parse linter
json.table schema linter
action-list profile linter
```

This order avoids profile linters producing noisy errors when generic parsing already fails.

---

## 16. Backward compatibility

Existing plugins should continue to work.

Compatibility measures:

- accept existing `languageDefinitions` fields;
- map `plain-text` to `text.plain`;
- allow contribution fields to keep using `languages` and `inputLanguages`;
- treat unknown parent as `text` during initial transition, but report a warning in plugin manager;
- keep existing language IDs as aliases where needed.

Examples:

```text
cytoscape -> json.cytoscape
svg -> xml.svg
graphviz -> graphviz.dot
plain-text -> text.plain
```

During migration, both IDs can work:

```text
svg, xml.svg
cytoscape, json.cytoscape
plain-text, text.plain
```

The UI should prefer the new canonical IDs.

---

## 17. Testing strategy

Minimum tests:

1. registering `text`, `json`, `json.table`, `json.table.action-list` works;
2. `json` renderer appears for `json.table.action-list`;
3. `json.table` renderer appears for `json.table.action-list`;
4. `json.cytoscape` renderer does not appear for `json.table.action-list` unless it targets a shared ancestor;
5. `text` exporter appears for all languages;
6. language aliases resolve correctly;
7. longest extension match still works;
8. plugin deactivation removes inherited contributions;
9. diagnostics run in a stable order;
10. transform output language is preserved and canonicalized.

Regression tests should confirm existing packaged plugins still appear for their existing files.

---

## 18. Implementation sequence

### Phase 1 — Registry foundation

- Add `text` root.
- Add parent links, aliases, and canonical IDs.
- Add ancestry functions.
- Keep old IDs working.

### Phase 2 — Inherited contribution matching

- Update plugin registry matching.
- Update transformers, renderers, exporters, linters, and highlighters to use inherited matching.
- Sort contributions by specificity.

### Phase 3 — UI clarity

- Show hierarchical language selector.
- Group inherited tools by specificity.
- Add optional inherited/lossy warnings.

### Phase 4 — Language migration

- Rename or alias existing languages:
  - `plain-text` -> `text.plain`
  - `svg` -> `xml.svg`
  - `cytoscape` -> `json.cytoscape`
  - `graphviz` -> `graphviz.dot`
- Add `yaml`, `json.table`, `json.model-graph`, and other new dialects.

### Phase 5 — Pipeline planner

- Use inheritance in pipeline discovery.
- Allow direct and inherited transformer matches.
- Mark lossy routes.

---

## 19. Design decision summary

| Decision | Recommendation |
|---|---|
| Core document format | Keep as text string |
| Root language | `text` |
| Plain text | `text.plain`, with `plain-text` alias |
| Language model | Tree of languages, dialects, and profiles |
| Contribution inheritance | Mandatory parent-to-child inheritance |
| Opt-out | Not supported |
| Warnings | Advisory only |
| Matching order | Most specific first |
| Migration | Use aliases for existing IDs |
| Pipeline effect | More reusable and discoverable transformations |

---

## 20. Conclusion

Language hierarchy support is a small structural change with large leverage. It keeps LocalEdit faithful to its core design: one local text editor, many interpretations. It also avoids duplicating contributions across every dialect and profile.

The most important architectural move is to treat `text` as the universal root, then allow every more specific language to inherit tools from its parents.
