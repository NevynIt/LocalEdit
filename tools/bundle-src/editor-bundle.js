import { basicSetup } from "codemirror";
import * as codeMirrorLanguage from "@codemirror/language";
import * as codeMirrorState from "@codemirror/state";
import * as codeMirrorView from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

window.EditorWorkbenchCodeMirror = {
  basicSetup,
  Compartment,
  EditorState,
  EditorView,
  modules: {
    "@codemirror/language": codeMirrorLanguage,
    "@codemirror/state": codeMirrorState,
    "@codemirror/view": codeMirrorView
  }
};
