(function (global) {
  "use strict";

  /**
   * @typedef {Object} RuntimeLoader
   * @property {(paths: string[] | string) => Promise<void>} ensureScripts
   */

  /**
   * @typedef {Object} EditorPlugin
   * @property {string} id
   * @property {string} name
   * @property {string} version
   * @property {string=} description
   * @property {string=} documentationUrl
   * @property {PluginContributions} contributes
   * @property {() => ExampleDocument=} getExampleDocument
   */

  /**
   * @typedef {Object} PluginContributions
   * @property {LanguageContribution[]=} languages
   * @property {EditorContribution[]=} editors
   * @property {EditorExtensionContribution[]=} editorExtensions
   * @property {LinterContribution[]=} linters
   * @property {TransformerContribution[]=} transformers
   * @property {RendererContribution[]=} renderers
  * @property {ExporterContribution[]=} exporters
  * @property {PipelineContribution[]=} pipelines
   */

  /**
   * @typedef {Object} LanguageContribution
   * @property {string} id
   * @property {string} name
    * @property {string=} parentLanguageId
    * @property {string[]=} aliases
   * @property {string[]=} fileExtensions
   * @property {string=} mediaType
    * @property {string[]=} mediaTypes
   * @property {string=} description
   */

  /**
   * @typedef {Object} EditorContribution
   * @property {string} id
   * @property {string} name
   * @property {string[]} accepts
   * @property {(context: object) => object} createEditor
   */

  /**
   * @typedef {Object} EditorExtensionContribution
   * @property {string} id
   * @property {string} name
   * @property {string} editor
   * @property {string[]} languages
   * @property {(context: object) => unknown[] | Promise<unknown[]>} createExtension
   */

  /**
   * @typedef {Object} Diagnostic
   * @property {string=} source
   * @property {"error" | "warning" | "information" | "observation"} severity
   * @property {string} message
   * @property {string} languageId
   * @property {{start: {line: number, column: number, offset?: number}, end: {line: number, column: number, offset?: number}}=} range
   * @property {object=} target
   * @property {string=} step
   */

  /**
   * @typedef {Object} TransformResult
   * @property {string} text
   * @property {string=} languageId
   * @property {string=} fileName
   * @property {Diagnostic[]=} diagnostics
   */

  /**
   * @typedef {Object} TransformerContribution
   * @property {string} id
   * @property {string} name
   * @property {string} inputLanguage
   * @property {string} outputLanguage
   * @property {object=} parameters
   * @property {(input: object) => TransformResult | Promise<TransformResult>} transform
   */

  /**
   * @typedef {Object} RendererContribution
   * @property {string} id
   * @property {string} name
   * @property {string[]} accepts
   * @property {"html" | "svg" | "text" | "image" | "custom"} outputKind
   * @property {object=} parameters
   * @property {(input: object) => RenderResult | Promise<RenderResult>} render
   */

  /**
   * @typedef {Object} RenderResult
   * @property {"html" | "svg" | "text" | "image" | "custom"} kind
   * @property {string | Blob | CustomRenderContent} content
   * @property {string=} mimeType
   */

  /**
   * @typedef {Object} ExporterContribution
   * @property {string} id
   * @property {string} name
   * @property {string[]} accepts
   * @property {string} outputFileExtension
   * @property {string} mimeType
   * @property {object=} parameters
   * @property {(input: object) => ExportResult | Promise<ExportResult>} export
   */

  /**
   * @typedef {Object} LinterContribution
   * @property {string} id
   * @property {string} name
   * @property {string[]} accepts
   * @property {(input: object) => Diagnostic[] | Promise<Diagnostic[]>} lint
   */

  /**
   * @typedef {Object} PipelineContribution
   * @property {string} id
   * @property {string} name
   * @property {string} inputLanguage
   * @property {{use: string, params?: object}[]} steps
   */

  /**
   * @typedef {Object} ExampleDocument
   * @property {string} text
   * @property {string} fileName
   * @property {string=} languageId
   * @property {string=} mimeType
   */

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeLanguage(definition) {
    return {
      id: definition.id,
      name: definition.name || definition.label || definition.id,
      parentLanguageId: definition.parentLanguageId || definition.parent || undefined,
      aliases: list(definition.aliases),
      fileExtensions: list(definition.fileExtensions || definition.extensions).map(function (extension) {
        var value = String(extension || "");
        return value.charAt(0) === "." ? value : "." + value;
      }),
      mediaType: definition.mediaType || definition.mediaTypes && definition.mediaTypes[0] || list(definition.mimeTypes)[0] || "",
      mediaTypes: list(definition.mediaTypes || definition.mimeTypes),
      description: definition.description || ""
    };
  }

  function firstLanguage(provider, fieldName) {
    var languages = list(provider[fieldName]);
    return languages.length ? languages[0] : undefined;
  }

  function fromLegacy(plugin) {
    var contributes = plugin.contributes || {};
    var nextPlugin = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description || "",
      documentationUrl: plugin.documentationUrl || "",
      contributes: {
        languages: list(contributes.languages).concat(list(plugin.languageDefinitions).map(normalizeLanguage)),
        editors: list(contributes.editors),
        editorExtensions: list(contributes.editorExtensions).concat(list(plugin.highlighters).map(function (provider) {
          return {
            id: provider.id,
            name: provider.name,
            editor: "codemirror",
            languages: list(provider.languages),
            createExtension: provider.createExtension || provider.getCodeMirrorExtensions
          };
        })),
        transformers: list(contributes.transformers).concat(list(plugin.transformers).map(function (provider) {
          var inputLanguage = provider.inputLanguage || firstLanguage(provider, "inputLanguages");
          return {
            id: provider.id,
            name: provider.name,
            inputLanguage: inputLanguage,
            outputLanguage: provider.outputLanguage,
            parameters: provider.parameters || {},
            transform: function (input) {
              return provider.transform(input.document, {
                languageId: input.languageId,
                params: input.params,
                runtime: input.context && input.context.runtime
              });
            }
          };
        })),
        renderers: list(contributes.renderers).concat(list(plugin.renderers).map(function (provider) {
          return {
            id: provider.id,
            name: provider.name,
            accepts: list(provider.accepts || provider.inputLanguages),
            outputKind: provider.outputKind,
            parameters: provider.parameters || {},
            render: function (input) {
              return provider.render(input.document, {
                languageId: input.languageId,
                params: input.params,
                options: input.params,
                runtime: input.context && input.context.runtime
              });
            }
          };
        })),
        exporters: list(contributes.exporters).concat(list(plugin.exporters).map(function (provider) {
          return {
            id: provider.id,
            name: provider.name,
            accepts: list(provider.accepts || provider.languages),
            outputFileExtension: provider.outputFileExtension,
            mimeType: provider.mimeType,
            parameters: provider.parameters || {},
            export: function (input) {
              return provider.export({
                sourceDocument: input.document,
                renderedResult: input.renderedResult
              }, {
                suggestedFileName: input.document && input.document.fileName,
                params: input.params,
                runtime: input.context && input.context.runtime
              });
            }
          };
        })),
        linters: list(contributes.linters).concat(list(plugin.linters).map(function (provider) {
          return {
            id: provider.id,
            name: provider.name,
            accepts: list(provider.accepts || provider.languages),
            parameters: provider.parameters || {},
            lint: function (input) {
              return provider.lint(input.document, {
                languageId: input.languageId,
                params: input.params,
                runtime: input.context && input.context.runtime
              });
            }
          };
        })),
        pipelines: list(contributes.pipelines)
      }
    };

    if (typeof plugin.getExampleDocument === "function") {
      nextPlugin.getExampleDocument = plugin.getExampleDocument;
    }
    return nextPlugin;
  }

  global.EditorPluginContracts = {
    version: "0.2.0",
    fromLegacy: fromLegacy
  };
})(window);
