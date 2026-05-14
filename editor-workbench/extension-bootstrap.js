(function () {
  "use strict";

  var host = new ExtensionHostAdapter();
  var app = new App(host);
  app.start();
})();

