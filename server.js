const http = require("http");
const fs = require("fs");
const path = require("path");
const orm = require("./index");

const port = Number(process.env.PORT || 4174);
const authBaseUrl = String(process.env.AUTH_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const roles = {
  PUBLIC: "public",
  SCOUT: "scout",
  PARENT: "parent",
  ADULT_LEADER: "adult_leader",
  COMMITTEE_MEMBER: "committee_member",
  ADMINISTRATOR: "administrator",
};

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Scouts ORM API",
    version: "1.0.0",
    description: "Read and replace Scout ORM data collections.",
  },
  servers: [
    {
      url: "http://localhost:4174",
      description: "Local development server",
    },
  ],
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        summary: "Check service health",
        responses: {
          200: {
            description: "The service is running.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkResponse" },
              },
            },
          },
        },
      },
    },
    "/api/data": {
      get: {
        operationId: "getData",
        summary: "Get all stored Scout ORM data",
        responses: {
          200: {
            description: "All persisted data collections.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DataPayload" },
              },
            },
          },
        },
      },
    },
    "/api/scouts": {
      post: {
        operationId: "replaceScouts",
        summary: "Replace scouts",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["scouts"],
                properties: {
                  scouts: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Scout" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/Ok" },
        },
      },
    },
    "/api/adults": {
      post: {
        operationId: "replaceAdults",
        summary: "Replace adults",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["adults"],
                properties: {
                  adults: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Adult" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/Ok" },
        },
      },
    },
    "/api/adult-leaders": {
      post: {
        operationId: "replaceAdultLeaders",
        summary: "Replace adult leaders",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["adultLeaders"],
                properties: {
                  adultLeaders: {
                    type: "array",
                    items: { $ref: "#/components/schemas/AdultLeader" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/Ok" },
        },
      },
    },
    "/api/adult-scout-relationships": {
      post: {
        operationId: "replaceAdultScoutRelationships",
        summary: "Replace adult/scout relationships",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["adultScoutRelationships"],
                properties: {
                  adultScoutRelationships: {
                    type: "array",
                    items: { $ref: "#/components/schemas/AdultScoutRelationship" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/Ok" },
        },
      },
    },
    "/api/patrols": {
      post: {
        operationId: "replacePatrols",
        summary: "Replace patrols",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["patrols"],
                properties: {
                  patrols: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Patrol" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/Ok" },
        },
      },
    },
    "/api/events": {
      get: {
        operationId: "getEvents",
        summary: "Get events by date range",
        parameters: [
          {
            name: "startDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
          },
          {
            name: "endDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          },
        ],
        responses: {
          200: {
            description: "A paginated list of events matching the date range.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EventPage" },
              },
            },
          },
        },
      },
      post: {
        operationId: "replaceEvents",
        summary: "Replace events",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["events"],
                properties: {
                  events: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Event" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/Ok" },
        },
      },
    },
    "/openapi.json": {
      get: {
        operationId: "getOpenApiDocument",
        summary: "Get the OpenAPI document",
        responses: {
          200: {
            description: "The OpenAPI 3.1 document for this API.",
            content: {
              "application/json": {
                schema: true,
              },
            },
          },
        },
      },
    },
  },
  components: {
    responses: {
      Ok: {
        description: "The collection was saved.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OkResponse" },
          },
        },
      },
    },
    schemas: {
      OkResponse: {
        type: "object",
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
        },
      },
      DataPayload: {
        type: "object",
        required: ["scouts", "adults", "adultLeaders", "adultScoutRelationships", "patrols", "events"],
        properties: {
          scouts: {
            type: "array",
            items: { $ref: "#/components/schemas/Scout" },
          },
          adults: {
            type: "array",
            items: { $ref: "#/components/schemas/Adult" },
          },
          adultLeaders: {
            type: "array",
            items: { $ref: "#/components/schemas/AdultLeader" },
          },
          adultScoutRelationships: {
            type: "array",
            items: { $ref: "#/components/schemas/AdultScoutRelationship" },
          },
          patrols: {
            type: "array",
            items: { $ref: "#/components/schemas/Patrol" },
          },
          events: {
            type: "array",
            items: { $ref: "#/components/schemas/Event" },
          },
        },
      },
      Scout: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          nickname: { type: "string" },
          gender: { type: "string" },
          patrol: { type: "string" },
          patrolBadge: { type: "string" },
          rank: { type: "string" },
          leadershipRole: { type: "string" },
          avatar: { type: "string" },
        },
        additionalProperties: true,
      },
      Adult: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          relationship: { type: "string" },
          email: { type: "string" },
          homePhone: { type: "string" },
          cellPhone: { type: "string" },
        },
        additionalProperties: true,
      },
      AdultLeader: {
        type: "object",
        required: ["adultId", "role"],
        properties: {
          adultId: { type: "string" },
          role: { type: "string" },
        },
        additionalProperties: true,
      },
      AdultScoutRelationship: {
        type: "object",
        required: ["adultId", "scoutId"],
        properties: {
          adultId: { type: "string" },
          scoutId: { type: "string" },
          relationship: { type: "string" },
          priority: { type: "string" },
        },
        additionalProperties: true,
      },
      Patrol: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          badge: { type: "string" },
        },
        additionalProperties: true,
      },
      Event: {
        type: "object",
        required: ["id", "title"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          category: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          dateLabel: { type: "string" },
          location: { type: "string" },
          audience: { type: "string" },
          description: { type: "string" },
          detailNote: { type: "string" },
          image: { type: "string" },
          gallery: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          upcoming: { type: "boolean" },
        },
        additionalProperties: true,
      },
      EventPage: {
        type: "object",
        required: ["events", "pagination", "range"],
        properties: {
          events: {
            type: "array",
            items: { $ref: "#/components/schemas/Event" },
          },
          pagination: {
            type: "object",
            required: ["page", "pageSize", "total", "totalPages"],
            properties: {
              page: { type: "integer" },
              pageSize: { type: "integer" },
              total: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
          range: {
            type: "object",
            properties: {
              startDate: { type: ["string", "null"] },
              endDate: { type: ["string", "null"] },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

function unauthorized(res, message = "Authentication required") {
  json(res, 401, { error: message });
}

function forbidden(res, actor) {
  json(res, 403, { error: "Forbidden", actor });
}

async function authenticate(req, { allowPublic = false } = {}) {
  const token = getBearerToken(req);
  if (!token && !allowPublic) {
    return null;
  }

  const response = await fetch(`${authBaseUrl}/auth/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Authentication failed");
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function actorRoles(actor) {
  return new Set([
    ...(actor?.globalRoles || []),
    ...(actor?.unitRoles || []).map((assignment) => assignment.role),
  ]);
}

function hasAnyRole(actor, allowedRoles) {
  const assignedRoles = actorRoles(actor);
  return allowedRoles.some((role) => assignedRoles.has(role));
}

function hasAdministrator(actor) {
  return actorRoles(actor).has(roles.ADMINISTRATOR);
}

function hasOperationalAccess(actor) {
  return hasAdministrator(actor) || hasAnyRole(actor, [roles.ADULT_LEADER, roles.COMMITTEE_MEMBER]);
}

function hasOperationalWriteAccess(actor) {
  return hasAdministrator(actor) || hasAnyRole(actor, [roles.ADULT_LEADER]);
}

function hasMemberAccess(actor) {
  return Boolean(actor?.authenticated) && hasAnyRole(actor, [
    roles.SCOUT,
    roles.PARENT,
    roles.ADULT_LEADER,
    roles.COMMITTEE_MEMBER,
    roles.ADMINISTRATOR,
  ]);
}

async function requireActor(req, res, predicate) {
  const actor = await authenticate(req);
  if (!actor) {
    unauthorized(res);
    return null;
  }
  if (!predicate(actor)) {
    forbidden(res, actor);
    return null;
  }
  return actor;
}

function actorPersonId(actor) {
  return actor?.person?.externalId || actor?.person?.id || "";
}

function linkedScoutIds(actor) {
  return new Set((actor?.relationships || []).map((relationship) => relationship.scoutPersonId));
}

function scoutIdsForActor(actor) {
  if (hasOperationalAccess(actor)) {
    return null;
  }
  const allowed = linkedScoutIds(actor);
  if ((actor?.globalRoles || []).includes(roles.SCOUT) && actorPersonId(actor)) {
    allowed.add(actorPersonId(actor));
  }
  return allowed;
}

async function publicPayload() {
  const data = await orm.getDataPayload();
  return {
    events: data.events,
    patrols: data.patrols,
  };
}

async function scopedPayload(actor) {
  const data = await orm.getDataPayload();
  const allowedScoutIds = scoutIdsForActor(actor);
  if (allowedScoutIds === null) {
    return data;
  }

  const adultIds = new Set(
    data.adultScoutRelationships
      .filter((relationship) => allowedScoutIds.has(relationship.scoutId))
      .map((relationship) => relationship.adultId)
  );

  return {
    scouts: data.scouts.filter((scout) => allowedScoutIds.has(scout.id)),
    adults: data.adults.filter((adult) => adult.id === actorPersonId(actor) || adultIds.has(adult.id)),
    adultLeaders: [],
    adultScoutRelationships: data.adultScoutRelationships.filter((relationship) => allowedScoutIds.has(relationship.scoutId)),
    patrols: data.patrols,
    events: data.events,
  };
}

function canAccessScout(actor, scoutId) {
  if (hasOperationalAccess(actor)) {
    return true;
  }
  if ((actor?.globalRoles || []).includes(roles.SCOUT) && actorPersonId(actor) === scoutId) {
    return true;
  }
  return linkedScoutIds(actor).has(scoutId);
}

function contentTypeForMedia(filename) {
  const extension = path.extname(filename).toLowerCase();
  return {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  }[extension] || "application/octet-stream";
}

const initialized = orm.ensureDataFiles();

async function handleApi(req, res) {
  await initialized;

  if (req.method === "GET" && req.url === "/openapi.json") {
    json(res, 200, openApiDocument);
    return true;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/public") {
    json(res, 200, await publicPayload());
    return true;
  }

  if (req.method === "GET" && new URL(req.url, "http://localhost").pathname.startsWith("/api/event-media/")) {
    const url = new URL(req.url, "http://localhost");
    const filename = path.basename(decodeURIComponent(url.pathname.replace("/api/event-media/", "")));
    const mediaPath = path.join(orm.dataDir, "event-media", filename);
    if (!mediaPath.startsWith(path.join(orm.dataDir, "event-media")) || !fs.existsSync(mediaPath)) {
      json(res, 404, { error: "Media not found" });
      return true;
    }
    res.writeHead(200, {
      "Content-Type": contentTypeForMedia(filename),
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    fs.createReadStream(mediaPath).pipe(res);
    return true;
  }

  if (req.method === "GET" && new URL(req.url, "http://localhost").pathname.startsWith("/api/events/")) {
    const url = new URL(req.url, "http://localhost");
    const eventId = decodeURIComponent(url.pathname.replace("/api/events/", ""));
    const event = await orm.getEventById(eventId, { includeMedia: url.searchParams.get("includeMedia") !== "false" });
    json(res, event ? 200 : 404, event ? { event } : { error: "Event not found" });
    return true;
  }

  if (req.method === "GET" && new URL(req.url, "http://localhost").pathname === "/api/events") {
    const url = new URL(req.url, "http://localhost");
    json(res, 200, await orm.getEvents({
      startDate: url.searchParams.get("startDate") || "",
      endDate: url.searchParams.get("endDate") || "",
      page: url.searchParams.get("page") || 1,
      pageSize: url.searchParams.get("pageSize") || 50,
    }));
    return true;
  }

  if (req.method === "GET" && req.url === "/api/me/dashboard") {
    const actor = await requireActor(req, res, hasMemberAccess);
    if (!actor) return true;
    json(res, 200, { actor, data: await scopedPayload(actor) });
    return true;
  }

  if (req.method === "GET" && req.url.startsWith("/api/scouts/")) {
    const actor = await authenticate(req);
    if (!actor) {
      unauthorized(res);
      return true;
    }
    const scoutId = decodeURIComponent(req.url.slice("/api/scouts/".length));
    if (!canAccessScout(actor, scoutId)) {
      forbidden(res, actor);
      return true;
    }
    const scout = (await orm.getDataPayload()).scouts.find((item) => item.id === scoutId);
    if (!scout) {
      json(res, 404, { error: "Scout not found" });
      return true;
    }
    json(res, 200, { scout });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/admin/data") {
    const actor = await requireActor(req, res, hasOperationalAccess);
    if (!actor) return true;
    json(res, 200, { actor, data: await orm.getDataPayload() });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/data") {
    const actor = await requireActor(req, res, hasOperationalAccess);
    if (!actor) return true;
    json(res, 200, await orm.getDataPayload());
    return true;
  }

  if (req.method === "POST" && req.url === "/api/scouts") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveScouts(Array.isArray(body.scouts) ? body.scouts : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/adults") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveAdults(Array.isArray(body.adults) ? body.adults : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/adult-leaders") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveAdultLeaders(Array.isArray(body.adultLeaders) ? body.adultLeaders : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/adult-scout-relationships") {
    const actor = await requireActor(req, res, hasAdministrator);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveAdultScoutRelationships(Array.isArray(body.adultScoutRelationships) ? body.adultScoutRelationships : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/patrols") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.savePatrols(Array.isArray(body.patrols) ? body.patrols : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/events") {
    const actor = await requireActor(req, res, (candidate) => hasAdministrator(candidate) || hasAnyRole(candidate, [roles.ADULT_LEADER]));
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveEvents(Array.isArray(body.events) ? body.events : []);
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) {
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    json(res, error.statusCode || 500, { error: error.message });
  }
});

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Scout ORM server running at http://0.0.0.0:${port}`);
  });
}

module.exports = {
  server,
  handleApi,
  hasOperationalAccess,
  scopedPayload,
};
