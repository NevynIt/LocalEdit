(function (global) {
  "use strict";

  if (!global.DiagnosticsService) {
    throw new Error("DiagnosticsService must load before diagnostics-manager.js.");
  }

  global.DiagnosticsManager = global.DiagnosticsService;
})(window);
