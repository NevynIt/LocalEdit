(function (global) {
  "use strict";

  /**
   * @typedef {Object} EditorPlugin
   * @property {string} id
   * @property {string} name
   * @property {string} version
   * @property {string=} description
   * @property {string[]=} languages
   * @property {LanguageDefinition[]=} languageDefinitions
   * @property {HighlighterProvider[]=} highlighters
   * @property {LinterProvider[]=} linters
   * @property {TransformerProvider[]=} transformers
   * @property {RendererProvider[]=} renderers
   * @property {ExporterProvider[]=} exporters
   */

  /**
   * @typedef {Object} HighlighterProvider
   * @property {string} id
   * @property {string} name
   * @property {string[]} languages
   * @property {(context: HighlighterContext) => unknown[]} getCodeMirrorExtensions
   */

  /**
   * @typedef {Object} HighlighterContext
   * @property {string} languageId
   */

  /**
   * @typedef {Object} LinterProvider
   * @property {string} id
   * @property {string} name
   * @property {string[]} languages
   * @property {(document: DocumentModel, context: LinterContext) => Diagnostic[] | Promise<Diagnostic[]>} lint
   */

  /**
   * @typedef {Object} LinterContext
   * @property {string} languageId
   */

  /**
   * @typedef {Object} Diagnostic
   * @property {number} from
   * @property {number} to
   * @property {"error" | "warning" | "observation"} severity
   * @property {string} message
   * @property {string=} source
   */

  /**
   * @typedef {Object} TransformerProvider
   * @property {string} id
   * @property {string} name
   * @property {string[]} inputLanguages
   * @property {string=} outputLanguage
   * @property {(document: DocumentModel, context: TransformerContext) => TransformResult | Promise<TransformResult>} transform
   */

  /**
   * @typedef {Object} TransformerContext
   * @property {string} languageId
   */

  /**
   * @typedef {Object} TransformResult
   * @property {string} text
   * @property {string=} languageId
   * @property {string=} fileName
   * @property {"replace-current" | "new-document" | "download"} mode
   */

  /**
   * @typedef {Object} RendererProvider
   * @property {string} id
   * @property {string} name
   * @property {string[]} inputLanguages
   * @property {"html" | "svg" | "text" | "image" | "custom"} outputKind
   * @property {(document: DocumentModel, context: RendererContext) => RenderResult | Promise<RenderResult>} render
   */

  /**
   * @typedef {Object} RendererContext
   * @property {string} languageId
   * @property {object=} options
   */

  /**
   * @typedef {Object} RenderResult
   * @property {"html" | "svg" | "text" | "image" | "custom"} kind
   * @property {string | Blob} content
   * @property {string=} mimeType
   */

  /**
   * @typedef {Object} ExporterProvider
   * @property {string} id
   * @property {string} name
   * @property {string[]=} languages
   * @property {Array<"source" | "rendered">} inputKinds
   * @property {string} outputFileExtension
   * @property {string} mimeType
   * @property {(input: ExportInput, context: ExporterContext) => ExportResult | Promise<ExportResult>} export
   */

  /**
   * @typedef {Object} ExportInput
   * @property {DocumentModel=} sourceDocument
   * @property {RenderResult=} renderedResult
   */

  /**
   * @typedef {Object} ExporterContext
   * @property {string=} suggestedFileName
   */

  /**
   * @typedef {Object} ExportResult
   * @property {string} fileName
   * @property {string} mimeType
   * @property {string | Blob | ArrayBuffer} content
   */

  global.EditorPluginContracts = {
    version: "0.1.0"
  };
})(window);
