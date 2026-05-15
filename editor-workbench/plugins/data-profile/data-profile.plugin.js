(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseJson(text) {
    return JSON.parse(text || "");
  }

  function fileName(input, suffix, extension) {
    var sourceName = input && input.document && input.document.fileName || "table";
    return sourceName.replace(/\.[^.]+$/, "") + suffix + extension;
  }

  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseTable(input) {
    var table = parseJson(input.text || "");
    if (!table || table.format !== "json.table") {
      throw new Error("Expected json.table input.");
    }
    return table;
  }

  function columnLabels(table) {
    return list(table.columns).map(function (column, index) {
      return column.label || column.id || "Column " + (index + 1);
    });
  }

  function tableRows(table) {
    return list(table.rows).map(function (row) {
      return list(row.cells);
    });
  }

  function numericValue(value) {
    var text = String(value == null ? "" : value).trim().replace(/,/g, "");
    if (!text) {
      return null;
    }
    var number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function tableToProfile(input) {
    var table = parseTable(input);
    var labels = columnLabels(table);
    var rows = tableRows(table);
    var columns = labels.map(function (label, columnIndex) {
      var values = rows.map(function (row) {
        return row[columnIndex] == null ? "" : String(row[columnIndex]);
      });
      var nonEmpty = values.filter(function (value) {
        return value.trim() !== "";
      });
      var numeric = nonEmpty.map(numericValue).filter(function (value) {
        return value !== null;
      });
      var distinct = new Set(nonEmpty.map(function (value) {
        return value.trim();
      }));
      return {
        id: list(table.columns)[columnIndex] && list(table.columns)[columnIndex].id || "column-" + (columnIndex + 1),
        label: label,
        rows: values.length,
        nonEmpty: nonEmpty.length,
        empty: values.length - nonEmpty.length,
        distinct: distinct.size,
        numericCount: numeric.length,
        numericMin: numeric.length ? Math.min.apply(null, numeric) : null,
        numericMax: numeric.length ? Math.max.apply(null, numeric) : null,
        numericAverage: numeric.length ? numeric.reduce(function (sum, value) { return sum + value; }, 0) / numeric.length : null
      };
    });
    return {
      text: JSON.stringify({
        format: "json.profile",
        version: "1.0",
        profileType: "table",
        metadata: {
          sourceLanguage: input.languageId,
          title: table.metadata && table.metadata.title || input.document && input.document.fileName || "Table"
        },
        summary: {
          rows: rows.length,
          columns: labels.length,
          cells: rows.length * labels.length
        },
        columns: columns
      }, null, 2),
      languageId: "json.profile",
      fileName: fileName(input, ".profile", ".json"),
      mimeType: "application/json"
    };
  }

  function profileToMarkdown(input) {
    var profile = parseJson(input.text || "");
    var columns = list(profile.columns);
    var lines = [
      "# Data Profile",
      "",
      "- Rows: " + (profile.summary && profile.summary.rows || 0),
      "- Columns: " + (profile.summary && profile.summary.columns || columns.length),
      "- Cells: " + (profile.summary && profile.summary.cells || 0),
      "",
      "| Column | Non-empty | Empty | Distinct | Numeric | Min | Max | Average |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
    ];
    columns.forEach(function (column) {
      lines.push("| " + [
        column.label,
        column.nonEmpty,
        column.empty,
        column.distinct,
        column.numericCount,
        column.numericMin == null ? "" : column.numericMin,
        column.numericMax == null ? "" : column.numericMax,
        column.numericAverage == null ? "" : Math.round(column.numericAverage * 100) / 100
      ].map(function (value) {
        return String(value == null ? "" : value).replace(/\|/g, "\\|");
      }).join(" | ") + " |");
    });
    return {
      text: lines.join("\n"),
      languageId: "text.markdown",
      fileName: fileName(input, ".profile", ".md"),
      mimeType: "text/markdown"
    };
  }

  function tableToChart(input) {
    var table = parseTable(input);
    var labels = columnLabels(table);
    var rows = tableRows(table);
    var labelColumn = 0;
    var valueColumn = -1;
    for (var columnIndex = 0; columnIndex < labels.length; columnIndex += 1) {
      var numericCount = rows.reduce(function (count, row) {
        return count + (numericValue(row[columnIndex]) === null ? 0 : 1);
      }, 0);
      if (numericCount > 0 && valueColumn === -1) {
        valueColumn = columnIndex;
      }
    }
    if (valueColumn === -1) {
      valueColumn = Math.min(1, labels.length - 1);
    }
    if (valueColumn === labelColumn && labels.length > 1) {
      labelColumn = valueColumn === 0 ? 1 : 0;
    }
    var data = rows.map(function (row, index) {
      var value = numericValue(row[valueColumn]);
      return {
        label: String(row[labelColumn] == null || row[labelColumn] === "" ? "Row " + (index + 1) : row[labelColumn]),
        value: value == null ? 0 : value
      };
    });
    return {
      text: JSON.stringify({
        format: "json.chart",
        version: "1.0",
        chartType: "bar",
        title: (table.metadata && table.metadata.title || "Table Chart"),
        xLabel: labels[labelColumn] || "Label",
        yLabel: labels[valueColumn] || "Value",
        data: data
      }, null, 2),
      languageId: "json.chart",
      fileName: fileName(input, ".chart", ".json"),
      mimeType: "application/json"
    };
  }

  function chartToSvg(input) {
    var chart = parseJson(input.text || "");
    if (!chart || chart.format !== "json.chart") {
      throw new Error("Expected json.chart input.");
    }
    var data = list(chart.data).slice(0, 24);
    var width = 920;
    var height = Math.max(280, 120 + data.length * 30);
    var marginLeft = 180;
    var marginRight = 40;
    var marginTop = 56;
    var rowHeight = 24;
    var chartWidth = width - marginLeft - marginRight;
    var maxValue = data.reduce(function (max, item) {
      return Math.max(max, Math.abs(Number(item.value) || 0));
    }, 0) || 1;
    var bars = data.map(function (item, index) {
      var value = Number(item.value) || 0;
      var y = marginTop + index * 30;
      var barWidth = Math.round((Math.abs(value) / maxValue) * chartWidth);
      return [
        "<text x=\"" + (marginLeft - 12) + "\" y=\"" + (y + 16) + "\" text-anchor=\"end\" font-size=\"12\" fill=\"#17202c\">" + escapeXml(item.label) + "</text>",
        "<rect x=\"" + marginLeft + "\" y=\"" + y + "\" width=\"" + barWidth + "\" height=\"" + rowHeight + "\" rx=\"3\" fill=\"#0f766e\"/>",
        "<text x=\"" + (marginLeft + barWidth + 8) + "\" y=\"" + (y + 16) + "\" font-size=\"12\" fill=\"#17202c\">" + escapeXml(value) + "</text>"
      ].join("\n");
    }).join("\n");
    var svg = [
      "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + width + " " + height + "\" width=\"" + width + "\" height=\"" + height + "\">",
      "<rect width=\"100%\" height=\"100%\" fill=\"#ffffff\"/>",
      "<text x=\"24\" y=\"32\" font-size=\"20\" font-weight=\"700\" fill=\"#17202c\">" + escapeXml(chart.title || "Chart") + "</text>",
      "<line x1=\"" + marginLeft + "\" y1=\"" + (marginTop - 8) + "\" x2=\"" + marginLeft + "\" y2=\"" + (height - 40) + "\" stroke=\"#cbd3df\"/>",
      bars,
      "<text x=\"" + marginLeft + "\" y=\"" + (height - 14) + "\" font-size=\"12\" fill=\"#5d6b7c\">" + escapeXml(chart.yLabel || "Value") + "</text>",
      "</svg>"
    ].join("\n");
    return {
      text: svg,
      languageId: "xml.svg",
      fileName: fileName(input, ".chart", ".svg"),
      mimeType: "image/svg+xml"
    };
  }

  function lintFormat(input, format, source) {
    try {
      var value = parseJson(input.text || "");
      if (!value || value.format !== format) {
        return [{
          source: source,
          severity: "error",
          message: "Expected format: " + format + ".",
          languageId: input.languageId
        }];
      }
      return [];
    } catch (error) {
      return [{
        source: source,
        severity: "error",
        message: error && error.message ? error.message : String(error),
        languageId: input.languageId
      }];
    }
  }

  global.EditorPlugins = global.EditorPlugins || [];
  global.EditorPlugins.push({
    id: "data-profile",
    name: "Data Profile",
    version: "0.1.0",
    description: "JSON table profiling, chart specifications, SVG chart export, and Markdown reports.",
    contributes: {
      languages: [],
      editors: [],
      editorExtensions: [],
      transformers: [
        {
          id: "json-table-to-profile",
          name: "JSON Table to Profile",
          inputLanguage: "json.table",
          outputLanguage: "json.profile",
          visibility: "internal",
          transform: tableToProfile
        },
        {
          id: "json-profile-to-markdown",
          name: "JSON Profile to Markdown",
          inputLanguage: "json.profile",
          outputLanguage: "text.markdown",
          visibility: "internal",
          transform: profileToMarkdown
        },
        {
          id: "json-table-to-chart",
          name: "JSON Table to Chart",
          inputLanguage: "json.table",
          outputLanguage: "json.chart",
          visibility: "internal",
          transform: tableToChart
        },
        {
          id: "json-chart-to-svg",
          name: "JSON Chart to SVG",
          inputLanguage: "json.chart",
          outputLanguage: "xml.svg",
          visibility: "internal",
          transform: chartToSvg
        }
      ],
      renderers: [],
      exporters: [],
      linters: [
        {
          id: "json-profile-linter",
          name: "JSON Profile shape",
          accepts: ["json.profile"],
          lint: function (input) {
            return lintFormat(input, "json.profile", "JSON Profile");
          }
        },
        {
          id: "json-chart-linter",
          name: "JSON Chart shape",
          accepts: ["json.chart"],
          lint: function (input) {
            return lintFormat(input, "json.chart", "JSON Chart");
          }
        }
      ],
      pipelines: [
        {
          id: "profile-json-table",
          name: "Profile Table",
          inputLanguage: "json.table",
          category: "Analyze",
          menuPath: ["Analyze", "Tables", "Profile JSON"],
          steps: [
            { use: "json-table-to-profile", params: {} }
          ]
        },
        {
          id: "json-table-profile-report",
          name: "Table Profile Report",
          inputLanguage: "json.table",
          category: "Reports",
          menuPath: ["Reports", "Tables", "Profile"],
          steps: [
            { use: "json-table-to-profile", params: {} },
            { use: "json-profile-to-markdown", params: {} }
          ]
        },
        {
          id: "view-json-table-chart",
          name: "View Table Chart",
          inputLanguage: "json.table",
          category: "Preview",
          menuPath: ["Preview", "Tables", "Chart"],
          steps: [
            { use: "json-table-to-chart", params: {} },
            { use: "json-chart-to-svg", params: {} },
            { use: "svg-preview", params: {} }
          ]
        },
        {
          id: "export-json-table-chart-svg",
          name: "Export Table Chart as SVG",
          inputLanguage: "json.table",
          category: "Export",
          menuPath: ["Export", "Tables", "Chart SVG"],
          steps: [
            { use: "json-table-to-chart", params: {} },
            { use: "json-chart-to-svg", params: {} },
            { use: "svg-sanitized-export", params: {} }
          ]
        },
        {
          id: "export-json-table-chart-png",
          name: "Export Table Chart as PNG",
          inputLanguage: "json.table",
          category: "Export",
          menuPath: ["Export", "Tables", "Chart PNG"],
          steps: [
            { use: "json-table-to-chart", params: {} },
            { use: "json-chart-to-svg", params: {} },
            { use: "svg-png-export", params: {} }
          ]
        },
        {
          id: "csv-profile-report",
          name: "CSV Profile Report",
          inputLanguage: "text.csv",
          category: "Reports",
          menuPath: ["Reports", "CSV", "Profile"],
          steps: [
            { use: "csv-to-json-table", params: {} },
            { use: "json-table-to-profile", params: {} },
            { use: "json-profile-to-markdown", params: {} }
          ]
        },
        {
          id: "view-csv-chart",
          name: "View CSV Chart",
          inputLanguage: "text.csv",
          category: "Preview",
          menuPath: ["Preview", "CSV", "Chart"],
          steps: [
            { use: "csv-to-json-table", params: {} },
            { use: "json-table-to-chart", params: {} },
            { use: "json-chart-to-svg", params: {} },
            { use: "svg-preview", params: {} }
          ]
        },
        {
          id: "export-csv-chart-png",
          name: "Export CSV Chart as PNG",
          inputLanguage: "text.csv",
          category: "Export",
          menuPath: ["Export", "CSV", "Chart PNG"],
          steps: [
            { use: "csv-to-json-table", params: {} },
            { use: "json-table-to-chart", params: {} },
            { use: "json-chart-to-svg", params: {} },
            { use: "svg-png-export", params: {} }
          ]
        },
        {
          id: "view-json-chart-as-svg",
          name: "View JSON Chart as SVG",
          inputLanguage: "json.chart",
          category: "Preview",
          menuPath: ["Preview", "Charts", "SVG"],
          steps: [
            { use: "json-chart-to-svg", params: {} },
            { use: "svg-preview", params: {} }
          ]
        },
        {
          id: "export-json-chart-as-svg",
          name: "Export JSON Chart as SVG",
          inputLanguage: "json.chart",
          category: "Export",
          menuPath: ["Export", "Charts", "SVG"],
          steps: [
            { use: "json-chart-to-svg", params: {} },
            { use: "svg-sanitized-export", params: {} }
          ]
        }
      ]
    }
  });
})(window);
