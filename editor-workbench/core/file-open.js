(function (global) {
  "use strict";

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result || "");
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Unable to read file."));
      };
      reader.readAsText(file);
    });
  }

  async function openTextFile() {
    return new Promise(function (resolve, reject) {
      var input = document.createElement("input");
      input.type = "file";
      input.style.position = "fixed";
      input.style.left = "-10000px";
      input.addEventListener("change", async function () {
        try {
          var file = input.files && input.files[0];
          document.body.removeChild(input);

          if (!file) {
            reject(new Error("No file selected."));
            return;
          }

          var text = await readFileAsText(file);
          resolve(new DocumentModel({
            text: text,
            languageId: "plain-text",
            fileName: file.name,
            mimeType: file.type || "text/plain",
            lastModified: file.lastModified
          }));
        } catch (error) {
          reject(error);
        }
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  global.openTextFile = openTextFile;
})(window);

