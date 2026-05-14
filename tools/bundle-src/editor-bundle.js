import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

window.EditorWorkbenchCodeMirror = {
  basicSetup,
  Compartment,
  EditorState,
  EditorView,
  markdown
};
