import prettier from "prettier/standalone";
import * as babelPlugin from "prettier/plugins/babel";
import * as estreePlugin from "prettier/plugins/estree";

async function formatJavaScript(source) {
  return prettier.format(source || "", {
    parser: "babel",
    plugins: [babelPlugin, estreePlugin]
  });
}

window.EditorWorkbenchPrettierJavaScript = {
  prettier,
  formatJavaScript
};
