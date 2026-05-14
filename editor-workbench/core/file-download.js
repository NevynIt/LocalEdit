(function (global) {
  "use strict";

  function downloadBlob(fileName, blob) {
    var url = global.URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName || "download.txt";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    global.setTimeout(function () {
      global.URL.revokeObjectURL(url);
    }, 0);
  }

  function downloadText(fileName, text, mimeType) {
    downloadBlob(fileName, new Blob([text], { type: mimeType || "text/plain" }));
  }

  global.downloadBlob = downloadBlob;
  global.downloadText = downloadText;
})(window);

