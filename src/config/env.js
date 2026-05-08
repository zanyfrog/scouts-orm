"use strict";

function cleanBaseUrl(value, fallback) {
  return String(value || fallback).replace(/\/+$/, "");
}

function numberFromEnv(value, fallback, minimum = Number.NEGATIVE_INFINITY) {
  return Math.max(minimum, Number(value) || fallback);
}

module.exports = {
  port: Number(process.env.PORT || 4174),
  authBaseUrl: cleanBaseUrl(process.env.AUTH_BASE_URL, "http://127.0.0.1:3000"),
  internalServiceToken: String(process.env.INTERNAL_SERVICE_TOKEN || "scouts-internal-service"),
  readCacheTtlMs: numberFromEnv(process.env.READ_CACHE_TTL_MS, 15000, 1000),
};
