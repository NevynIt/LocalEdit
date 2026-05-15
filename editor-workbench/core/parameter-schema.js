(function (global) {
  "use strict";

  var TYPES = ["string", "number", "integer", "boolean", "enum"];

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  class ParameterSchema {
    static validateSchema(schema, ownerId) {
      var parameters = isPlainObject(schema) ? schema : {};
      Object.keys(parameters).forEach(function (key) {
        var definition = parameters[key];
        if (!isPlainObject(definition)) {
          throw new Error("Parameter " + key + " in " + ownerId + " must be an object.");
        }
        if (TYPES.indexOf(definition.type) === -1) {
          throw new Error("Parameter " + key + " in " + ownerId + " has unsupported type.");
        }
        if (!Object.prototype.hasOwnProperty.call(definition, "default")) {
          throw new Error("Parameter " + key + " in " + ownerId + " must define a default.");
        }
        if (definition.type === "enum" && list(definition.values).indexOf(definition.default) === -1) {
          throw new Error("Enum parameter " + key + " in " + ownerId + " has a default outside its values.");
        }
      });
      return parameters;
    }

    static applyDefaults(schema, overrides, ownerId) {
      var parameters = ParameterSchema.validateSchema(schema, ownerId || "contribution");
      var values = {};
      Object.keys(parameters).forEach(function (key) {
        values[key] = parameters[key].default;
      });
      Object.keys(overrides || {}).forEach(function (key) {
        values[key] = overrides[key];
      });
      return ParameterSchema.validateValues(parameters, values, ownerId || "contribution");
    }

    static validateValues(schema, values, ownerId) {
      var parameters = isPlainObject(schema) ? schema : {};
      var resolved = Object.assign({}, values || {});
      Object.keys(resolved).forEach(function (key) {
        var definition = parameters[key];
        if (!definition) {
          throw new Error("Unknown parameter " + key + " in " + ownerId + ".");
        }
        var value = resolved[key];
        if (definition.type === "string" && typeof value !== "string") {
          throw new Error("Parameter " + key + " in " + ownerId + " must be a string.");
        }
        if (definition.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
          throw new Error("Parameter " + key + " in " + ownerId + " must be a number.");
        }
        if (definition.type === "integer" && (!Number.isInteger(value))) {
          throw new Error("Parameter " + key + " in " + ownerId + " must be an integer.");
        }
        if (definition.type === "boolean" && typeof value !== "boolean") {
          throw new Error("Parameter " + key + " in " + ownerId + " must be a boolean.");
        }
        if (definition.type === "enum" && list(definition.values).indexOf(value) === -1) {
          throw new Error("Parameter " + key + " in " + ownerId + " must be one of its enum values.");
        }
      });
      return resolved;
    }
  }

  global.ParameterSchema = ParameterSchema;
})(window);
