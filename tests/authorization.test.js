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
      scout: {
        authenticated: true,
        person: { id: "scout-1", externalId: "scout-1", name: "Scout", type: "scout", status: "active" },
        globalRoles: ["public", "scout"],
        unitRoles: [],
        relationships: [],
      },
      admin: {
        authenticated: true,
        person: { id: "adult-admin", externalId: "adult-admin", name: "Admin", type: "adult", status: "active" },
        globalRoles: ["public", "administrator"],
        unitRoles: [],
        relationships: [],
      },
      committee: {
        authenticated: true,
        person: { id: "adult-committee", externalId: "adult-committee", name: "Committee", type: "adult", status: "active" },
        globalRoles: ["public"],
        unitRoles: [{ role: "committee_member", unitId: "unit-1" }],
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

    const publicScoutsResult = await request(baseUrl, "/api/scouts");
    assert.equal(publicScoutsResult.response.status, 401);
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

    const parentScoutsResult = await request(baseUrl, "/api/scouts", {
      headers: { Authorization: "Bearer parent" },
    });
    assert.equal(parentScoutsResult.response.status, 200);
    assert.deepEqual(parentScoutsResult.payload.scouts.map((scout) => scout.id), ["scout-1"]);

    const parentFilteredResult = await request(baseUrl, "/api/scouts?ids=scout-1,scout-2", {
      headers: { Authorization: "Bearer parent" },
    });
    assert.equal(parentFilteredResult.response.status, 200);
    assert.deepEqual(parentFilteredResult.payload.scouts.map((scout) => scout.id), ["scout-1"]);

    const scoutResult = await request(baseUrl, "/api/scouts", {
      headers: { Authorization: "Bearer scout" },
    });
    assert.equal(scoutResult.response.status, 200);
    assert.deepEqual(scoutResult.payload.scouts.map((scout) => scout.id), ["scout-1"]);

    const parentScoutDetail = await request(baseUrl, "/api/scouts/scout-1", {
      headers: { Authorization: "Bearer parent" },
    });
    assert.equal(parentScoutDetail.response.status, 200);
    assert.equal(parentScoutDetail.payload.scout.id, "scout-1");

    const parentDeniedDetail = await request(baseUrl, "/api/scouts/scout-2", {
      headers: { Authorization: "Bearer parent" },
    });
    assert.equal(parentDeniedDetail.response.status, 403);

    const leaderResult = await request(baseUrl, "/api/data", {
      headers: { Authorization: "Bearer leader" },
    });
    assert.equal(leaderResult.response.status, 200);
    assert.ok(leaderResult.payload.scouts.length > 1);

    const leaderScoutsResult = await request(baseUrl, "/api/scouts", {
      headers: { Authorization: "Bearer leader" },
    });
    assert.equal(leaderScoutsResult.response.status, 200);
    assert.ok(leaderScoutsResult.payload.scouts.length > 1);

    const parentAdultsDenied = await request(baseUrl, "/api/adults", {
      headers: { Authorization: "Bearer parent" },
    });
    assert.equal(parentAdultsDenied.response.status, 403);

    const leaderAdultsResult = await request(baseUrl, "/api/adults", {
      headers: { Authorization: "Bearer leader" },
    });
    assert.equal(leaderAdultsResult.response.status, 200);
    assert.ok(leaderAdultsResult.payload.adults.length > 1);

    const filteredAdultsResult = await request(baseUrl, "/api/adults?ids=adult-1,missing-adult", {
      headers: { Authorization: "Bearer leader" },
    });
    assert.equal(filteredAdultsResult.response.status, 200);
    assert.deepEqual(filteredAdultsResult.payload.adults.map((adult) => adult.id), ["adult-1"]);

    const adultDetailResult = await request(baseUrl, "/api/adults/adult-1", {
      headers: { Authorization: "Bearer leader" },
    });
    assert.equal(adultDetailResult.response.status, 200);
    assert.equal(adultDetailResult.payload.adult.id, "adult-1");

    const testAdult = {
      id: "adult-test-crud",
      name: "Test Adult CRUD",
      relationship: "Adult leader",
      email: "adult-test-crud@example.com",
      homePhone: "",
      cellPhone: "555-0100",
    };
    const createAdultResult = await request(baseUrl, "/api/adults", {
      method: "POST",
      headers: {
        Authorization: "Bearer leader",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ adult: testAdult }),
    });
    assert.equal(createAdultResult.response.status, 200);
    assert.equal(createAdultResult.payload.adult.id, testAdult.id);

    const updateAdultResult = await request(baseUrl, `/api/adults/${testAdult.id}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer leader",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ adult: { ...testAdult, cellPhone: "555-0101" } }),
    });
    assert.equal(updateAdultResult.response.status, 200);
    assert.equal(updateAdultResult.payload.adult.cellPhone, "555-0101");

    const deleteAdultResult = await request(baseUrl, `/api/adults/${testAdult.id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer leader" },
    });
    assert.equal(deleteAdultResult.response.status, 200);

    const deletedAdultResult = await request(baseUrl, `/api/adults/${testAdult.id}`, {
      headers: { Authorization: "Bearer leader" },
    });
    assert.equal(deletedAdultResult.response.status, 404);

    const originalScout = parentScoutDetail.payload.scout;
    const parentWriteResult = await request(baseUrl, "/api/scouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer parent",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scout: { id: originalScout.id, nickname: originalScout.nickname, rank: "Forbidden Rank" } }),
    });
    assert.equal(parentWriteResult.response.status, 200);
    assert.equal(parentWriteResult.payload.scout.nickname, originalScout.nickname);
    assert.equal(parentWriteResult.payload.scout.rank, originalScout.rank);

    const scoutWriteResult = await request(baseUrl, "/api/scouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer scout",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scout: { id: originalScout.id, avatar: originalScout.avatar, patrol: "Forbidden Patrol" } }),
    });
    assert.equal(scoutWriteResult.response.status, 200);
    assert.equal(scoutWriteResult.payload.scout.avatar, originalScout.avatar);
    assert.equal(scoutWriteResult.payload.scout.patrol, originalScout.patrol);

    const leaderWriteResult = await request(baseUrl, "/api/scouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer leader",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scout: { ...originalScout, rank: originalScout.rank } }),
    });
    assert.equal(leaderWriteResult.response.status, 200);
    assert.equal(leaderWriteResult.payload.scout.id, originalScout.id);

    const adminDataResult = await request(baseUrl, "/api/data", {
      headers: { Authorization: "Bearer admin" },
    });
    assert.equal(adminDataResult.response.status, 403);

    const adminScoutDetailResult = await request(baseUrl, "/api/scouts/scout-1", {
      headers: { Authorization: "Bearer admin" },
    });
    assert.equal(adminScoutDetailResult.response.status, 403);

    const adminScoutWriteResult = await request(baseUrl, "/api/scouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scout: { id: originalScout.id, nickname: originalScout.nickname } }),
    });
    assert.equal(adminScoutWriteResult.response.status, 403);

    const committeeScoutsResult = await request(baseUrl, "/api/scouts", {
      headers: { Authorization: "Bearer committee" },
    });
    assert.equal(committeeScoutsResult.response.status, 403);

    const bulkScoutWriteResult = await request(baseUrl, "/api/scouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer leader",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scouts: leaderResult.payload.scouts }),
    });
    assert.equal(bulkScoutWriteResult.response.status, 400);

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
