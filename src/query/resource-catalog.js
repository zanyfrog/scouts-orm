"use strict";

const { resources } = require("./schema");

function titleCase(value) {
  return String(value || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function listSecurityResourceCatalog() {
  const catalog = new Map();

  Object.values(resources).forEach((schema) => {
    const code = String(schema.resource || "").trim();
    if (!code || catalog.has(code)) {
      return;
    }
    catalog.set(code, {
      id: code,
      code,
      name: schema.name || titleCase(code),
      description: schema.description || `${titleCase(code)} resource.`,
      isActive: true,
    });
  });

  return [...catalog.values()].sort((a, b) => a.code.localeCompare(b.code));
}

module.exports = {
  listSecurityResourceCatalog,
};
