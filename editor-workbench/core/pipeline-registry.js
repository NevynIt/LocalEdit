(function (global) {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function contributionInputLanguages(contribution) {
    if (!contribution) {
      return [];
    }
    if (contribution.kind === "transformer") {
      return contribution.inputLanguage ? [contribution.inputLanguage] : list(contribution.inputLanguages);
    }
    if (contribution.kind === "pipeline") {
      return contribution.inputLanguage ? [contribution.inputLanguage] : [];
    }
    return list(contribution.accepts || contribution.languages || contribution.inputLanguages);
  }

  class PipelineRegistry {
    constructor(registry) {
      this.registry = registry;
      this.userPipelines = new Map();
    }

    list(languageId) {
      var pluginPipelines = this.registry.getPipelines(languageId);
      var userPipelines = Array.from(this.userPipelines.values()).filter(function (pipeline) {
        return !languageId || pipeline.inputLanguage === languageId;
      });
      return pluginPipelines.concat(userPipelines).sort(function (a, b) {
        return (a.name || a.id).localeCompare(b.name || b.id);
      });
    }

    registerUserPipeline(pipeline) {
      this.validate(pipeline);
      this.userPipelines.set(pipeline.id, Object.assign({ kind: "pipeline" }, pipeline));
    }

    get(pipelineId) {
      return this.registry.getContribution("pipeline", pipelineId) || this.userPipelines.get(pipelineId);
    }

    validate(pipeline) {
      if (!pipeline || !pipeline.id || !pipeline.name || !pipeline.inputLanguage || !Array.isArray(pipeline.steps)) {
        throw new Error("Pipeline requires id, name, inputLanguage, and steps.");
      }
      if (pipeline.steps.length === 0) {
        throw new Error("Pipeline " + pipeline.id + " must contain at least one step.");
      }

      var currentLanguage = pipeline.inputLanguage;
      for (var index = 0; index < pipeline.steps.length; index += 1) {
        var step = pipeline.steps[index];
        var contribution = this.registry.findContribution(step.use);
        if (!contribution) {
          throw new Error("Pipeline " + pipeline.id + " references missing contribution " + step.use + ".");
        }
        var inputs = contributionInputLanguages(contribution);
        if (inputs.length && inputs.indexOf("*") === -1 && inputs.indexOf(currentLanguage) === -1) {
          throw new Error("Pipeline " + pipeline.id + " step " + step.use + " does not accept " + currentLanguage + ".");
        }
        if (global.ParameterSchema) {
          global.ParameterSchema.applyDefaults(contribution.parameters, step.params || {}, contribution.id);
        }

        if (contribution.kind === "transformer") {
          if (!contribution.outputLanguage) {
            throw new Error("Transformer " + contribution.id + " must declare outputLanguage.");
          }
          currentLanguage = contribution.outputLanguage;
          continue;
        }

        if (index !== pipeline.steps.length - 1) {
          throw new Error("Pipeline " + pipeline.id + " has a non-transformer before the final step.");
        }
        if (["renderer", "exporter", "editor", "terminal-step"].indexOf(contribution.kind) === -1) {
          throw new Error("Pipeline " + pipeline.id + " final step is not terminal-capable.");
        }
      }

      return true;
    }
  }

  global.PipelineRegistry = PipelineRegistry;
})(window);
