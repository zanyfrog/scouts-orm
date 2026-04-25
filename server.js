const http = require("http");
const orm = require("./index");

const port = Number(process.env.PORT || 4174);

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
  res.end(JSON.stringify(payload));
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/data") {
    json(res, 200, orm.getDataPayload());
    return true;
  }

  if (req.method === "POST" && req.url === "/api/scouts") {
    const body = JSON.parse((await readBody(req)) || "{}");
    orm.saveScouts(Array.isArray(body.scouts) ? body.scouts : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/adults") {
    const body = JSON.parse((await readBody(req)) || "{}");
    orm.saveAdults(Array.isArray(body.adults) ? body.adults : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/adult-leaders") {
    const body = JSON.parse((await readBody(req)) || "{}");
    orm.saveAdultLeaders(Array.isArray(body.adultLeaders) ? body.adultLeaders : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/adult-scout-relationships") {
    const body = JSON.parse((await readBody(req)) || "{}");
    orm.saveAdultScoutRelationships(Array.isArray(body.adultScoutRelationships) ? body.adultScoutRelationships : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/patrols") {
    const body = JSON.parse((await readBody(req)) || "{}");
    orm.savePatrols(Array.isArray(body.patrols) ? body.patrols : []);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/events") {
    const body = JSON.parse((await readBody(req)) || "{}");
    orm.saveEvents(Array.isArray(body.events) ? body.events : []);
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}

orm.ensureDataFiles();

const server = http.createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) {
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Scout ORM server running at http://0.0.0.0:${port}`);
});
