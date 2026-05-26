"use strict";

const csvStore = require("../stores/csv/adapter");

function createRepository() {
  return csvStore;
}

module.exports = {
  createRepository,
};
