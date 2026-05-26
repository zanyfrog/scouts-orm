"use strict";

function normalizeComparable(value) {
  return typeof value === "string" ? value.toLowerCase() : value;
}

function matchesOperator(actual, operator, expected) {
  if (operator === "eq") return actual === expected;
  if (operator === "ne") return actual !== expected;
  if (operator === "in") return Array.isArray(expected) && expected.includes(actual);
  if (operator === "contains") return String(actual || "").toLowerCase().includes(String(expected || "").toLowerCase());
  if (operator === "startsWith") return String(actual || "").toLowerCase().startsWith(String(expected || "").toLowerCase());
  if (operator === "gt") return actual > expected;
  if (operator === "gte") return actual >= expected;
  if (operator === "lt") return actual < expected;
  if (operator === "lte") return actual <= expected;
  return false;
}

function matchesWhere(record, where = {}) {
  if (!where || !Object.keys(where).length) return true;
  if (Array.isArray(where.and)) return where.and.every((clause) => matchesWhere(record, clause));
  if (Array.isArray(where.or)) return where.or.some((clause) => matchesWhere(record, clause));
  return Object.entries(where).every(([field, condition]) => {
    const actual = record[field];
    if (condition && typeof condition === "object" && !Array.isArray(condition)) {
      return Object.entries(condition).every(([operator, expected]) =>
        matchesOperator(normalizeComparable(actual), operator, normalizeComparable(expected)),
      );
    }
    return actual === condition;
  });
}

module.exports = {
  matchesWhere,
  matchesOperator,
};
