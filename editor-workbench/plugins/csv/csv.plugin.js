(function (global) {
  "use strict";

  var RUNTIME_PATHS = {
    csv: "plugins/csv/runtime/csv.bundle.js"
  };

  var CSV_VIEWER_STYLE = [
    "<style>",
    ".csv-viewer { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px; max-height: calc(100vh - 32px); min-height: 0; }",
    ".csv-header-checkbox { align-self: center; margin: 0; }",
    ".csv-viewer-options { align-self: center; color: var(--muted, #5d6b7c); cursor: pointer; font-size: 12px; font-weight: 700; }",
    ".csv-table-wrap { grid-column: 1 / -1; max-width: 100%; max-height: calc(100vh - 88px); overflow: auto; border: 1px solid var(--border, #cbd3df); border-radius: 6px; background: var(--surface, #ffffff); }",
    ".csv-header-table { display: none; }",
    ".csv-header-checkbox:checked ~ .csv-default-table { display: none; }",
    ".csv-header-checkbox:checked ~ .csv-header-table { display: block; }",
    ".csv-table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 13px; }",
    ".csv-table th, .csv-table td { max-width: 360px; border: 1px solid var(--border, #cbd3df); padding: 6px 8px; text-align: left; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }",
    ".csv-table th { position: sticky; top: 0; z-index: 1; background: var(--surface-strong, #eef1f5); color: var(--muted, #5d6b7c); font-weight: 700; }",
    ".csv-table tbody th { left: 0; z-index: 2; }",
    "</style>"
  ].join("\n");

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

  function renderColumnTitle(value, column) {
    var title = String(value == null ? "" : value).trim();
    return title || "Column " + (column + 1);
  }

  function renderTable(result, options) {
    var tableOptions = options || {};
    var rows = result.data || [];
    var bodyRows = tableOptions.firstRowAsHeader ? rows.slice(1) : rows;
    var columnCount = rows.reduce(function (max, row) {
      return Math.max(max, row ? row.length : 0);
    }, 0);
    var head = "<thead><tr><th>#</th>";
    var headers = tableOptions.firstRowAsHeader && rows.length > 0 ? rows[0] : [];
    for (var column = 0; column < columnCount; column += 1) {
      head += "<th>" + escapeHtml(tableOptions.firstRowAsHeader ? renderColumnTitle(headers[column], column) : "Column " + (column + 1)) + "</th>";
    }
    head += "</tr></thead>";

    var body = bodyRows.map(function (row, rowIndex) {
      var sourceRowNumber = tableOptions.firstRowAsHeader ? rowIndex + 2 : rowIndex + 1;
      var cells = "<th>" + sourceRowNumber + "</th>";
      for (var column = 0; column < columnCount; column += 1) {
        cells += "<td>" + escapeHtml(row && row[column] != null ? row[column] : "") + "</td>";
      }
      return "<tr>" + cells + "</tr>";
    }).join("");

    var className = "csv-table-wrap" + (tableOptions.className ? " " + tableOptions.className : "");
    return "<div class=\"" + className + "\"><table class=\"csv-table\">" + head + "<tbody>" + body + "</tbody></table></div>";
  }

  function renderViewer(result) {
    return [
      CSV_VIEWER_STYLE,
      "<section class=\"csv-viewer\">",
      "<input class=\"csv-header-checkbox\" id=\"csv-first-row-header\" type=\"checkbox\">",
      "<label class=\"csv-viewer-options\" for=\"csv-first-row-header\">Interpret first row as titles</label>",
      renderTable(result, { className: "csv-default-table" }),
      renderTable(result, { className: "csv-header-table", firstRowAsHeader: true }),
      "</section>"
    ].join("");
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push(global.EditorPluginContracts.fromLegacy({
    id: "csv-core",
    name: "CSV",
    version: "0.1.0",
    description: "CSV and TSV linting with table preview.",
    documentationUrl: "https://datatracker.ietf.org/doc/html/rfc4180",
    getExampleDocument: function () {
      return {
        fileName: "example.csv",
        languageId: "text.csv",
        mimeType: "text/csv",
        text: [
          "name,language,status",
          "Markdown,markdown,loaded",
          "JSON,json,available",
          "XML,xml,available"
        ].join("\n")
      };
    },
    languages: ["text.csv"],
    languageDefinitions: [
      {
        id: "text.csv",
        label: "CSV/TSV",
        aliases: ["csv"],
        extensions: ["csv", "tsv"],
        mimeTypes: ["text/csv", "text/tab-separated-values"]
      }
    ],
    highlighters: [],
    linters: [
      {
        id: "csv-width-linter",
        name: "CSV row width",
        languages: ["text.csv"],
        lint: lintCsv
      }
    ],
    transformers: [],
    renderers: [],
    exporters: []
  }));
})(window);
