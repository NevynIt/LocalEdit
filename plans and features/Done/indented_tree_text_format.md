# Indented Tree Text Format

A lightweight plain-text format for hierarchical notes, with optional extensions for ids, cross-links, types, tags, attributes, extra information, styles, includes, and views.

The format is designed to be easy to write by hand and easy to transform into formats such as Mermaid, DOT, JSON, XML, SVG diagrams, mind maps, graph databases, or other structured models.

---

## 1. Design approach

The format is intentionally layered.

A parser or transformer may implement only the basic format, or may add extensions one by one.

The basic format only defines a hierarchy.

Extensions add optional semantics without changing the basic indentation model.

Recommended implementation levels:

| Level       | Capability                  |
| ----------- | --------------------------- |
| Core        | Indentation-based hierarchy |
| Extension 1 | Node ids                    |
| Extension 2 | Cross-links                 |
| Extension 3 | Node types                  |
| Extension 4 | Tags and attributes         |
| Extension 5 | Extra information blocks    |
| Extension 6 | Document metadata           |
| Extension 7 | Styles                      |
| Extension 8 | Includes                    |
| Extension 9 | Views                       |

---

# Part I — Core format

## 2. Core idea

Each non-empty line defines one node.

Hierarchy is defined by indentation.

Example:

```text
Root
 branch 1
  subbranch
   more inside
 branch 2
 branch 3
  sub1
  sub2
  sub3
```

The core format contains no ids, no links, no types, and no attributes.

It is simply an indented tree or forest.

---

## 3. Indentation rules

Indentation follows a Python-like indentation stack.

There is no mandatory fixed indentation width such as two or four spaces.

Rules:

* A greater indentation than the previous node creates a child level.
* The same indentation creates a sibling of the previous node.
* A smaller indentation closes the current branch and returns to a previous indentation level.
* A dedent must match a previously seen indentation level.
* The parent of a node is the nearest previous node with the immediately lower indentation level.
* Empty lines may be ignored or preserved as formatting metadata.

Tabs may either be rejected or normalized before parsing. A strict parser should reject ambiguous mixing of tabs and spaces.

---

## 4. Core parsed model

A core node can be represented as:

```json
{
  "internalId": "n3",
  "label": "subbranch",
  "indent": 2,
  "parent": "n2",
  "children": []
}
```

Field meanings:

| Field        | Meaning                               |
| ------------ | ------------------------------------- |
| `internalId` | Parser-generated id                   |
| `label`      | Visible text of the node              |
| `indent`     | Raw or normalized indentation level   |
| `parent`     | Parent node inferred from indentation |
| `children`   | Child nodes inferred from indentation |

---

## 5. Core grammar

```ebnf
document      ::= line*

line          ::= indentation label newline

indentation   ::= whitespace*

label         ::= any text except newline
```

The parser should trim leading indentation and may trim surrounding whitespace from the label.

---

# Part II — Extensions

Each extension below is optional.

A parser may implement any subset of them, as long as each implemented extension preserves the core indentation semantics.

---

## Extension 1 — Node ids

A node may declare one id.

The id is declared with `&id`.

```text
&id node label
```

Rules:

* The id must appear at the beginning of the line content, immediately after indentation.
* Only one id is allowed per node.
* The id is metadata and is not part of the visible label.
* Ids should be unique within a document.
* If `&something` appears elsewhere in the label, it is treated as normal text.

Example:

```text
&target target text
```

Parsed as:

```json
{
  "id": "target",
  "label": "target text"
}
```

Recommended identifier syntax:

```text
[A-Za-z][A-Za-z0-9_-]*
```

---

## Extension 2 — Cross-links

A node may declare outgoing links at the end of the line.

Links are written as a comma-separated list of `@id` references.

```text
node label @target1, @target2, @target3
```

Rules:

* Links must appear at the end of the line.
* Multiple links are separated by commas.
* The referenced name is the id of the target node.
* The referenced name is not the label of the link.
* Unless typed links are implemented, cross-links are unlabeled.
* If `@something` appears inside the label rather than in the final link list, it is treated as normal text.

Example:

```text
sub3 @target
```

Parsed as:

```json
{
  "label": "sub3",
  "links": [
    {
      "target": "target"
    }
  ]
}
```

The cross-link is resolved by finding the node that declares:

```text
&target ...
```

---

## Extension 2A — Typed cross-links

A parser may allow typed links using `@type:target`.

```text
requirement text @verified-by:test1, @satisfies:need1
```

Parsed as:

```json
{
  "links": [
    {
      "type": "verified-by",
      "target": "test1"
    },
    {
      "type": "satisfies",
      "target": "need1"
    }
  ]
}
```

Untyped links may be treated as having a default type such as `related-to`.

```text
node text @other
```

Equivalent semantic interpretation:

```json
{
  "type": "related-to",
  "target": "other"
}
```

---

## Extension 3 — Node types

A node may declare a type using square brackets.

```text
[type] node label
```

If ids are also used, the type appears after the id.

```text
&id [type] node label
```

Examples:

```text
[requirement] System shall log events
&risk1 [risk] Database may become unavailable
```

Parsed as:

```json
{
  "id": "risk1",
  "type": "risk",
  "label": "Database may become unavailable"
}
```

Rules:

* The type must appear near the beginning of the line content.
* If an id is present, the type must follow the id.
* If no id is present, the type must appear before the label.
* The type is metadata and is not part of the visible label.
* If `[something]` appears later in the label, it is treated as normal text.

---

## Extension 4 — Tags and attributes

Tags and attributes provide lightweight classification and metadata.

### Tags

Tags use `#tag`.

```text
node label #important #architecture
```

Parsed as:

```json
{
  "label": "node label",
  "tags": ["important", "architecture"]
}
```

Tags are useful for filtering, styling, or grouping.

### Attributes

Attributes use a trailing `{key: value}` block.

```text
node label {priority: high, status: draft}
```

Parsed as:

```json
{
  "label": "node label",
  "attributes": {
    "priority": "high",
    "status": "draft"
  }
}
```

Recommended rule:

* Tags and attributes should be parsed as metadata only when they appear at the end of the line.
* Tags should appear before the attribute block.
* If cross-links are also used, the recommended order is:

```text
&id [type] label #tag1 #tag2 {key: value} @link1, @type:link2
```

This keeps the link list as the final part of the line.

---

## Extension 5 — Extra information blocks

A node may have an extra information block.

This is not a multiline continuation of the label.

The node label remains the single-line label on the node line. The extra information block is stored separately, for example as a `details` or `notes` attribute.

Example:

```text
&decision1 [decision] Use local-only plugins
| Rationale:
| The main security goal is to prevent exfiltration.
| Plugins may corrupt local content, but should not call external services.
```

Parsed as:

```json
{
  "id": "decision1",
  "type": "decision",
  "label": "Use local-only plugins",
  "details": "Rationale:\nThe main security goal is to prevent exfiltration.\nPlugins may corrupt local content, but should not call external services."
}
```

Rules:

* Extra information lines start with `|` after indentation.
* The extra information block must immediately follow the node line it belongs to.
* The indentation of the first `|` line defines the indentation of the extra information block.
* The indentation of the extra information block must be equal to or greater than the indentation of the node it belongs to.
* All lines in the same extra information block must use the same indentation.
* Extra information lines do not create child nodes.
* Extra information lines do not modify the node label.
* The text after `|` is added to the node's extra information attribute.
* A renderer may show or hide this information independently from the node label.

Example with the same indentation as the node:

```text
Root
 child node
 | This is extra information for child node.
 | It is not a child of child node.
  grandchild
```

Example with greater indentation than the node:

```text
Root
 child node
  | This is also extra information for child node.
  | The detail block is more indented, but consistently so.
  grandchild
```

In both examples, the `|` lines belong to `child node` and do not create child nodes.

Invalid or ambiguous:

```text
Root
 child node
  | This starts the extra information block.
 | This line has different indentation, so it does not belong to the same block.
```

A strict parser should reject an inconsistent extra information block. A tolerant parser may stop the block at the last consistently indented `|` line and report a warning.

---

## Extension 6 — Document metadata

A document may start with a metadata block.

YAML-like front matter is recommended because it is familiar and easy to parse.

```text
---
title: Plugin security model
version: 1
defaultLinkType: related-to
---
```

Rules:

* Metadata, if present, must appear before the first node.
* Metadata applies to the whole document.
* Metadata does not create nodes.
* A parser that does not implement metadata may ignore the block or reject the file, depending on parser mode.

---

## Extension 7 — Styles

Styles are optional rendering hints.

Style rules are global directives and must use the `%style` directive form.

Recommended syntax:

```text
%style selector { property: value; property: value; }
```

The recommended form is one style rule per line, to remain consistent with the line-oriented nature of the format:

```text
%style [requirement] { shape: rectangle; fill: #e8f1ff; stroke: #3b73d9; }
%style [risk] { shape: hexagon; fill: #ffe8e8; stroke: #cc3333; }
%style #important { font-weight: bold; }
```

A tolerant parser may also accept multiline style rules because `{` and `}` provide clear boundaries:

```text
%style [risk] {
  shape: hexagon;
  fill: #ffe8e8;
  stroke: #cc3333;
}
```

Rules:

* Style directives do not create nodes.
* Style directives do not affect the semantic graph.
* Style selectors may refer to nodes, node ids, node types, tags, attributes, cross-links, relationship types, or hierarchy edges.
* A parser may ignore styles when producing non-visual output.
* Style properties should use CSS property names and CSS-compatible values wherever possible.
* Diagram-specific properties may be used where CSS has no natural equivalent.

Recommended selector syntax:

| Selector        | Meaning                            |
| --------------- | ---------------------------------- |
| `*`             | all nodes                          |
| `&id`           | node with id                       |
| `[type]`        | nodes of type                      |
| `#tag`          | nodes with tag/class               |
| `{key=value}`   | nodes with attribute value         |
| `->[link-type]` | links of a given relationship type |
| `->`            | all cross-links                    |
| `=>`            | hierarchy edges                    |

Examples:

```text
%style * { font-size: 12px; }
%style &req1 { stroke-width: 3px; }
%style [requirement] { shape: rectangle; fill: #e8f1ff; }
%style #important { font-weight: bold; }
%style {status=draft} { opacity: 0.6; }
%style ->[verified-by] { stroke-dasharray: 4 2; }
%style -> { stroke: #888; }
%style => { stroke: #999; }
```

Styles should be considered optional presentation metadata, not core data.

---

## Extension 8 — Includes

A document may include another file.

Recommended syntax:

```text
%include other-file.itt
```

Rules:

* Include directives must use the `%include` directive form.
* An include inserts or references another document, depending on transformer policy.
* A strict implementation should protect against circular includes.
* A security-conscious implementation should restrict include paths.

---

## Extension 9 — Views

Views define named projections over the same document.

View definitions are global directives and must use the `%view` directive form.

Views use the same selector syntax as styles for include and exclude rules:

| Selector        | Meaning                            |
| --------------- | ---------------------------------- |
| `*`             | all nodes                          |
| `&id`           | node with id                       |
| `[type]`        | nodes of type                      |
| `#tag`          | nodes with tag/class               |
| `{key=value}`   | nodes with attribute value         |
| `->[link-type]` | links of a given relationship type |
| `->`            | all cross-links                    |
| `=>`            | hierarchy edges                    |

Example:

```text
%view requirements {
  include: [requirement]
  include: ->[satisfies], ->[verified-by]
  exclude: #draft
}

%view risks {
  include: [risk]
  include: ->[mitigated-by]
  exclude: {status=closed}
}
```

A transformer may use views to generate different outputs from the same source.

For example:

* a full hierarchy;
* a requirements traceability graph;
* a risk view;
* a dependency view;
* a filtered Mermaid or DOT diagram;
* a JSON export containing only selected nodes and links.

Rules:

* View directives do not create nodes.
* Views are optional transformation instructions.
* A parser may store views without applying them.
* A transformer may choose which view to render.
* `include` rules select nodes or edges that belong to the view.
* `exclude` rules remove nodes or edges from the view after inclusion.
* If a view contains no explicit `include`, a transformer may treat it as including `*`, `->`, and `=>`, or may require at least one explicit include, depending on implementation mode.

---

# Part III — Combined line syntax

If all line-based extensions are enabled, the recommended line structure is:

```text
[indentation] [&id ] [[type] ] label [#tag ...] [{key: value, ...}] [@link, @type:link, ...]
```

Examples:

```text
&req1 [requirement] System shall log events #security {priority: high} @verified-by:test1, @risk7
&risk7 [risk] Log storage may become unavailable #ops {severity: medium}
```

The recommended parsing order is:

1. Read indentation.
2. Detect optional leading `&id`.
3. Detect optional leading `[type]`.
4. Detect optional trailing link list.
5. Detect optional trailing attribute block.
6. Detect optional trailing tags.
7. The remaining text is the visible label.
8. Attach any immediately following aligned `|` lines as extra information.
9. Resolve parent-child hierarchy using the indentation stack.
10. Resolve cross-links by matching `@id` references to declared `&id` values.

---

## Full parsed node model

A fully parsed node may look like this:

```json
{
  "internalId": "n10",
  "id": "req1",
  "type": "requirement",
  "label": "System shall log events",
  "indent": 0,
  "parent": null,
  "children": [],
  "tags": ["security"],
  "attributes": {
    "priority": "high"
  },
  "details": "Additional explanatory text, if provided with aligned | lines.",
  "links": [
    {
      "type": "verified-by",
      "target": "test1"
    },
    {
      "type": "related-to",
      "target": "risk7"
    }
  ]
}
```

---

# Part IV — Validation

A validator may implement different levels of strictness.

## Core validation

For the core format:

* indentation must be resolvable using the indentation stack;
* dedents must return to a previous indentation level;
* node labels should not be empty.

## Id validation

If ids are enabled:

* a node may have at most one id;
* ids should be unique;
* ids should match the supported identifier syntax.

## Link validation

If links are enabled:

* link lists must appear at the end of the line;
* comma-separated links must be well formed;
* every `@id` should resolve to a declared `&id`;
* duplicate links may be rejected or ignored.

## Extra information validation

If extra information blocks are enabled:

* `|` blocks must immediately follow the node they belong to;
* the first `|` line establishes the detail block indentation;
* the detail block indentation must be equal to or greater than the node indentation;
* all `|` lines in the same block must use the same indentation;
* `|` lines must not be treated as child nodes;
* extra information should be stored separately from the label.

## Directive validation

If directives are enabled:

* global directives must begin with `%`;
* `%style`, `%view`, and `%include` should be recognized before node parsing;
* unknown `%` directives may be ignored, warned about, or rejected depending on parser mode.

---

# Part V — Design principles

The format should remain readable as plain text.

The core should remain very small.

Extensions should be optional and independent where possible.

The hierarchy should always be recoverable even if a transformer ignores advanced extensions.

Rendering details such as styles and views should not be required to understand the semantic content.

The same source file should be usable both as a simple note-taking format and as an intermediate representation for richer graph, document, or diagram transformations.
