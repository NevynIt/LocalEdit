import { parse, parseDocument, stringify } from "yaml";

function parseYaml(source) {
  return parse(source || "");
}

function parseYamlDocument(source) {
  return parseDocument(source || "", {
    prettyErrors: false
  });
}

function diagnosticFromYamlError(error, severity = "error") {
  const pos = Array.isArray(error && error.pos) && Number.isFinite(error.pos[0])
    ? error.pos[0]
    : 0;
  return {
    from: Math.max(0, pos),
    to: Math.max(1, pos + 1),
    severity,
    message: error && error.message ? error.message : String(error || "YAML parse error."),
    source: "YAML"
  };
}

function lintYaml(source) {
  const documentModel = parseYamlDocument(source || "");
  return [
    ...(documentModel.errors || []).map((error) => diagnosticFromYamlError(error, "error")),
    ...(documentModel.warnings || []).map((warning) => diagnosticFromYamlError(warning, "warning"))
  ];
}

function toJsonText(source, space = 2) {
  return JSON.stringify(parseYaml(source || ""), null, space);
}

function fromJsonText(source) {
  return stringify(JSON.parse(source || ""));
}

window.EditorWorkbenchYaml = {
  parseYaml,
  parseYamlDocument,
  stringifyYaml: stringify,
  lintYaml,
  toJsonText,
  fromJsonText
};
