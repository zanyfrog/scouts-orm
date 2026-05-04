const http = require("http");
const test = require("node:test");
const assert = require("node:assert/strict");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function createAuthServer() {
  return http.createServer((req, res) => {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const actors = {
      parent: {
        authenticated: true,
        person: { id: "adult-4", externalId: "adult-4", name: "Parent", type: "adult", status: "active" },
        globalRoles: ["public", "parent"],
        unitRoles: [],
        relationships: [{ scoutPersonId: "scout-1", relationship: "parent", grantsRole: "scout" }],
      },
      leader: {
        authenticated: true,
        person: { id: "adult-1", externalId: "adult-1", name: "Leader", type: "adult", status: "active" },
        globalRoles: ["public"],
        unitRoles: [{ role: "adult_leader", unitId: "unit-1" }],
        relationships: [],
      },
      admin: {
        authenticated: true,
        person: { id: "adult-admin", externalId: "adult-admin", name: "Admin", type: "adult", status: "active" },
        globalRoles: ["public", "administrator"],
        unitRoles: [],
        relationships: [],
      },
    };
    const actor = actors[token];
    if (!actor) {
      res.writeHead(token ? 401 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(token ? { error: "Invalid session" } : { authenticated: false, globalRoles: ["public"], unitRoles: [], relationships: [] }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(actor));
  });
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

test("ORM protects broad data while keeping public payload available", async () => {
  const authServer = createAuthServer();
  const authPort = await listen(authServer);
  process.env.AUTH_BASE_URL = `http://127.0.0.1:${authPort}`;
  delete require.cache[require.resolve("../server")];
  const { server } = require("../server");
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const publicResult = await request(baseUrl, "/api/public");
    assert.equal(publicResult.response.status, 200);
    assert.ok(Array.isArray(publicResult.payload.events));
    assert.equal(publicResult.payload.scouts, undefined);

    const eventsResult = await request(baseUrl, "/api/events?startDate=2026-04-01&endDate=2026-04-30&page=1&pageSize=2");
    assert.equal(eventsResult.response.status, 200);
    assert.ok(Array.isArray(eventsResult.payload.events));
    assert.equal(eventsResult.payload.pagination.page, 1);
    assert.equal(eventsResult.payload.pagination.pageSize, 2);
    assert.ok(eventsResult.payload.events.length <= 2);

    const eventDetailResult = await request(baseUrl, `/api/events/${eventsResult.payload.events[0].id}?includeMedia=false`);
    assert.equal(eventDetailResult.response.status, 200);
    assert.equal(eventDetailResult.payload.event.id, eventsResult.payload.events[0].id);
    assert.equal(eventDetailResult.payload.event.gallery, undefined);

    const broadResult = await request(baseUrl, "/api/data");
    assert.equal(broadResult.response.status, 401);
  } finally {
    await close(server);
    await close(authServer);
  }
});

test("ORM scopes parent data to linked scouts and lets leaders read/write operational data", async () => {
  const authServer = createAuthServer();
  const authPort = await listen(authServer);
  process.env.AUTH_BASE_URL = `http://127.0.0.1:${authPort}`;
  delete require.cache[require.resolve("../server")];
  const { server } = require("../server");
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const parentResult = await request(baseUrl, "/api/me/dashboard", {
      headers: { Authorization: "Bearer parent" },
    });
    assert.equal(parentResult.response.status, 200);
    assert.deepEqual(parentResult.payload.data.scouts.map((scout) => scout.id), ["scout-1"]);

    const leaderResult = await request(baseUrl, "/api/data", {
      headers: { Authorization: "Bearer leader" },
    });
    assert.equal(leaderResult.response.status, 200);
    assert.ok(leaderResult.payload.scouts.length > 1);

    const writeResult = await request(baseUrl, "/api/scouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer leader",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scouts: leaderResult.payload.scouts }),
    });
    assert.equal(writeResult.response.status, 200);

    const deniedRelationshipWrite = await request(baseUrl, "/api/adult-scout-relationships", {
      method: "POST",
      headers: {
        Authorization: "Bearer leader",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ adultScoutRelationships: leaderResult.payload.adultScoutRelationships }),
    });
    assert.equal(deniedRelationshipWrite.response.status, 403);
  } finally {
    await close(server);
    await close(authServer);
  }
});
