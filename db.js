const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const mediaDirName = "event-media";

let Pool;
let pool;

function enabled() {
  return process.env.DATA_STORE !== "csv" && Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!enabled()) {
    return null;
  }
  if (!Pool) {
    ({ Pool } = require("pg"));
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

function jsonb(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

function parseTimestamp(value, endOfDay = false) {
  const source = String(value || "").trim();
  if (!source) return null;
  const dateOnlyMatch = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
    : new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eventStartTime(event) {
  return parseTimestamp(event?.startDate)?.getTime() || 0;
}

function eventEndTime(event) {
  const end = parseTimestamp(event?.endDate || event?.startDate, true);
  return end?.getTime() || eventStartTime(event);
}

function eventOccursInRange(event, rangeStart, rangeEnd) {
  const startTime = eventStartTime(event);
  const endTime = eventEndTime(event);
  if (!startTime || !endTime) return false;
  if (startTime <= rangeEnd.getTime() && endTime >= rangeStart.getTime()) return true;
  if (!event?.repeatEnabled) return false;
  const repeatUntil = event.repeatUntil ? parseTimestamp(event.repeatUntil, true) : null;
  if (startTime > rangeEnd.getTime()) return false;
  return !repeatUntil || repeatUntil.getTime() >= rangeStart.getTime();
}

function safeFilePart(value) {
  return String(value || "media").replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "media";
}

function imageExtensionForSource(source) {
  const dataUriMatch = String(source || "").match(/^data:image\/([a-z0-9.+-]+)[;,]/i);
  if (dataUriMatch) {
    const format = dataUriMatch[1].toLowerCase();
    if (format === "jpeg") return "jpg";
    if (format === "svg+xml") return "svg";
    return format.replace(/[^a-z0-9]+/g, "") || "img";
  }
  try {
    const url = new URL(String(source || ""));
    return path.extname(url.pathname || "").toLowerCase().replace(/^\./, "") || "img";
  } catch (error) {
    return "img";
  }
}

function externalMediaSource(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function dataUriParts(value) {
  const match = String(value || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  return {
    mimeType: match[1] || "application/octet-stream",
    isBase64: Boolean(match[2]),
    payload: match[3] || "",
  };
}

function persistMediaSource(dataDir, eventId, role, position, source) {
  if (!source) {
    return { src: "", filename: "", mimeType: "", storage: "" };
  }
  if (externalMediaSource(source) || !dataUriParts(source)) {
    return { src: source, filename: "", mimeType: "", storage: "external" };
  }

  const parts = dataUriParts(source);
  const bytes = parts.isBase64 ? Buffer.from(parts.payload, "base64") : Buffer.from(decodeURIComponent(parts.payload), "utf8");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  const filename = `${safeFilePart(eventId)}-${safeFilePart(role)}-${String(position).padStart(3, "0")}-${hash}.${imageExtensionForSource(source)}`;
  const directory = path.join(dataDir, mediaDirName);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, filename), bytes);
  return {
    src: `/api/event-media/${encodeURIComponent(filename)}`,
    filename,
    mimeType: parts.mimeType,
    storage: "file",
  };
}

function extraWithout(record, fields) {
  const extra = { ...(record || {}) };
  fields.forEach((field) => delete extra[field]);
  return extra;
}

async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS scouts (
      id text PRIMARY KEY,
      name text NOT NULL DEFAULT '',
      first_name text NOT NULL DEFAULT '',
      last_name text NOT NULL DEFAULT '',
      nickname text NOT NULL DEFAULT '',
      gender text NOT NULL DEFAULT '',
      patrol text NOT NULL DEFAULT '',
      patrol_badge text NOT NULL DEFAULT '',
      rank text NOT NULL DEFAULT '',
      leadership_role text NOT NULL DEFAULT '',
      avatar text NOT NULL DEFAULT '',
      extra jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE TABLE IF NOT EXISTS adults (
      id text PRIMARY KEY,
      name text NOT NULL DEFAULT '',
      relationship text NOT NULL DEFAULT '',
      email text NOT NULL DEFAULT '',
      home_phone text NOT NULL DEFAULT '',
      cell_phone text NOT NULL DEFAULT '',
      extra jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE TABLE IF NOT EXISTS adult_leaders (
      adult_id text NOT NULL,
      role text NOT NULL DEFAULT '',
      extra jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (adult_id, role)
    );
    CREATE TABLE IF NOT EXISTS adult_scout_relationships (
      adult_id text NOT NULL,
      scout_id text NOT NULL,
      relationship text NOT NULL DEFAULT '',
      priority text NOT NULL DEFAULT '',
      extra jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (adult_id, scout_id, priority)
    );
    CREATE TABLE IF NOT EXISTS patrols (
      name text PRIMARY KEY,
      badge text NOT NULL DEFAULT '',
      extra jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE TABLE IF NOT EXISTS events (
      id text PRIMARY KEY,
      title text NOT NULL DEFAULT '',
      category text NOT NULL DEFAULT '',
      start_date text NOT NULL DEFAULT '',
      end_date text NOT NULL DEFAULT '',
      start_at timestamptz,
      end_at timestamptz,
      date_label text NOT NULL DEFAULT '',
      home_base text NOT NULL DEFAULT '',
      location text NOT NULL DEFAULT '',
      audience text NOT NULL DEFAULT '',
      description text NOT NULL DEFAULT '',
      detail_note text NOT NULL DEFAULT '',
      image_src text NOT NULL DEFAULT '',
      image_filename text NOT NULL DEFAULT '',
      image_mime_type text NOT NULL DEFAULT '',
      upcoming boolean,
      repeat_enabled boolean,
      repeat_frequency text,
      repeat_interval text,
      repeat_until text,
      repeat_monthly_pattern text,
      repeat_monthly_ordinal text,
      repeat_monthly_weekday text,
      extra jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS events_start_end_idx ON events (start_at, end_at);
    CREATE TABLE IF NOT EXISTS event_activities (
      event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      position integer NOT NULL,
      activity jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (event_id, position)
    );
    CREATE TABLE IF NOT EXISTS event_media (
      id text PRIMARY KEY,
      event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      role text NOT NULL,
      position integer NOT NULL DEFAULT 0,
      media_type text NOT NULL DEFAULT '',
      src text NOT NULL DEFAULT '',
      filename text NOT NULL DEFAULT '',
      mime_type text NOT NULL DEFAULT '',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS event_media_event_idx ON event_media (event_id, role, position);
    CREATE TABLE IF NOT EXISTS holidays (
      id text PRIMARY KEY,
      holiday_date date,
      name text NOT NULL DEFAULT '',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );
  `);
}

async function isEmpty() {
  const result = await getPool().query("SELECT NOT EXISTS (SELECT 1 FROM scouts LIMIT 1) AND NOT EXISTS (SELECT 1 FROM events LIMIT 1) AS empty");
  return Boolean(result.rows[0]?.empty);
}

async function replaceScouts(scouts) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM scouts");
    for (const scout of scouts) {
      await client.query(
        `INSERT INTO scouts (id, name, first_name, last_name, nickname, gender, patrol, patrol_badge, rank, leadership_role, avatar, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [scout.id, scout.name || "", scout.firstName || "", scout.lastName || "", scout.nickname || "", scout.gender || "", scout.patrol || "", scout.patrolBadge || "", scout.rank || "", scout.leadershipRole || "", scout.avatar || "", jsonb(extraWithout(scout, ["id", "name", "firstName", "lastName", "nickname", "gender", "patrol", "patrolBadge", "rank", "leadershipRole", "avatar"]))]
      );
    }
  });
}

async function replaceAdults(adults) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM adults");
    for (const adult of adults) {
      await client.query(
        `INSERT INTO adults (id, name, relationship, email, home_phone, cell_phone, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [adult.id, adult.name || "", adult.relationship || "", adult.email || "", adult.homePhone || "", adult.cellPhone || "", jsonb(extraWithout(adult, ["id", "name", "relationship", "email", "homePhone", "cellPhone"]))]
      );
    }
  });
}

async function replaceAdultLeaders(adultLeaders) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM adult_leaders");
    for (const leader of adultLeaders) {
      await client.query(
        "INSERT INTO adult_leaders (adult_id, role, extra) VALUES ($1,$2,$3)",
        [leader.adultId, leader.role || "", jsonb(extraWithout(leader, ["adultId", "role"]))]
      );
    }
  });
}

async function replaceAdultScoutRelationships(relationships) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM adult_scout_relationships");
    for (const relationship of relationships) {
      await client.query(
        "INSERT INTO adult_scout_relationships (adult_id, scout_id, relationship, priority, extra) VALUES ($1,$2,$3,$4,$5)",
        [relationship.adultId, relationship.scoutId, relationship.relationship || "", relationship.priority || "", jsonb(extraWithout(relationship, ["adultId", "scoutId", "relationship", "priority"]))]
      );
    }
  });
}

async function replacePatrols(patrols) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM patrols");
    for (const patrol of patrols) {
      await client.query(
        "INSERT INTO patrols (name, badge, extra) VALUES ($1,$2,$3)",
        [patrol.name || "", patrol.badge || "", jsonb(extraWithout(patrol, ["name", "badge"]))]
      );
    }
  });
}

async function replaceHolidays(holidays) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM holidays");
    for (const holiday of holidays) {
      await client.query(
        "INSERT INTO holidays (id, holiday_date, name, metadata) VALUES ($1,$2,$3,$4)",
        [
          holiday.id || "",
          holiday.date || null,
          holiday.name || "",
          jsonb(extraWithout(holiday, ["id", "date", "name"])),
        ]
      );
    }
  });
}

async function insertEvent(client, dataDir, event) {
  const eventId = String(event.id || "");
  const image = persistMediaSource(dataDir, eventId, "image", 0, event.image || "");
  await client.query(
    `INSERT INTO events (
      id, title, category, start_date, end_date, start_at, end_at, date_label, home_base, location, audience,
      description, detail_note, image_src, image_filename, image_mime_type, upcoming, repeat_enabled, repeat_frequency,
      repeat_interval, repeat_until, repeat_monthly_pattern, repeat_monthly_ordinal, repeat_monthly_weekday, extra
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
    [
      eventId,
      event.title || "",
      event.category || "",
      event.startDate || "",
      event.endDate || "",
      parseTimestamp(event.startDate),
      parseTimestamp(event.endDate || event.startDate, true),
      event.dateLabel || "",
      event.homeBase || "",
      event.location || "",
      event.audience || "",
      event.description || "",
      event.detailNote || "",
      image.src,
      image.filename,
      image.mimeType,
      typeof event.upcoming === "boolean" ? event.upcoming : null,
      typeof event.repeatEnabled === "boolean" ? event.repeatEnabled : null,
      event.repeatFrequency ?? null,
      event.repeatInterval ?? null,
      event.repeatUntil ?? null,
      event.repeatMonthlyPattern ?? null,
      event.repeatMonthlyOrdinal ?? null,
      event.repeatMonthlyWeekday ?? null,
      jsonb(extraWithout(event, ["id", "title", "category", "startDate", "endDate", "dateLabel", "homeBase", "location", "audience", "description", "detailNote", "image", "gallery", "activities", "upcoming", "repeatEnabled", "repeatFrequency", "repeatInterval", "repeatUntil", "repeatMonthlyPattern", "repeatMonthlyOrdinal", "repeatMonthlyWeekday"]))
    ]
  );
  if (image.src) {
    await client.query(
      "INSERT INTO event_media (id, event_id, role, position, media_type, src, filename, mime_type, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [`${eventId}:image:0`, eventId, "image", 0, "image", image.src, image.filename, image.mimeType, jsonb({ storage: image.storage })]
    );
  }
  for (const [index, activity] of (Array.isArray(event.activities) ? event.activities : []).entries()) {
    await client.query("INSERT INTO event_activities (event_id, position, activity) VALUES ($1,$2,$3)", [eventId, index, jsonb(activity)]);
  }
  for (const [index, item] of (Array.isArray(event.gallery) ? event.gallery : []).entries()) {
    const stored = persistMediaSource(dataDir, eventId, "gallery", index, item?.src || "");
    const metadata = { ...item, src: undefined, storage: stored.storage };
    delete metadata.src;
    await client.query(
      "INSERT INTO event_media (id, event_id, role, position, media_type, src, filename, mime_type, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [`${eventId}:gallery:${index}`, eventId, "gallery", index, item?.mediaType || "", stored.src, stored.filename, stored.mimeType, jsonb(metadata)]
    );
  }
}

async function replaceEvents(dataDir, events) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM events");
    for (const event of events) {
      await insertEvent(client, dataDir, event);
    }
  });
}

async function importData(dataDir, payload) {
  await replaceScouts(payload.scouts || []);
  await replaceAdults(payload.adults || []);
  await replaceAdultLeaders(payload.adultLeaders || []);
  await replaceAdultScoutRelationships(payload.adultScoutRelationships || []);
  await replacePatrols(payload.patrols || []);
  await replaceEvents(dataDir, payload.events || []);
  await replaceHolidays(payload.holidays || []);
}

function rowExtra(row) {
  return row.extra && typeof row.extra === "object" ? row.extra : {};
}

function eventFromRow(row, activities = [], media = [], includeMedia = true) {
  const event = {
    ...rowExtra(row),
    id: row.id,
    title: row.title,
    category: row.category,
    startDate: row.start_date,
    endDate: row.end_date,
    dateLabel: row.date_label,
    homeBase: row.home_base,
    location: row.location,
    audience: row.audience,
    description: row.description,
    detailNote: row.detail_note,
    activities,
    upcoming: row.upcoming,
    repeatEnabled: row.repeat_enabled,
    repeatFrequency: row.repeat_frequency,
    repeatInterval: row.repeat_interval,
    repeatUntil: row.repeat_until,
    repeatMonthlyPattern: row.repeat_monthly_pattern,
    repeatMonthlyOrdinal: row.repeat_monthly_ordinal,
    repeatMonthlyWeekday: row.repeat_monthly_weekday,
  };
  if (includeMedia) {
    event.image = row.image_src || "";
    event.gallery = media
      .filter((item) => item.role === "gallery")
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ ...(item.metadata || {}), mediaType: item.media_type, src: item.src }));
  }
  return Object.fromEntries(Object.entries(event).filter(([, value]) => value !== null && value !== undefined));
}

function eventListItemFromRow(row, activities = []) {
  return eventFromRow(row, activities, [], false);
}

async function getAllEvents(includeMedia = true) {
  const rows = (await getPool().query("SELECT * FROM events ORDER BY start_at NULLS LAST, id")).rows;
  if (!rows.length) return [];
  const eventIds = rows.map((row) => row.id);
  const activities = (await getPool().query("SELECT * FROM event_activities WHERE event_id = ANY($1) ORDER BY event_id, position", [eventIds])).rows;
  const media = includeMedia ? (await getPool().query("SELECT * FROM event_media WHERE event_id = ANY($1) ORDER BY event_id, role, position", [eventIds])).rows : [];
  return rows.map((row) => eventFromRow(
    row,
    activities.filter((activity) => activity.event_id === row.id).map((activity) => activity.activity),
    media.filter((item) => item.event_id === row.id),
    includeMedia
  ));
}

async function getDataPayload() {
  const [scouts, adults, adultLeaders, relationships, patrols, events, holidays] = await Promise.all([
    getPool().query("SELECT * FROM scouts ORDER BY id"),
    getPool().query("SELECT * FROM adults ORDER BY id"),
    getPool().query("SELECT * FROM adult_leaders ORDER BY adult_id, role"),
    getPool().query("SELECT * FROM adult_scout_relationships ORDER BY scout_id, priority, adult_id"),
    getPool().query("SELECT * FROM patrols ORDER BY name"),
    getAllEvents(true),
    getPool().query("SELECT * FROM holidays ORDER BY holiday_date NULLS LAST, id"),
  ]);
  return {
    scouts: scouts.rows.map((row) => ({ ...rowExtra(row), id: row.id, name: row.name, firstName: row.first_name, lastName: row.last_name, nickname: row.nickname, gender: row.gender, patrol: row.patrol, patrolBadge: row.patrol_badge, rank: row.rank, leadershipRole: row.leadership_role, avatar: row.avatar })),
    adults: adults.rows.map((row) => ({ ...rowExtra(row), id: row.id, name: row.name, relationship: row.relationship, email: row.email, homePhone: row.home_phone, cellPhone: row.cell_phone })),
    adultLeaders: adultLeaders.rows.map((row) => ({ ...rowExtra(row), adultId: row.adult_id, role: row.role })),
    adultScoutRelationships: relationships.rows.map((row) => ({ ...rowExtra(row), adultId: row.adult_id, scoutId: row.scout_id, relationship: row.relationship, priority: row.priority })),
    patrols: patrols.rows.map((row) => ({ ...rowExtra(row), name: row.name, badge: row.badge })),
    events,
    holidays: holidays.rows.map((row) => ({ ...(row.metadata || {}), id: row.id, date: row.holiday_date ? row.holiday_date.toISOString().slice(0, 10) : "", name: row.name })),
  };
}

async function getHolidays() {
  const result = await getPool().query("SELECT * FROM holidays ORDER BY holiday_date NULLS LAST, id");
  return result.rows.map((row) => ({
    ...(row.metadata || {}),
    id: row.id,
    date: row.holiday_date ? row.holiday_date.toISOString().slice(0, 10) : "",
    name: row.name,
  }));
}

async function getEvents({ startDate, endDate, page = 1, pageSize = 50 } = {}) {
  const rangeStart = parseTimestamp(startDate) || new Date(0);
  const rangeEnd = parseTimestamp(endDate, true) || new Date(8640000000000000);
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 50));
  const allRows = (await getPool().query("SELECT * FROM events ORDER BY start_at NULLS LAST, id")).rows;
  const filteredRows = allRows.filter((row) => eventOccursInRange(eventFromRow(row, [], [], false), rangeStart, rangeEnd));
  const offset = (safePage - 1) * safePageSize;
  const pageRows = filteredRows.slice(offset, offset + safePageSize);
  const eventIds = pageRows.map((row) => row.id);
  const activities = eventIds.length
    ? (await getPool().query("SELECT * FROM event_activities WHERE event_id = ANY($1) ORDER BY event_id, position", [eventIds])).rows
    : [];
  return {
    events: pageRows.map((row) => eventListItemFromRow(row, activities.filter((activity) => activity.event_id === row.id).map((activity) => activity.activity))),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: filteredRows.length,
      totalPages: Math.ceil(filteredRows.length / safePageSize),
    },
    range: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
  };
}

async function getEventById(eventId, { includeMedia = true } = {}) {
  const row = (await getPool().query("SELECT * FROM events WHERE id = $1", [eventId])).rows[0];
  if (!row) return null;
  const [activities, media] = await Promise.all([
    getPool().query("SELECT * FROM event_activities WHERE event_id = $1 ORDER BY position", [eventId]),
    includeMedia ? getPool().query("SELECT * FROM event_media WHERE event_id = $1 ORDER BY role, position", [eventId]) : Promise.resolve({ rows: [] }),
  ]);
  return eventFromRow(row, activities.rows.map((activity) => activity.activity), media.rows, includeMedia);
}

module.exports = {
  enabled,
  mediaDirName,
  ensureSchema,
  isEmpty,
  importData,
  getDataPayload,
  getHolidays,
  getEvents,
  getEventById,
  replaceScouts,
  replaceAdults,
  replaceAdultLeaders,
  replaceAdultScoutRelationships,
  replacePatrols,
  replaceHolidays,
  replaceEvents,
};
