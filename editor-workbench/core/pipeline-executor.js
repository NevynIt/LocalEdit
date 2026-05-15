(function (global) {
  "use strict";

  function makeDocument(text, languageId, sourceDocument) {
    return new DocumentModel({
      text: text || "",
      languageId: languageId || "text.plain",
      fileName: sourceDocument && sourceDocument.fileName,
      mimeType: sourceDocument && sourceDocument.mimeType,
      lastModified: sourceDocument && sourceDocument.lastModified
    });
  }

  class PipelineExecutor {
    constructor(registry, pipelineRegistry, services) {
      this.registry = registry;
      this.pipelineRegistry = pipelineRegistry;
      this.services = services || {};
    }

    async execute(pipelineOrId, documentModel) {
      var prepared = await this.prepareTerminalInput(pipelineOrId, documentModel);
      if (!prepared.contribution) {
        return {
          action: "open-new-document",
          document: makeDocument(prepared.input.text, prepared.input.languageId, {
            fileName: prepared.input.fileName,
            mimeType: prepared.input.mimeType,
            lastModified: documentModel && documentModel.lastModified
          }),
          diagnostics: prepared.input.diagnostics.slice(),
          intermediateResults: prepared.input.intermediateResults.slice(),
          step: prepared.input.step
        };
      }
      return this.executeTerminal(prepared.contribution, prepared.input);
    }

    async prepareTerminalInput(pipelineOrId, documentModel) {
      var pipeline = typeof pipelineOrId === "string" ? this.pipelineRegistry.get(pipelineOrId) : pipelineOrId;
      if (!pipeline) {
        throw new Error("Pipeline was not found.");
      }
      this.pipelineRegistry.validate(pipeline);

      var currentText = documentModel.text || "";
      var currentLanguageId = pipeline.inputLanguage || documentModel.languageId;
      var currentFileName = documentModel.fileName || "";
      var currentMimeType = documentModel.mimeType || "";
      var diagnostics = [];
      var intermediateResults = [];

      for (var index = 0; index < pipeline.steps.length; index += 1) {
        var step = pipeline.steps[index];
        var contribution = this.registry.findContribution(step.use);
        var params = global.ParameterSchema
          ? global.ParameterSchema.applyDefaults(contribution.parameters, step.params || {}, contribution.id)
          : Object.assign({}, step.params || {});
        var stepDocument = makeDocument(currentText, currentLanguageId, documentModel);

        if (contribution.kind === "transformer") {
          var result = await contribution.transform({
            text: currentText,
            languageId: currentLanguageId,
            params: params,
            document: stepDocument,
            context: this.createContext(pipeline, step, index)
          });
          if (!result || typeof result.text !== "string") {
            throw new Error("Transformer " + contribution.id + " returned no text.");
          }
          currentText = result.text;
          currentLanguageId = result.languageId || contribution.outputLanguage;
          currentFileName = typeof result.fileName === "string" && result.fileName ? result.fileName : currentFileName;
          currentMimeType = typeof result.mimeType === "string" && result.mimeType ? result.mimeType : currentMimeType;
          diagnostics = diagnostics.concat(result.diagnostics || []);
          intermediateResults.push({
            step: step.use,
            text: currentText,
            languageId: currentLanguageId,
            diagnostics: result.diagnostics || []
          });
          continue;
        }

        return {
          pipeline: pipeline,
          contribution: contribution,
          input: {
            pipeline: pipeline,
            step: step,
            stepIndex: index,
            text: currentText,
            languageId: currentLanguageId,
            fileName: currentFileName,
            mimeType: currentMimeType,
            params: params,
            sourceDocument: documentModel,
            diagnostics: diagnostics,
            intermediateResults: intermediateResults
          }
        };
      }

      return {
        pipeline: pipeline,
        contribution: null,
        input: {
          pipeline: pipeline,
          step: pipeline.steps[pipeline.steps.length - 1] || null,
          stepIndex: pipeline.steps.length - 1,
          text: currentText,
          languageId: currentLanguageId,
          fileName: currentFileName,
          mimeType: currentMimeType,
          params: {},
          sourceDocument: documentModel,
          diagnostics: diagnostics,
          intermediateResults: intermediateResults
        }
      };
    }

    createContext(pipeline, step, stepIndex) {
      return {
        pipeline: pipeline,
        step: step,
        stepIndex: stepIndex,
        diagnostics: this.services.diagnostics,
        services: this.services,
        runtime: this.services.runtime
      };
    }

    async executeTerminal(contribution, input) {
      var terminalSource = Object.assign({}, input.sourceDocument || {}, {
        fileName: input.fileName || input.sourceDocument && input.sourceDocument.fileName,
        mimeType: input.mimeType || input.sourceDocument && input.sourceDocument.mimeType
      });
      var documentModel = makeDocument(input.text, input.languageId, terminalSource);
      if (contribution.kind === "renderer") {
        var session = this.services.renderManager.openContribution(contribution, documentModel, input.params, {
          pipelineId: input.pipeline.id,
          step: input.step.use,
          diagnostics: input.diagnostics,
          intermediateResults: input.intermediateResults
        });
        return { action: "render", session: session, diagnostics: input.diagnostics, intermediateResults: input.intermediateResults.slice() };
      }

      if (contribution.kind === "exporter") {
        var exported = await contribution.export({
          text: input.text,
          languageId: input.languageId,
          params: input.params,
          document: documentModel,
          context: this.createContext(input.pipeline, input.step, input.stepIndex)
        });
        return { action: "export", result: exported, diagnostics: input.diagnostics, intermediateResults: input.intermediateResults.slice() };
      }

      if (contribution.kind === "editor") {
        if (!this.services.editorManager) {
          throw new Error("Editor manager is not available.");
        }
        await this.services.editorManager.switchEditor(contribution.id, input.text, input.languageId);
        return { action: "editor", diagnostics: input.diagnostics, intermediateResults: input.intermediateResults.slice() };
      }
      throw new Error("Unsupported terminal contribution " + contribution.id + ".");
    }
  }

  global.PipelineExecutor = PipelineExecutor;
})(window);
