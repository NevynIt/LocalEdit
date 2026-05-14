import init, { PositionEncoding, Workspace } from "@astral-sh/ruff-wasm-web";
import wasmBytes from "@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm";

let initPromise;
let workspace;

async function ensureWorkspace() {
  if (!workspace) {
    if (!initPromise) {
      initPromise = init({ module_or_path: wasmBytes });
    }
    await initPromise;
    workspace = new Workspace({
      "line-length": 88,
      "indent-width": 4,
      format: {
        "indent-style": "space",
        "quote-style": "double"
      }
    }, PositionEncoding.Utf16);
  }

  return workspace;
}

async function formatPython(source) {
  return (await ensureWorkspace()).format(source || "");
}

window.EditorWorkbenchRuffPython = {
  formatPython
};
