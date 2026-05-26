"use strict";

function projectRecord(record, columns) {
  if (!Array.isArray(columns) || columns.includes("*")) {
    return { ...(record || {}) };
  }
  return columns.reduce((projected, field) => {
    if (Object.prototype.hasOwnProperty.call(record || {}, field)) {
      projected[field] = record[field];
    }
    return projected;
  }, {});
}

function projectRows(rows, columns) {
  return (Array.isArray(rows) ? rows : []).map((row) => projectRecord(row, columns));
}

module.exports = {
  projectRecord,
  projectRows,
};
