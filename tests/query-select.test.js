"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const orm = require("../index");

const publicActor = {
  authenticated: false,
  globalRoles: ["public"],
  unitRoles: [],
  relationships: [],
  effectivePermissions: ["event.view.public"],
};

const privateDetailsPolicy = {
  fieldGroups: [
    {
      resource: "event",
      code: "private_details",
      viewPermission: "event.private_details.view",
      hiddenBehavior: "placeholder",
      fields: ["startDate", "endDate", "homeBase", "location"],
    },
  ],
};

test("CSV select projects allowed columns and omits restricted field-group columns", () => {
  const result = orm.select("events", {
    columns: ["id", "title", "homeBase"],
    where: { id: { contains: "event" } },
    limit: 1,
  }, {
    actor: publicActor,
    policy: privateDetailsPolicy,
  });

  assert.deepEqual(result.columns, ["id", "title"]);
  assert.deepEqual(result.omittedColumns, ["homeBase"]);
  assert.equal(result.hiddenFields.homeBase, "placeholder");
  assert.equal(Object.prototype.hasOwnProperty.call(result.rows[0], "homeBase"), false);
});

test("CSV select rejects filters on restricted field-group columns", () => {
  assert.throws(
    () => orm.select("events", {
      columns: ["id", "title"],
      where: { homeBase: { contains: "camp" } },
    }, {
      actor: publicActor,
      policy: privateDetailsPolicy,
    }),
    /restricted field/,
  );
});

test("security resource catalog is derived from query schema and collapses duplicates", () => {
  const catalog = orm.listSecurityResourceCatalog();

  assert.deepEqual(catalog.map((resource) => resource.code), ["event", "person", "scout"]);
  assert.equal(catalog.filter((resource) => resource.code === "person").length, 1);
  assert.equal(catalog.find((resource) => resource.code === "event").name, "Event");
});
