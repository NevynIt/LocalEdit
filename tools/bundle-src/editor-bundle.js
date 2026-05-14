import { basicSetup } from "codemirror";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { dot } from "@viz-js/lang-dot";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

window.EditorWorkbenchCodeMirror = {
  basicSetup,
  Compartment,
  EditorState,
  EditorView,
  dot,
  html,
  markdown
};
