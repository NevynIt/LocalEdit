(function (global) {
  "use strict";

  if (!global.ContributionRegistry) {
    throw new Error("ContributionRegistry must load before plugin-registry.js.");
  }

  global.PluginRegistry = global.ContributionRegistry;
})(window);
