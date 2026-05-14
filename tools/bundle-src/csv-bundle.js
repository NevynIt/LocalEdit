import Papa from "papaparse";

function parse(source, options = {}) {
  return Papa.parse(source || "", {
    delimiter: options.delimiter || "",
    skipEmptyLines: false
  });
}

window.EditorWorkbenchCsv = {
  Papa,
  parse
};
