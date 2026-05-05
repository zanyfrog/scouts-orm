"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const orm = require("./index");

const port = Number(process.env.PORT || 4174);
const authBaseUrl = String(process.env.AUTH_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const internalServiceToken = String(process.env.INTERNAL_SERVICE_TOKEN || "scouts-internal-service");
const readCacheTtlMs = Math.max(1000, Number(process.env.READ_CACHE_TTL_MS) || 15000);
const eventImageReferencesFile = path.join(orm.dataDir, "event-image-references.json");

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
    description: "Scouts ORM data, public payloads, and troop operational endpoints.",
  },
  servers: [{ url: "http://localhost:4174", description: "Local development server" }],
};

const readCache = new Map();

function cloneForCache(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cacheKey(parts) {
  return JSON.stringify(parts);
}

async function readThroughCache(key, loader) {
  const cached = readCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneForCache(cached.value);
  }
  const value = await loader();
  readCache.set(key, { value: cloneForCache(value), expiresAt: Date.now() + readCacheTtlMs });
  return cloneForCache(value);
}

function invalidateReadCaches() {
  readCache.clear();
}

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

function readJsonFile(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    return fallback;
  }
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

function isLocalRequest(req) {
  const address = req.socket.remoteAddress || "";
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1"
  );
}

function isInternalServiceRequest(req) {
  const providedToken = String(req.headers["x-internal-service-token"] || "");
  return providedToken && providedToken === internalServiceToken;
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

async function loadDataPayload() {
  return readThroughCache(cacheKey(["data-payload"]), () => orm.getDataPayload());
}

async function loadHolidays() {
  return readThroughCache(cacheKey(["holidays"]), () => orm.getHolidays());
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

async function scopedPayload(actor) {
  const data = await loadDataPayload();
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
    holidays: data.holidays,
  };
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
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".ogg": "video/ogg",
    ".webm": "video/webm",
  }[extension] || "application/octet-stream";
}

function normalizeHoliday(record) {
  const date = String(record?.date || "").trim();
  const rawEndDate = String(record?.endDate || record?.date || "").trim();
  const endDate = rawEndDate && date && rawEndDate < date ? date : rawEndDate;
  return {
    id: String(record?.id || "").trim(),
    name: String(record?.name || "Custom holiday").trim(),
    date,
    endDate,
    placedBy: String(record?.placedBy || "").trim(),
    role: String(record?.role || "").trim(),
    note: String(record?.note || "").trim(),
  };
}

function readEventImageSources() {
  const references = readJsonFile(eventImageReferencesFile, {});
  const values = Object.values(references).filter((value) => typeof value === "string" && value.trim());
  const publicImage = values.find((value) => /^https?:\/\//i.test(value)) || "";
  const inlineImages = values.filter((value) => /^data:image\//i.test(value));
  const photoImages = inlineImages.filter((value) => !/^data:image\/svg/i.test(value));
  const smallPhotoImages = photoImages.filter((value) => value.length < 50000);
  return { publicImage, inlineImages, photoImages, smallPhotoImages };
}

function isPublicImageReference(value) {
  const source = String(value || "").trim();
  return /^https?:\/\//i.test(source) || /^assets\//i.test(source) || /^\/api\/public\/events\//i.test(source) || /^\/api\/event-media\//i.test(source);
}

function isInlineImageReference(value) {
  return /^data:(image|video)\//i.test(String(value || "").trim());
}

function publicImageAllowed(value, includeInlineImages = false) {
  return isPublicImageReference(value) || (includeInlineImages && isInlineImageReference(value));
}

function publicMediaReference(eventId, kind, index = 0) {
  return kind === "primary"
    ? `/api/public/events/${encodeURIComponent(eventId)}/media/primary`
    : `/api/public/events/${encodeURIComponent(eventId)}/media/gallery/${index}`;
}

function toPublicMediaReference(eventId, value, kind, index = 0) {
  const source = String(value || "").trim();
  if (!source) return "";
  return isInlineImageReference(source) ? publicMediaReference(eventId, kind, index) : source;
}

function sendDataUrlMedia(res, dataUrl) {
  const source = String(dataUrl || "").trim();
  const match = source.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) {
    json(res, 404, { error: "Media not found" });
    return;
  }
  const [, mimeType, base64Flag, payload] = match;
  const body = base64Flag ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
  res.writeHead(200, {
    "Content-Type": mimeType || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function eventStartTime(event) {
  const time = new Date(event?.startDate || "").getTime();
  return Number.isFinite(time) ? time : 0;
}

function eventEndTime(event) {
  const time = new Date(event?.endDate || event?.startDate || "").getTime();
  return Number.isFinite(time) ? time : eventStartTime(event);
}

function isUpcomingPublicEvent(event) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventEndTime(event) >= today.getTime();
}

function publicFeaturedImageEventIds(events) {
  const sortedEvents = [...events].sort((a, b) => eventStartTime(a) - eventStartTime(b));
  const upcoming = sortedEvents.filter(isUpcomingPublicEvent);
  const recent = sortedEvents.filter((event) => !isUpcomingPublicEvent(event));
  const ids = new Set([upcoming[0]?.id, recent[recent.length - 1]?.id].filter(Boolean));
  const walkersvilleSource = sortedEvents.find((event) => String(event.homeBase || event.location || "").toLowerCase().includes("walkersville"));
  if (walkersvilleSource?.id) ids.add(walkersvilleSource.id);
  return ids;
}

function publicFallbackImageForEvent(event, index, sources) {
  const text = `${event?.title || ""} ${event?.homeBase || ""} ${event?.location || ""}`.toLowerCase();
  if (text.includes("sandy point")) return sources.publicImage || sources.inlineImages[0] || "";
  if (text.includes("walkersville")) return sources.photoImages[0] || sources.inlineImages[0] || sources.publicImage || "";
  if (text.includes("board of review") || text.includes("review")) return sources.smallPhotoImages[0] || sources.photoImages[0] || sources.inlineImages[0] || sources.publicImage || "";
  if (text.includes("adventure")) return sources.inlineImages[1] || sources.inlineImages[0] || sources.publicImage || "";
  if (text.includes("camp")) {
    const campImages = sources.photoImages.length ? sources.photoImages : sources.inlineImages;
    return campImages[index % Math.max(1, campImages.length)] || sources.publicImage || "";
  }
  const fallbackImages = sources.photoImages.length ? sources.photoImages : sources.inlineImages;
  return fallbackImages[index % Math.max(1, fallbackImages.length)] || sources.publicImage || "";
}

function shouldIncludeCalendarFallbackImage(event) {
  const text = `${event?.title || ""} ${event?.category || ""} ${event?.homeBase || ""} ${event?.location || ""}`.toLowerCase();
  return text.includes("board of review") || text.includes("review");
}

function hasPublicEventMedia(event) {
  const image = String(event?.image || "").trim();
  const gallery = Array.isArray(event?.gallery) ? event.gallery : [];
  return Boolean(image) || gallery.some((item) => String(item?.src || item?.image || item || "").trim());
}

function enrichCalendarEventMedia(events) {
  const sources = readEventImageSources();
  return (Array.isArray(events) ? events : []).map((event, index) => {
    if (!shouldIncludeCalendarFallbackImage(event) || String(event?.image || "").trim()) {
      return event;
    }
    const image = publicFallbackImageForEvent(event, index, sources);
    return {
      ...event,
      image,
      gallery: image ? [{ src: image }] : [],
    };
  });
}

function enrichPublicFeaturedEventMedia(events) {
  const sources = readEventImageSources();
  const featuredIds = publicFeaturedImageEventIds(events);
  return (Array.isArray(events) ? events : []).map((event, index) => {
    if (!featuredIds.has(event?.id)) {
      return event;
    }
    const gallery = Array.isArray(event?.gallery) ? event.gallery : [];
    const image = String(event?.image || "").trim() || publicFallbackImageForEvent(event, index, sources);
    return {
      ...event,
      image,
      gallery: gallery.length ? gallery : (image ? [{ src: image }] : []),
    };
  });
}

function dedupePublicEventMedia(events) {
  const seenMedia = new Set();
  return (Array.isArray(events) ? events : []).map((event) => {
    const image = String(event?.image || "");
    const gallery = Array.isArray(event?.gallery) ? event.gallery : [];
    const mediaKey = image || gallery.map((item) => item?.src || item?.image || "").find(Boolean) || "";
    if (!mediaKey || !seenMedia.has(mediaKey)) {
      if (mediaKey) seenMedia.add(mediaKey);
      return event;
    }
    return { ...event, image: "", gallery: [] };
  });
}

function publicEventSummary(event, includeInlineImages = false) {
  let gallery = Array.isArray(event?.gallery)
    ? event.gallery
        .map((item) => (typeof item === "string" ? { src: item } : item))
        .filter((item) => publicImageAllowed(item?.src || item?.image, includeInlineImages))
        .slice(0, includeInlineImages ? 1 : 3)
        .map((item, index) => ({
          ...item,
          src: toPublicMediaReference(event.id, item?.src || item?.image, "gallery", index),
          image: undefined,
        }))
    : [];
  const image = publicImageAllowed(event?.image, includeInlineImages) ? toPublicMediaReference(event.id, event.image, "primary") : gallery[0]?.src || "";
  if (includeInlineImages && image && gallery.length && (gallery[0].src || gallery[0].image) === image) {
    gallery = [];
  }

  return {
    id: event.id,
    title: event.title,
    category: event.category,
    startDate: event.startDate,
    endDate: event.endDate,
    dateLabel: event.dateLabel,
    homeBase: event.homeBase,
    location: event.location,
    audience: event.audience,
    description: event.description,
    detailNote: event.detailNote,
    activities: Array.isArray(event.activities) ? event.activities : [],
    image,
    gallery,
    upcoming: event.upcoming,
    repeatEnabled: event.repeatEnabled,
    repeatFrequency: event.repeatFrequency,
    repeatInterval: event.repeatInterval,
    repeatUntil: event.repeatUntil,
    repeatMonthlyPattern: event.repeatMonthlyPattern,
    repeatMonthlyOrdinal: event.repeatMonthlyOrdinal,
    repeatMonthlyWeekday: event.repeatMonthlyWeekday,
  };
}

function buildEventsQueryKey(url) {
  return cacheKey([
    "events",
    url.searchParams.get("startDate") || "",
    url.searchParams.get("endDate") || "",
    url.searchParams.get("page") || "1",
    url.searchParams.get("pageSize") || "50",
  ]);
}

async function loadPublicEventsResult(reqUrl) {
  const url = new URL(reqUrl, "http://localhost");
  return readThroughCache(buildEventsQueryKey(url), () => orm.getEvents({
    startDate: url.searchParams.get("startDate") || "",
    endDate: url.searchParams.get("endDate") || "",
    page: url.searchParams.get("page") || 1,
    pageSize: url.searchParams.get("pageSize") || 50,
  }));
}

async function fetchFullOrmEvent(eventId) {
  return readThroughCache(cacheKey(["event-full", eventId]), () => orm.getEventById(eventId, { includeMedia: true }));
}

async function fetchPublicOrmEventSummary(eventId) {
  return readThroughCache(cacheKey(["event-summary", eventId]), () => orm.getEventById(eventId, { includeMedia: false }));
}

async function hydrateFeaturedEventMedia(events) {
  const featuredIds = publicFeaturedImageEventIds(events);
  const fullEvents = await Promise.all([...featuredIds].map(fetchFullOrmEvent));
  const fullById = new Map(fullEvents.filter(Boolean).map((event) => [String(event.id), event]));
  return events.map((event) => {
    const fullEvent = fullById.get(String(event.id));
    if (!fullEvent) return event;
    return {
      ...event,
      image: fullEvent.image || event.image,
      gallery: Array.isArray(fullEvent.gallery) ? fullEvent.gallery : event.gallery,
    };
  });
}

async function publicPayload(reqUrl) {
  const url = new URL(reqUrl, "http://localhost");
  return readThroughCache(cacheKey(["public-payload", url.search]), async () => {
    const eventPage = await loadPublicEventsResult(reqUrl);
    const sourceEvents = Array.isArray(eventPage.events) ? eventPage.events : [];
    const hydratedEvents = await hydrateFeaturedEventMedia(sourceEvents);
    const enrichedEvents = dedupePublicEventMedia(enrichPublicFeaturedEventMedia(hydratedEvents));
    const payload = await loadDataPayload();
    return {
      events: enrichedEvents.map((event) => publicEventSummary(event, true)),
      patrols: payload.patrols,
      holidays: (payload.holidays || []).map(normalizeHoliday),
    };
  });
}

async function publicEventDetailPayload(eventId) {
  return readThroughCache(cacheKey(["public-event-detail", eventId]), async () => {
    const summaryEvent = await fetchPublicOrmEventSummary(eventId);
    if (!summaryEvent) {
      return null;
    }
    let event = summaryEvent;
    if (!hasPublicEventMedia(summaryEvent)) {
      const fullEvent = await fetchFullOrmEvent(eventId);
      if (fullEvent) {
        event = {
          ...summaryEvent,
          image: fullEvent.image || summaryEvent.image,
          gallery: Array.isArray(fullEvent.gallery) ? fullEvent.gallery : summaryEvent.gallery,
        };
      }
    }
    const enrichedEvent = enrichPublicFeaturedEventMedia([event])[0];
    return { data: publicEventSummary(enrichedEvent, true) };
  });
}

async function publicEventMediaSource(eventId, mediaPath) {
  return readThroughCache(cacheKey(["public-event-media", eventId, mediaPath]), async () => {
    const event = await fetchFullOrmEvent(eventId);
    if (!event) return "";
    if (mediaPath === "primary") {
      return String(event.image || "").trim();
    }
    const galleryMatch = String(mediaPath || "").match(/^gallery\/(\d+)$/);
    if (!galleryMatch) return "";
    const galleryIndex = Number(galleryMatch[1]);
    const galleryItem = Array.isArray(event.gallery) ? event.gallery[galleryIndex] : null;
    return String((typeof galleryItem === "string" ? galleryItem : galleryItem?.src || galleryItem?.image) || "").trim();
  });
}

async function authSyncPayload() {
  const payload = await loadDataPayload();
  return {
    scouts: payload.scouts.map((scout) => ({ id: scout.id, name: scout.name, email: scout.email || "" })),
    adults: payload.adults.map((adult) => ({ id: adult.id, name: adult.name, email: adult.email || "" })),
    adultLeaders: payload.adultLeaders.map((leader) => ({ adultId: leader.adultId, role: leader.role })),
    adultScoutRelationships: payload.adultScoutRelationships.map((relationship) => ({
      adultId: relationship.adultId,
      scoutId: relationship.scoutId,
      relationship: relationship.relationship,
      priority: relationship.priority,
    })),
  };
}

const initialized = orm.ensureDataFiles();

async function handleApi(req, res) {
  await initialized;

  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/openapi.json") {
    json(res, 200, openApiDocument);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/public") {
    json(res, 200, await publicPayload(req.url));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/holidays") {
    json(res, 200, { holidays: await loadHolidays() });
    return true;
  }

  const publicMediaMatch = url.pathname.match(/^\/api\/public\/events\/([^/]+)\/media\/(.+)$/);
  if (req.method === "GET" && publicMediaMatch) {
    const eventId = decodeURIComponent(publicMediaMatch[1]);
    const mediaSource = await publicEventMediaSource(eventId, decodeURIComponent(publicMediaMatch[2]));
    if (isInlineImageReference(mediaSource)) {
      sendDataUrlMedia(res, mediaSource);
    } else if (/^\/api\/event-media\//.test(mediaSource)) {
      const filename = path.basename(decodeURIComponent(mediaSource.replace("/api/event-media/", "")));
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
    } else {
      json(res, 404, { error: "Media not found" });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/public/events/")) {
    const eventId = decodeURIComponent(url.pathname.replace("/api/public/events/", ""));
    const payload = await publicEventDetailPayload(eventId);
    json(res, payload ? 200 : 404, payload || { error: "Event not found" });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/event-media/")) {
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

  if (req.method === "GET" && url.pathname === "/api/auth-sync-data") {
    if (!isInternalServiceRequest(req) && !isLocalRequest(req)) {
      forbidden(res, { authenticated: false });
      return true;
    }
    json(res, 200, await authSyncPayload());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    const payload = await loadPublicEventsResult(req.url);
    const sourceEvents = Array.isArray(payload.events) ? payload.events : [];
    const enrichedEvents = enrichCalendarEventMedia(sourceEvents);
    json(res, 200, { ...payload, events: enrichedEvents.map((event) => publicEventSummary(event, true)) });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/events/")) {
    const eventId = decodeURIComponent(url.pathname.replace("/api/events/", ""));
    const event = url.searchParams.get("includeMedia") === "false"
      ? await fetchPublicOrmEventSummary(eventId)
      : await fetchFullOrmEvent(eventId);
    json(res, event ? 200 : 404, event ? { event } : { error: "Event not found" });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/me/dashboard") {
    const actor = await requireActor(req, res, hasMemberAccess);
    if (!actor) return true;
    json(res, 200, { actor, data: await scopedPayload(actor) });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/scouts/")) {
    const actor = await authenticate(req);
    if (!actor) {
      unauthorized(res);
      return true;
    }
    const scoutId = decodeURIComponent(url.pathname.slice("/api/scouts/".length));
    if (!canAccessScout(actor, scoutId)) {
      forbidden(res, actor);
      return true;
    }
    const scout = (await loadDataPayload()).scouts.find((item) => item.id === scoutId);
    if (!scout) {
      json(res, 404, { error: "Scout not found" });
      return true;
    }
    json(res, 200, { scout });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/data") {
    const actor = await requireActor(req, res, hasOperationalAccess);
    if (!actor) return true;
    json(res, 200, { actor, data: await loadDataPayload() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/data") {
    const actor = await requireActor(req, res, hasOperationalAccess);
    if (!actor) return true;
    json(res, 200, await loadDataPayload());
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/holidays") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveHolidays(Array.isArray(body.holidays) ? body.holidays : []);
    invalidateReadCaches();
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/scouts") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveScouts(Array.isArray(body.scouts) ? body.scouts : []);
    invalidateReadCaches();
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/adults") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveAdults(Array.isArray(body.adults) ? body.adults : []);
    invalidateReadCaches();
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/adult-leaders") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveAdultLeaders(Array.isArray(body.adultLeaders) ? body.adultLeaders : []);
    invalidateReadCaches();
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/adult-scout-relationships") {
    const actor = await requireActor(req, res, hasAdministrator);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveAdultScoutRelationships(Array.isArray(body.adultScoutRelationships) ? body.adultScoutRelationships : []);
    invalidateReadCaches();
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/patrols") {
    const actor = await requireActor(req, res, hasOperationalWriteAccess);
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.savePatrols(Array.isArray(body.patrols) ? body.patrols : []);
    invalidateReadCaches();
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/events") {
    const actor = await requireActor(req, res, (candidate) => hasAdministrator(candidate) || hasAnyRole(candidate, [roles.ADULT_LEADER]));
    if (!actor) return true;
    const body = JSON.parse((await readBody(req)) || "{}");
    await orm.saveEvents(Array.isArray(body.events) ? body.events : []);
    invalidateReadCaches();
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
