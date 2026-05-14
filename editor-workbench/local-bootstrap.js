(function () {
  "use strict";

  var host = new LocalHostAdapter();
  var app = new App(host);
  app.start();
})();

