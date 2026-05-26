"use strict";

const { getResourceSchema } = require("./schema");
const { QueryValidationError } = require("./errors");

function permissionMatches(granted, required) {
  if (granted === required) return true;
  const grantedParts = String(granted || "").split(".");
  const requiredParts = String(required || "").split(".");
  return grantedParts.length === requiredParts.length && grantedParts.every((part, index) => part === "*" || part === requiredParts[index]);
}

function actorPermissionCodes(actor) {
  const permissions = new Set(actor?.effectivePermissions || []);
  (actor?.permissions?.global || []).forEach((permission) => permissions.add(permission));
  (actor?.permissions?.byUnit || []).forEach((assignment) => {
    (assignment.permissions || []).forEach((permission) => permissions.add(permission));
  });
  return [...permissions];
}

function groupCanBeViewed(actor, group) {
  if (!group?.viewPermission) return true;
  return actorPermissionCodes(actor).some((permission) => permissionMatches(permission, group.viewPermission) || permissionMatches(permission, "system.super_admin") || permissionMatches(permission, "*.*.*"));
}

function fieldGroupMap(policy) {
  const groups = new Map();
  for (const group of policy?.fieldGroups || []) {
    groups.set(`${group.resource}:${group.code}`, group);
  }
  return groups;
}

function validateFields(schema, fields, source) {
  for (const field of fields) {
    if (!schema.fields[field]) {
      throw new QueryValidationError(`Unknown ${source} field: ${field}`, { field });
    }
  }
}

function fieldsInWhere(where = {}) {
  if (!where || typeof where !== "object") return [];
  if (Array.isArray(where.and)) return where.and.flatMap(fieldsInWhere);
  if (Array.isArray(where.or)) return where.or.flatMap(fieldsInWhere);
  return Object.keys(where);
}

function fieldIsAllowed(definition, groups, actor) {
  if (!definition.fieldGroup) return true;
  const group = groups.get(definition.fieldGroup);
  return !group || groupCanBeViewed(actor, group);
}

function planSelect(resource, query = {}, context = {}) {
  const schema = getResourceSchema(resource);
  if (!schema) {
    throw new QueryValidationError(`Unknown resource: ${resource}`, { resource });
  }

  const requestedColumns = !query.columns || query.columns.includes("*")
    ? Object.keys(schema.fields)
    : [...new Set(query.columns)];
  validateFields(schema, requestedColumns, "select");
  validateFields(schema, fieldsInWhere(query.where), "where");

  const groups = fieldGroupMap(context.policy);
  const omittedColumns = [];
  const hiddenFields = {};
  const columns = requestedColumns.filter((field) => {
    const definition = schema.fields[field];
    if (fieldIsAllowed(definition, groups, context.actor)) return true;
    const group = groups.get(definition.fieldGroup);
    omittedColumns.push(field);
    hiddenFields[field] = group.hiddenBehavior || "redact";
    return false;
  });

  for (const field of fieldsInWhere(query.where)) {
    if (!fieldIsAllowed(schema.fields[field], groups, context.actor)) {
      throw new QueryValidationError(`Cannot filter by restricted field: ${field}`, { field });
    }
  }

  return {
    resource,
    schema,
    columns,
    omittedColumns,
    hiddenFields,
    where: query.where || {},
    orderBy: query.orderBy || [],
    limit: query.limit,
    offset: query.offset,
  };
}

module.exports = {
  planSelect,
};
