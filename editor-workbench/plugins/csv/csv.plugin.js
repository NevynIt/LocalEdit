(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    csv: "plugins/csv/runtime/csv.bundle.js"
  };

  function requireRuntime(context) {
    if (!context || !context.runtime || typeof context.runtime.ensureScripts !== "function") {
      throw new Error("Plugin runtime loader is not available.");
    }
    return context.runtime;
  }

  function requireCsvTools() {
    if (!global.EditorWorkbenchCsv || typeof global.EditorWorkbenchCsv.parse !== "function") {
      throw new Error("CSV runtime bundle is not loaded.");
    }
    return global.EditorWorkbenchCsv;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function detectDelimiter(documentModel) {
    var fileName = (documentModel.fileName || "").toLowerCase();
    if (fileName.endsWith(".tsv")) {
      return "\t";
    }
    var text = documentModel.text || "";
    if (text.indexOf("\t") !== -1 && text.indexOf(",") === -1) {
      return "\t";
    }
    return ",";
  }

  function isEmptyRow(row) {
    return !row || row.every(function (cell) {
      return String(cell || "").trim() === "";
    });
  }

  function lineOffsets(text) {
    var offsets = [0];
    for (var index = 0; index < text.length; index += 1) {
      if (text[index] === "\n") {
        offsets.push(index + 1);
      }
    }
    return offsets;
  }

  async function parseCsv(documentModel, context) {
    await requireRuntime(context).ensureScripts(RUNTIME_PATHS.csv);
    return requireCsvTools().parse(documentModel.text || "", {
      delimiter: detectDelimiter(documentModel)
    });
  }

  async function lintCsv(documentModel, context) {
    var result = await parseCsv(documentModel, context);
    var diagnostics = [];
    var offsets = lineOffsets(documentModel.text || "");

    (result.errors || []).forEach(function (error) {
      var row = typeof error.row === "number" ? error.row : 0;
      var from = offsets[row] || 0;
      diagnostics.push({
        from: from,
        to: from + 1,
        severity: "error",
        message: error.message || "CSV parse error.",
        source: "CSV"
      });
    });

    var expected = null;
    (result.data || []).forEach(function (row, index) {
      if (isEmptyRow(row)) {
        return;
      }

      if (expected === null) {
        expected = row.length;
        return;
      }

      if (row.length !== expected) {
        var from = offsets[index] || 0;
        diagnostics.push({
          from: from,
          to: from + 1,
          severity: "warning",
          message: "Row " + (index + 1) + " has " + row.length + " column" + (row.length === 1 ? "" : "s") + "; expected " + expected + ".",
          source: "CSV"
        });
      }
    });

    return diagnostics;
  }

  function renderTable(result) {
    var rows = result.data || [];
    var columnCount = rows.reduce(function (max, row) {
      return Math.max(max, row ? row.length : 0);
    }, 0);
    var head = "<thead><tr><th>#</th>";
    for (var column = 0; column < columnCount; column += 1) {
      head += "<th>Column " + (column + 1) + "</th>";
    }
    head += "</tr></thead>";

    var body = rows.map(function (row, rowIndex) {
      var cells = "<th>" + (rowIndex + 1) + "</th>";
      for (var column = 0; column < columnCount; column += 1) {
        cells += "<td>" + escapeHtml(row && row[column] != null ? row[column] : "") + "</td>";
      }
      return "<tr>" + cells + "</tr>";
    }).join("");

    return "<div class=\"csv-table-wrap\"><table class=\"csv-table\">" + head + "<tbody>" + body + "</tbody></table></div>";
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "csv-core",
    name: "CSV",
    version: "0.1.0",
    description: "CSV and TSV linting with table preview.",
    languages: ["csv"],
    languageDefinitions: [
      {
        id: "csv",
        label: "CSV/TSV",
        extensions: ["csv", "tsv"],
        mimeTypes: ["text/csv", "text/tab-separated-values"]
      }
    ],
    highlighters: [],
    linters: [
      {
        id: "csv-width-linter",
        name: "CSV row width",
        languages: ["csv"],
        lint: lintCsv
      }
    ],
    transformers: [],
    renderers: [
      {
        id: "csv-table-preview",
        name: "CSV Table Preview",
        inputLanguages: ["csv"],
        outputKind: "html",
        render: async function (documentModel, context) {
          var result = await parseCsv(documentModel, context);
          return {
            kind: "html",
            content: renderTable(result),
            mimeType: "text/html"
          };
        }
      }
    ],
    exporters: []
  });
})(window);
