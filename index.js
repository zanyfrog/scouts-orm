"use strict";

const { createRepository } = require("./src/repositories/repository-factory");
const query = require("./src/query");

module.exports = {
  ...createRepository(),
  ...query,
};
