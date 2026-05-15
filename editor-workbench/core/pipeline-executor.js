(function (global) {
  "use strict";

  function makeDocument(text, languageId, sourceDocument) {
    return new DocumentModel({
      text: text || "",
      languageId: languageId || "plain-text",
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
      var pipeline = typeof pipelineOrId === "string" ? this.pipelineRegistry.get(pipelineOrId) : pipelineOrId;
      if (!pipeline) {
        throw new Error("Pipeline was not found.");
      }
      this.pipelineRegistry.validate(pipeline);

      var currentText = documentModel.text || "";
      var currentLanguageId = pipeline.inputLanguage || documentModel.languageId;
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
          diagnostics = diagnostics.concat(result.diagnostics || []);
          intermediateResults.push({
            step: step.use,
            text: currentText,
            languageId: currentLanguageId,
            diagnostics: result.diagnostics || []
          });
          continue;
        }

        return this.executeTerminal(contribution, {
          pipeline: pipeline,
          step: step,
          stepIndex: index,
          text: currentText,
          languageId: currentLanguageId,
          params: params,
          sourceDocument: documentModel,
          diagnostics: diagnostics,
          intermediateResults: intermediateResults
        });
      }

      throw new Error("Pipeline " + pipeline.id + " did not end in a terminal step.");
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
      var documentModel = makeDocument(input.text, input.languageId, input.sourceDocument);
      if (contribution.kind === "renderer") {
        var session = this.services.renderManager.openContribution(contribution, documentModel, input.params, {
          pipelineId: input.pipeline.id,
          step: input.step.use,
          diagnostics: input.diagnostics,
          intermediateResults: input.intermediateResults
        });
        return { action: "render", session: session, diagnostics: input.diagnostics };
      }

      if (contribution.kind === "exporter") {
        var exported = await contribution.export({
          text: input.text,
          languageId: input.languageId,
          params: input.params,
          document: documentModel,
          context: this.createContext(input.pipeline, input.step, input.stepIndex)
        });
        return { action: "export", result: exported, diagnostics: input.diagnostics };
      }

      if (contribution.kind === "editor") {
        if (!this.services.editorManager) {
          throw new Error("Editor manager is not available.");
        }
        await this.services.editorManager.switchEditor(contribution.id, input.text, input.languageId);
        return { action: "editor", diagnostics: input.diagnostics };
      }

      if (contribution.kind === "terminal-step" && typeof contribution.run === "function") {
        return contribution.run(Object.assign({}, input, {
          document: documentModel,
          context: this.createContext(input.pipeline, input.step, input.stepIndex)
        }));
      }

      throw new Error("Unsupported terminal contribution " + contribution.id + ".");
    }
  }

  global.PipelineExecutor = PipelineExecutor;
})(window);
