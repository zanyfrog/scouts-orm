"use strict";

const fileRepository = require("./file");

function createRepository() {
  return fileRepository;
}

module.exports = {
  createRepository,
};
