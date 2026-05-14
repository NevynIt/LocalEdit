import prettier from "prettier/standalone";
import xmlPlugin from "@prettier/plugin-xml";

async function formatXml(source) {
  return prettier.format(source || "", {
    parser: "xml",
    plugins: [xmlPlugin],
    xmlWhitespaceSensitivity: "ignore"
  });
}

window.EditorWorkbenchPrettierXml = {
  prettier,
  formatXml
};
