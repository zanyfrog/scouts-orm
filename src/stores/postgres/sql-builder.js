"use strict";

const { QueryValidationError } = require("../../query");

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function selectedColumns(plan) {
  const columns = plan.columns.length ? plan.columns : [plan.schema.idField];
  return columns
    .map((field) => {
      const column = plan.schema.fields[field].column;
      return `${quoteIdentifier(column)} AS ${quoteIdentifier(field)}`;
    })
    .join(", ");
}

function buildCondition(plan, where, values) {
  if (!where || !Object.keys(where).length) return "";
  if (Array.isArray(where.and)) {
    return where.and.map((clause) => buildCondition(plan, clause, values)).filter(Boolean).map((clause) => `(${clause})`).join(" AND ");
  }
  if (Array.isArray(where.or)) {
    return where.or.map((clause) => buildCondition(plan, clause, values)).filter(Boolean).map((clause) => `(${clause})`).join(" OR ");
  }

  return Object.entries(where).map(([field, condition]) => {
    const definition = plan.schema.fields[field];
    if (!definition) {
      throw new QueryValidationError(`Unknown where field: ${field}`, { field });
    }
    const column = quoteIdentifier(definition.column);
    if (condition && typeof condition === "object" && !Array.isArray(condition)) {
      return Object.entries(condition).map(([operator, expected]) => {
        if (operator === "eq") {
          values.push(expected);
          return `${column} = $${values.length}`;
        }
        if (operator === "ne") {
          values.push(expected);
          return `${column} <> $${values.length}`;
        }
        if (operator === "in") {
          values.push(Array.isArray(expected) ? expected : []);
          return `${column} = ANY($${values.length})`;
        }
        if (operator === "contains") {
          values.push(`%${String(expected || "")}%`);
          return `${column} ILIKE $${values.length}`;
        }
        if (["gt", "gte", "lt", "lte"].includes(operator)) {
          values.push(expected);
          const symbols = { gt: ">", gte: ">=", lt: "<", lte: "<=" };
          return `${column} ${symbols[operator]} $${values.length}`;
        }
        throw new QueryValidationError(`Unsupported where operator: ${operator}`, { operator });
      }).join(" AND ");
    }
    values.push(condition);
    return `${column} = $${values.length}`;
  }).join(" AND ");
}

function buildOrderBy(plan) {
  if (!Array.isArray(plan.orderBy) || !plan.orderBy.length) return "";
  const clauses = plan.orderBy.map((item) => {
    const field = item.field || item.column;
    const definition = plan.schema.fields[field];
    if (!definition) {
      throw new QueryValidationError(`Unknown order field: ${field}`, { field });
    }
    const direction = String(item.direction || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
    return `${quoteIdentifier(definition.column)} ${direction}`;
  });
  return ` ORDER BY ${clauses.join(", ")}`;
}

function buildSelectSql(plan) {
  const values = [];
  const condition = buildCondition(plan, plan.where, values);
  let sql = `SELECT ${selectedColumns(plan)} FROM ${quoteIdentifier(plan.schema.table)}`;
  if (condition) sql += ` WHERE ${condition}`;
  sql += buildOrderBy(plan);
  if (plan.limit !== undefined && plan.limit !== null) {
    values.push(Math.max(0, Number(plan.limit) || 0));
    sql += ` LIMIT $${values.length}`;
  }
  if (plan.offset !== undefined && plan.offset !== null) {
    values.push(Math.max(0, Number(plan.offset) || 0));
    sql += ` OFFSET $${values.length}`;
  }
  return { sql, values };
}

module.exports = {
  buildSelectSql,
};
