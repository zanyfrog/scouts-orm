"use strict";

class QueryValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "QueryValidationError";
    this.statusCode = 400;
    this.details = details;
  }
}

module.exports = {
  QueryValidationError,
};
