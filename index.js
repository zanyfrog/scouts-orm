const fs = require("fs");
const path = require("path");
const db = require("./db");

const root = __dirname;
const dataDir = path.join(root, "data");
const files = {
  scouts: path.join(dataDir, "scouts.csv"),
  adults: path.join(dataDir, "adults.csv"),
  adultLeaders: path.join(dataDir, "adult_leaders.csv"),
  adultScoutRelationships: path.join(dataDir, "adult_scout_relationships.csv"),
  patrols: path.join(dataDir, "patrols.json"),
  events: path.join(dataDir, "events.json"),
  holidays: path.join(dataDir, "holidays.json"),
  eventImageReferences: path.join(dataDir, "event-image-references.json"),
  eventsImport: path.join(dataDir, "events.tsv"),
};
const csvDatabaseDir = path.join(dataDir, "csv-database", "csv");
const csvDatabaseFiles = {
  scouts: path.join(csvDatabaseDir, "scouts.csv"),
  adults: path.join(csvDatabaseDir, "adults.csv"),
  adultLeaders: path.join(csvDatabaseDir, "adult_leaders.csv"),
  adultScoutRelationships: path.join(csvDatabaseDir, "adult_scout_relationships.csv"),
  patrols: path.join(csvDatabaseDir, "patrols.csv"),
  events: path.join(csvDatabaseDir, "events.csv"),
  eventActivities: path.join(csvDatabaseDir, "event_activities.csv"),
  eventMedia: path.join(csvDatabaseDir, "event_media.csv"),
  holidays: path.join(csvDatabaseDir, "holidays.csv"),
};

const legacyDefaultScoutAvatarUrl = "https://i.pinimg.com/474x/24/99/03/249903173ee16b3346ba320a24e56a8b.jpg";
const defaultScoutAvatarUrl = "assets/default-scout-avatar.svg";
const scoutHeaders = ["id", "name", "firstName", "lastName", "nickname", "gender", "patrol", "patrolBadge", "rank", "leadershipRole", "avatar"];
const adultHeaders = ["id", "name", "relationship", "email", "homePhone", "cellPhone"];
const adultLeaderHeaders = ["adultId", "role"];
const adultScoutRelationshipHeaders = ["adultId", "scoutId", "relationship", "priority"];
const csvDatabaseHeaders = {
  scouts: ["id", "name", "first_name", "last_name", "nickname", "gender", "patrol", "patrol_badge", "rank", "leadership_role", "avatar", "extra"],
  adults: ["id", "name", "relationship", "email", "home_phone", "cell_phone", "extra"],
  adultLeaders: ["adult_id", "role", "extra"],
  adultScoutRelationships: ["adult_id", "scout_id", "relationship", "priority", "extra"],
  patrols: ["name", "badge", "extra"],
  events: ["id", "title", "category", "start_date", "end_date", "start_at", "end_at", "date_label", "home_base", "location", "audience", "description", "detail_note", "image_src", "image_filename", "image_mime_type", "upcoming", "repeat_enabled", "repeat_frequency", "repeat_interval", "repeat_until", "repeat_monthly_pattern", "repeat_monthly_ordinal", "repeat_monthly_weekday", "extra"],
  eventActivities: ["event_id", "position", "activity"],
  eventMedia: ["id", "event_id", "role", "position", "media_type", "src", "filename", "mime_type", "metadata"],
  holidays: ["id", "holiday_date", "name", "metadata"],
};

function patrolBadgeKeyForPatrol(patrol) {
  return String(patrol || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitScoutName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function scoutFirstName(scout) {
  return String(scout?.firstName || "").trim() || splitScoutName(scout?.name).firstName;
}

function scoutLastName(scout) {
  return String(scout?.lastName || "").trim() || splitScoutName(scout?.name).lastName;
}

function scoutFullName(scout) {
  return [scoutFirstName(scout), scoutLastName(scout)].filter(Boolean).join(" ") || String(scout?.name || "").trim();
}

function defaultNicknameForName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

const defaultScouts = [
  ["scout-1", "Jake Boling", "not specified", "Python Patrol", patrolBadgeKeyForPatrol("Python Patrol"), "Scout", "Present", "Senior Patrol Leader", defaultScoutAvatarUrl],
  ["scout-2", "Henry Bukszar", "not specified", "Nuclear Meese", patrolBadgeKeyForPatrol("Nuclear Meese"), "Tenderfoot", "Present", "Assistant Senior Patrol Leader"],
  ["scout-3", "Judah Canterbury", "not specified", "Flaming Arrows", patrolBadgeKeyForPatrol("Flaming Arrows"), "Second Class", "Present", "Patrol Leader"],
  ["scout-4", "Corey Chapman", "not specified", "Senior", patrolBadgeKeyForPatrol("Senior"), "First Class", "Present", "Patrol Leader"],
  ["scout-5", "Noah Coelho", "not specified", "Python Patrol", patrolBadgeKeyForPatrol("Python Patrol"), "Star", "Present", "Patrol Leader"],
  ["scout-6", "Colin Erby", "not specified", "Nuclear Meese", patrolBadgeKeyForPatrol("Nuclear Meese"), "Scout", "Present", "Patrol Leader"],
  ["scout-7", "Neal Erby", "not specified", "Flaming Arrows", patrolBadgeKeyForPatrol("Flaming Arrows"), "Tenderfoot", "Absent", "Assistant Patrol Leader"],
  ["scout-8", "Bryce Flatley", "not specified", "Senior", patrolBadgeKeyForPatrol("Senior"), "Second Class", "Present", "Assistant Patrol Leader"],
  ["scout-9", "Austin Giganti", "not specified", "Python Patrol", patrolBadgeKeyForPatrol("Python Patrol"), "First Class", "Present", "Assistant Patrol Leader"],
  ["scout-10", "Lou Grepps", "not specified", "Nuclear Meese", patrolBadgeKeyForPatrol("Nuclear Meese"), "Star", "Present", "Assistant Patrol Leader"],
  ["scout-11", "Charlotte Harris", "not specified", "Flaming Arrows", patrolBadgeKeyForPatrol("Flaming Arrows"), "Scout", "Present", "Scribe"],
  ["scout-12", "Jaime Harris", "not specified", "Senior", patrolBadgeKeyForPatrol("Senior"), "Tenderfoot", "Absent", "Quartermaster"],
  ["scout-13", "Matthew Krok", "not specified", "Python Patrol", patrolBadgeKeyForPatrol("Python Patrol"), "Second Class", "Present", "Historian"],
  ["scout-14", "Rachel Krok", "not specified", "Nuclear Meese", patrolBadgeKeyForPatrol("Nuclear Meese"), "First Class", "Present", "Instructor"],
  ["scout-15", "Fortunate Omotoso", "not specified", "Flaming Arrows", patrolBadgeKeyForPatrol("Flaming Arrows"), "Star", "Present", "Librarian"],
  ["scout-16", "Bennett Patterson", "not specified", "Senior", patrolBadgeKeyForPatrol("Senior"), "Scout", "Present", "Chaplain Aide"],
  ["scout-17", "Gabe Queen", "not specified", "Python Patrol", patrolBadgeKeyForPatrol("Python Patrol"), "Tenderfoot", "Present", "Webmaster"],
  ["scout-18", "Angad Sarin", "not specified", "Nuclear Meese", patrolBadgeKeyForPatrol("Nuclear Meese"), "Second Class", "Absent", "Troop Guide"],
  ["scout-19", "Bobby Seitz", "not specified", "Flaming Arrows", patrolBadgeKeyForPatrol("Flaming Arrows"), "First Class", "Present", ""],
  ["scout-20", "Will Seitz", "not specified", "Senior", patrolBadgeKeyForPatrol("Senior"), "Star", "Present", ""],
  ["scout-21", "Zachary Treaster", "not specified", "Python Patrol", patrolBadgeKeyForPatrol("Python Patrol"), "Scout", "Present", ""],
  ["scout-22", "Matthew Yosephine", "not specified", "Nuclear Meese", patrolBadgeKeyForPatrol("Nuclear Meese"), "Tenderfoot", "Present", ""],
];

const defaultAdults = [
  ["adult-1", "Kelly Harris", "Adult leader", "kelly.harris@example.com"],
  ["adult-2", "Matt Krok", "Adult leader", "matt.krok@example.com"],
  ["adult-3", "Cristin Treaster", "Adult leader", "cristin.treaster@example.com"],
  ["adult-4", "Guardian Boling", "Guardian", "jake.boling1@example.com"],
  ["adult-5", "Boling Family Contact", "Guardian", "jake.boling2@example.com"],
  ["adult-6", "Parent Bukszar", "Parent", "henry.bukszar1@example.com"],
  ["adult-7", "Bukszar Family Contact", "Parent", "henry.bukszar2@example.com"],
  ["adult-8", "Parent Canterbury", "Parent", "judah.canterbury1@example.com"],
  ["adult-9", "Canterbury Family Contact", "Parent", "judah.canterbury2@example.com"],
  ["adult-10", "Guardian Chapman", "Guardian", "corey.chapman1@example.com"],
  ["adult-11", "Chapman Family Contact", "Parent", "corey.chapman2@example.com"],
  ["adult-12", "Parent Coelho", "Parent", "noah.coelho1@example.com"],
  ["adult-13", "Coelho Family Contact", "Guardian", "noah.coelho2@example.com"],
  ["adult-14", "Parent Erby", "Parent", "colin.erby1@example.com"],
  ["adult-15", "Erby Family Contact", "Parent", "colin.erby2@example.com"],
  ["adult-16", "Guardian Erby", "Guardian", "neal.erby1@example.com"],
  ["adult-17", "Guardian Grepps", "Guardian", "lou.grepps1@example.com"],
  ["adult-18", "Grepps Family Contact", "Parent", "lou.grepps2@example.com"],
  ["adult-19", "Parent Harris", "Parent", "charlotte.harris1@example.com"],
  ["adult-20", "Harris Family Contact", "Parent", "charlotte.harris2@example.com"],
  ["adult-21", "Guardian Krok", "Guardian", "matthew.krok1@example.com"],
  ["adult-22", "Krok Family Contact", "Guardian", "matthew.krok2@example.com"],
  ["adult-23", "Parent Treaster", "Parent", "zachary.treaster1@example.com"],
  ["adult-24", "Treaster Family Contact", "Guardian", "zachary.treaster2@example.com"],
];

const defaultAdultLeaders = [
  ["adult-1", "Scoutmaster"],
  ["adult-2", "Committee Chair"],
  ["adult-3", "Assistant Scoutmaster"],
];

function buildAdultScoutRelationshipsFromRows(adultsRows, scoutsRows) {
  const adultsByName = new Map(adultsRows.map((adult) => [adult.name, adult.id]));
  const relationships = [];

  scoutsRows.forEach((scout) => {
    [
      { adultName: scout.parent1Name, relationship: scout.parent1Relationship, priority: "1" },
      { adultName: scout.parent2Name, relationship: scout.parent2Relationship, priority: "2" },
    ]
      .filter((entry) => entry.adultName)
      .forEach((entry) => {
        const adultId = adultsByName.get(entry.adultName);
        if (adultId) {
          relationships.push([adultId, scout.id, entry.relationship || "Parent", entry.priority]);
        }
      });
  });

  return relationships;
}

function buildPatrolsFromScoutRows(scoutRows) {
  const seen = new Set();
  return scoutRows
    .map((scout) => {
      const name = String(scout.patrol || "").trim();
      if (!name) {
        return null;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        return null;
      }
      seen.add(key);
      return {
        name,
        badge: scout.patrolBadge || patrolBadgeKeyForPatrol(name),
      };
    })
    .filter(Boolean);
}

function escapeCsv(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return [];
  }

  const lines = raw.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function writeCsv(filePath, headers, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((_, index) => escapeCsv(row[index] ?? "")).join(",")),
  ].join("\n");

  fs.writeFileSync(filePath, `${content}\n`, "utf8");
}

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvDatabaseEnabled() {
  return Object.values(csvDatabaseFiles).every((filePath) => fs.existsSync(filePath));
}

function parseJsonField(value, fallback = {}) {
  const source = String(value ?? "").trim();
  if (!source) {
    return fallback;
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    return fallback;
  }
}

function rowExtra(row, field = "extra") {
  const extra = parseJsonField(row?.[field], {});
  return extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {};
}

function booleanFromCsv(value) {
  if (value === true || value === false) {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["t", "true", "1", "yes"].includes(normalized)) return true;
  if (["f", "false", "0", "no"].includes(normalized)) return false;
  return null;
}

function booleanToCsv(value) {
  if (value === true) return "t";
  if (value === false) return "f";
  return "";
}

function jsonCsv(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

function withoutFields(record, fields) {
  const extra = { ...(record || {}) };
  fields.forEach((field) => delete extra[field]);
  return extra;
}

function compactRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null && value !== undefined));
}

function csvEventFromRow(row, activities = [], media = [], includeMedia = true) {
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
    upcoming: booleanFromCsv(row.upcoming),
    repeatEnabled: booleanFromCsv(row.repeat_enabled),
    repeatFrequency: row.repeat_frequency || null,
    repeatInterval: row.repeat_interval || null,
    repeatUntil: row.repeat_until || null,
    repeatMonthlyPattern: row.repeat_monthly_pattern || null,
    repeatMonthlyOrdinal: row.repeat_monthly_ordinal || null,
    repeatMonthlyWeekday: row.repeat_monthly_weekday || null,
  };

  if (includeMedia) {
    event.image = row.image_src || "";
    event.gallery = media
      .filter((item) => item.role === "gallery")
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      .map((item) => ({
        ...rowExtra(item, "metadata"),
        mediaType: item.media_type,
        src: item.src,
      }));
  }

  return compactRecord(event);
}

function getCsvDatabasePayload() {
  const eventActivityRows = readCsv(csvDatabaseFiles.eventActivities);
  const eventMediaRows = readCsv(csvDatabaseFiles.eventMedia);
  const activityMap = new Map();
  const mediaMap = new Map();

  eventActivityRows.forEach((row) => {
    const eventId = row.event_id;
    if (!activityMap.has(eventId)) {
      activityMap.set(eventId, []);
    }
    activityMap.get(eventId).push({
      position: Number(row.position || 0),
      activity: parseJsonField(row.activity, {}),
    });
  });

  eventMediaRows.forEach((row) => {
    const eventId = row.event_id;
    if (!mediaMap.has(eventId)) {
      mediaMap.set(eventId, []);
    }
    mediaMap.get(eventId).push(row);
  });

  return {
    scouts: readCsv(csvDatabaseFiles.scouts).map((row) => ({
      ...rowExtra(row),
      id: row.id,
      name: row.name,
      firstName: row.first_name,
      lastName: row.last_name,
      nickname: row.nickname,
      gender: row.gender,
      patrol: row.patrol,
      patrolBadge: row.patrol_badge,
      rank: row.rank,
      leadershipRole: row.leadership_role,
      avatar: row.avatar,
    })),
    adults: readCsv(csvDatabaseFiles.adults).map((row) => ({
      ...rowExtra(row),
      id: row.id,
      name: row.name,
      relationship: row.relationship,
      email: row.email,
      homePhone: row.home_phone,
      cellPhone: row.cell_phone,
    })),
    adultLeaders: readCsv(csvDatabaseFiles.adultLeaders).map((row) => ({ ...rowExtra(row), adultId: row.adult_id, role: row.role })),
    adultScoutRelationships: readCsv(csvDatabaseFiles.adultScoutRelationships).map((row) => ({
      ...rowExtra(row),
      adultId: row.adult_id,
      scoutId: row.scout_id,
      relationship: row.relationship,
      priority: row.priority,
    })),
    patrols: readCsv(csvDatabaseFiles.patrols).map((row) => ({ ...rowExtra(row), name: row.name, badge: row.badge })),
    events: readCsv(csvDatabaseFiles.events).map((row) => csvEventFromRow(
      row,
      (activityMap.get(row.id) || []).sort((a, b) => a.position - b.position).map((item) => item.activity),
      mediaMap.get(row.id) || [],
      true
    )),
    holidays: readCsv(csvDatabaseFiles.holidays).map((row) => ({
      ...rowExtra(row, "metadata"),
      id: row.id,
      date: row.holiday_date,
      name: row.name,
    })).map(normalizeHoliday).filter((holiday) => holiday.id && holiday.date),
  };
}

function saveCsvDatabaseScouts(scouts) {
  writeCsv(csvDatabaseFiles.scouts, csvDatabaseHeaders.scouts, scouts.map((scout) => [
    scout.id,
    scout.name,
    scout.firstName,
    scout.lastName,
    scout.nickname,
    scout.gender,
    scout.patrol,
    scout.patrolBadge,
    scout.rank,
    scout.leadershipRole,
    scout.avatar,
    jsonCsv(withoutFields(scout, ["id", "name", "firstName", "lastName", "nickname", "gender", "patrol", "patrolBadge", "rank", "leadershipRole", "avatar"])),
  ]));
}

function saveCsvDatabaseAdults(adults) {
  writeCsv(csvDatabaseFiles.adults, csvDatabaseHeaders.adults, adults.map((adult) => [
    adult.id,
    adult.name,
    adult.relationship,
    adult.email,
    adult.homePhone || "",
    adult.cellPhone || "",
    jsonCsv(withoutFields(adult, ["id", "name", "relationship", "email", "homePhone", "cellPhone"])),
  ]));
}

function saveCsvDatabaseAdultLeaders(adultLeaders) {
  writeCsv(csvDatabaseFiles.adultLeaders, csvDatabaseHeaders.adultLeaders, adultLeaders.map((adultLeader) => [
    adultLeader.adultId,
    adultLeader.role,
    jsonCsv(withoutFields(adultLeader, ["adultId", "role"])),
  ]));
}

function saveCsvDatabaseAdultScoutRelationships(adultScoutRelationships) {
  writeCsv(csvDatabaseFiles.adultScoutRelationships, csvDatabaseHeaders.adultScoutRelationships, adultScoutRelationships.map((relationship) => [
    relationship.adultId,
    relationship.scoutId,
    relationship.relationship,
    relationship.priority,
    jsonCsv(withoutFields(relationship, ["adultId", "scoutId", "relationship", "priority"])),
  ]));
}

function saveCsvDatabasePatrols(patrols) {
  writeCsv(csvDatabaseFiles.patrols, csvDatabaseHeaders.patrols, patrols.map((patrol) => [
    patrol.name,
    patrol.badge,
    jsonCsv(withoutFields(patrol, ["name", "badge"])),
  ]));
}

function saveCsvDatabaseHolidays(holidays) {
  writeCsv(csvDatabaseFiles.holidays, csvDatabaseHeaders.holidays, holidays.map((holiday) => [
    holiday.id,
    holiday.date,
    holiday.name,
    jsonCsv(withoutFields(holiday, ["id", "date", "name"])),
  ]));
}

function saveCsvDatabaseEvents(events) {
  const eventRows = [];
  const activityRows = [];
  const mediaRows = [];

  (Array.isArray(events) ? events : []).forEach((event) => {
    const eventId = String(event.id || "");
    eventRows.push([
      eventId,
      event.title || "",
      event.category || "",
      event.startDate || "",
      event.endDate || "",
      event.startDate || "",
      event.endDate || event.startDate || "",
      event.dateLabel || "",
      event.homeBase || "",
      event.location || "",
      event.audience || "",
      event.description || "",
      event.detailNote || "",
      event.image || "",
      "",
      "",
      booleanToCsv(event.upcoming),
      booleanToCsv(event.repeatEnabled),
      event.repeatFrequency ?? "",
      event.repeatInterval ?? "",
      event.repeatUntil ?? "",
      event.repeatMonthlyPattern ?? "",
      event.repeatMonthlyOrdinal ?? "",
      event.repeatMonthlyWeekday ?? "",
      jsonCsv(withoutFields(event, ["id", "title", "category", "startDate", "endDate", "dateLabel", "homeBase", "location", "audience", "description", "detailNote", "image", "gallery", "activities", "upcoming", "repeatEnabled", "repeatFrequency", "repeatInterval", "repeatUntil", "repeatMonthlyPattern", "repeatMonthlyOrdinal", "repeatMonthlyWeekday"])),
    ]);

    if (event.image) {
      mediaRows.push([
        `${eventId}:image:0`,
        eventId,
        "image",
        0,
        "image",
        event.image,
        "",
        "",
        jsonCsv({ storage: externalMediaSource(event.image) || !dataUriParts(event.image) ? "external" : "" }),
      ]);
    }

    (Array.isArray(event.activities) ? event.activities : []).forEach((activity, index) => {
      activityRows.push([eventId, index, jsonCsv(activity)]);
    });

    (Array.isArray(event.gallery) ? event.gallery : []).forEach((item, index) => {
      mediaRows.push([
        `${eventId}:gallery:${index}`,
        eventId,
        "gallery",
        index,
        item?.mediaType || "",
        item?.src || "",
        "",
        "",
        jsonCsv(withoutFields({ ...(item || {}), storage: externalMediaSource(item?.src) || !dataUriParts(item?.src) ? "external" : "" }, ["src"])),
      ]);
    });
  });

  writeCsv(csvDatabaseFiles.events, csvDatabaseHeaders.events, eventRows);
  writeCsv(csvDatabaseFiles.eventActivities, csvDatabaseHeaders.eventActivities, activityRows);
  writeCsv(csvDatabaseFiles.eventMedia, csvDatabaseHeaders.eventMedia, mediaRows);
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

function isImageSource(value) {
  return typeof value === "string" && (/^data:image\//i.test(value) || /^https?:\/\//i.test(value));
}

function externalMediaSource(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function dataUriParts(value) {
  return String(value || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
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
    const ext = path.extname(url.pathname || "").toLowerCase().replace(/^\./, "");
    return ext || "img";
  } catch (error) {
    return "img";
  }
}

function nextEventImageFilename(source, valueToFilename, usedFilenames) {
  const existingFilename = valueToFilename.get(source);
  if (existingFilename) {
    return existingFilename;
  }

  const extension = imageExtensionForSource(source);
  let index = valueToFilename.size + 1;

  while (true) {
    const filename = `event-image-${String(index).padStart(4, "0")}.${extension}`;
    if (!usedFilenames.has(filename)) {
      return filename;
    }
    index += 1;
  }
}

function cloneGalleryItem(item) {
  return {
    ...item,
    comments: Array.isArray(item?.comments) ? item.comments.map((comment) => ({ ...comment })) : [],
    reactions: item?.reactions && typeof item.reactions === "object"
      ? Object.fromEntries(
        Object.entries(item.reactions).map(([key, value]) => [key, Array.isArray(value) ? [...value] : []])
      )
      : item?.reactions,
  };
}

function buildEventImageReferences(events, existingImageReferences = {}) {
  const references = existingImageReferences && typeof existingImageReferences === "object" ? { ...existingImageReferences } : {};
  const valueToFilename = new Map(Object.entries(references).map(([filename, value]) => [value, filename]));
  const usedFilenames = new Set(Object.keys(references));
  let changed = false;

  (Array.isArray(events) ? events : []).forEach((event) => {
    const gallery = Array.isArray(event?.gallery) ? event.gallery.map((item) => cloneGalleryItem(item)) : [];

    if (isImageSource(event?.image)) {
      const filename = nextEventImageFilename(event.image, valueToFilename, usedFilenames);
      references[filename] = event.image;
      valueToFilename.set(event.image, filename);
      usedFilenames.add(filename);
      if (existingImageReferences[filename] !== event.image) {
        changed = true;
      }
    }

    gallery.forEach((item) => {
      if (item.mediaType !== "image" || !isImageSource(item.src)) {
        return;
      }
      const filename = nextEventImageFilename(item.src, valueToFilename, usedFilenames);
      references[filename] = item.src;
      valueToFilename.set(item.src, filename);
      usedFilenames.add(filename);
      if (existingImageReferences[filename] !== item.src) {
        changed = true;
      }
    });
  });

  return {
    imageReferences: references,
    changed,
  };
}

function parseDelimitedLine(line, delimiter = "\t") {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function readTsv(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  if (!raw) {
    return [];
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) {
    return [];
  }

  const headers = parseDelimitedLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function slugifyEventTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseImportedDate(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = 2000 + Number(match[3]);
  let hours = Number(match[4] || 0);
  const minutes = Number(match[5] || 0);
  const meridiem = String(match[6] || "").toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return { year, month, day, hours, minutes, hasTime: Boolean(match[4]) };
}

function formatImportedDateLabel(start, end) {
  if (!start) {
    return "";
  }

  const startDate = new Date(start.year, start.month - 1, start.day, start.hours, start.minutes);
  const endDate = end ? new Date(end.year, end.month - 1, end.day, end.hours, end.minutes) : null;
  const sameDay = endDate
    && start.year === end.year
    && start.month === end.month
    && start.day === end.day;
  const dateOptions = { month: "short", day: "numeric", year: "numeric" };
  const timeOptions = { hour: "numeric", minute: "2-digit" };
  const startDateText = startDate.toLocaleDateString("en-US", dateOptions);

  if (!endDate) {
    return start.hasTime
      ? `${startDateText}, ${startDate.toLocaleTimeString("en-US", timeOptions)}`
      : startDateText;
  }

  if (sameDay) {
    if (start.hasTime || end.hasTime) {
      return `${startDateText}, ${startDate.toLocaleTimeString("en-US", timeOptions)}-${endDate.toLocaleTimeString("en-US", timeOptions)}`;
    }
    return startDateText;
  }

  const endDateText = endDate.toLocaleDateString("en-US", dateOptions);
  return `${startDateText} - ${endDateText}`;
}

function importedDateToIso(value) {
  if (!value) {
    return "";
  }

  const base = `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
  if (!value.hasTime) {
    return base;
  }

  return `${base}T${String(value.hours).padStart(2, "0")}:${String(value.minutes).padStart(2, "0")}:00`;
}

function buildImportedEvents() {
  const rows = readTsv(files.eventsImport);
  const seen = new Set();
  const imported = [];

  rows.forEach((row, index) => {
    const level = String(row.Level || "").trim();
    const type = String(row.Type || "").trim();
    const title = String(row.Title || "").trim();
    const startRaw = String(row["Start Date"] || "").trim();
    const endRaw = String(row["End Date"] || "").trim();
    const location = String(row.Location || "").trim();
    if (!title || !startRaw) {
      return;
    }

    const dedupeKey = [level, type, title, startRaw, endRaw, location].join("|");
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    const start = parseImportedDate(startRaw);
    const end = parseImportedDate(endRaw || startRaw);
    const startDate = importedDateToIso(start);
    const endDate = importedDateToIso(end);
    const category = type || "Event";
    const audience = level || "Unit";
    const prefix = audience && audience !== category ? `${audience} ${category}` : audience || category;

    imported.push({
      id: `${slugifyEventTitle(title) || "event"}-${index + 1}`,
      title,
      category,
      startDate,
      endDate,
      dateLabel: formatImportedDateLabel(start, end),
      location,
      audience,
      description: prefix ? `${prefix} event scheduled for ${location || "TBD"}.` : `Event scheduled for ${location || "TBD"}.`,
      detailNote: "Imported from the historical troop event list.",
      image: "",
      gallery: [],
      upcoming: Boolean(startDate) && new Date(startDate).getTime() >= new Date("2026-04-19T00:00:00-04:00").getTime(),
    });
  });

  return imported.sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
    return aTime - bTime;
  });
}

function ensureFileDataFiles() {
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(files.scouts)) {
    writeCsv(
      files.scouts,
      scoutHeaders,
      defaultScouts.map((scout) => [
        scout[0],
        scout[1],
        splitScoutName(scout[1]).firstName,
        splitScoutName(scout[1]).lastName,
        defaultNicknameForName(scout[1]),
        scout[2],
        scout[3],
        scout[4],
        scout[5],
        scout[7],
        scout[8] || defaultScoutAvatarUrl,
      ])
    );
  } else {
    const scoutRows = readCsv(files.scouts);
    writeCsv(
      files.scouts,
      scoutHeaders,
      scoutRows.map((scout) => [
        scout.id,
        scoutFullName(scout),
        scoutFirstName(scout),
        scoutLastName(scout),
        scout.nickname || defaultNicknameForName(scoutFullName(scout)),
        scout.gender || "not specified",
        scout.patrol || "Python Patrol",
        scout.patrolBadge || patrolBadgeKeyForPatrol(scout.patrol || "Python Patrol"),
        scout.rank || "Scout",
        scout.leadershipRole || "",
        scout.avatar && scout.avatar !== legacyDefaultScoutAvatarUrl ? scout.avatar : defaultScoutAvatarUrl,
      ])
    );
  }

  if (!fs.existsSync(files.adults)) {
    writeCsv(files.adults, adultHeaders, defaultAdults);
  }

  if (!fs.existsSync(files.adultLeaders)) {
    writeCsv(files.adultLeaders, adultLeaderHeaders, defaultAdultLeaders);
  } else {
    const adultLeaderRows = readCsv(files.adultLeaders);
    writeCsv(
      files.adultLeaders,
      adultLeaderHeaders,
      adultLeaderRows.map((adultLeader) => [adultLeader.adultId, adultLeader.role])
    );
  }

  if (!fs.existsSync(files.adultScoutRelationships)) {
    const adultsRows = readCsv(files.adults);
    const scoutsRows = readCsv(files.scouts);
    writeCsv(
      files.adultScoutRelationships,
      adultScoutRelationshipHeaders,
      buildAdultScoutRelationshipsFromRows(adultsRows, scoutsRows)
    );
  }

  if (!fs.existsSync(files.patrols)) {
    const scoutRows = readCsv(files.scouts);
    writeJson(files.patrols, buildPatrolsFromScoutRows(scoutRows));
  }

  if (!fs.existsSync(files.events)) {
    writeJson(files.events, buildImportedEvents());
  }

  if (!fs.existsSync(files.holidays)) {
    writeJson(files.holidays, []);
  }

  const storedEvents = readJson(files.events, []);
  const storedEventImageReferences = readJson(files.eventImageReferences, {});
  const eventImageReferences = buildEventImageReferences(storedEvents, storedEventImageReferences);
  if (eventImageReferences.changed || !fs.existsSync(files.eventImageReferences)) {
    writeJson(files.eventImageReferences, eventImageReferences.imageReferences);
  }
}

async function ensureDataFiles() {
  ensureFileDataFiles();
  if (!db.enabled()) {
    return;
  }
  await db.ensureSchema();
  if (await db.isEmpty()) {
    await db.importData(dataDir, getFileDataPayload());
  }
}

function getFileDataPayload() {
  if (csvDatabaseEnabled()) {
    return getCsvDatabasePayload();
  }

  return {
    scouts: readCsv(files.scouts),
    adults: readCsv(files.adults),
    adultLeaders: readCsv(files.adultLeaders),
    adultScoutRelationships: readCsv(files.adultScoutRelationships),
    patrols: readJson(files.patrols, []),
    events: readJson(files.events, []),
    holidays: readJson(files.holidays, []).map(normalizeHoliday).filter((holiday) => holiday.id && holiday.date),
  };
}

function getDataPayload() {
  return db.enabled() ? db.getDataPayload() : getFileDataPayload();
}

function parseEventBoundary(value, endOfDay = false) {
  const source = String(value || "").trim();
  if (!source) {
    return null;
  }

  const dateOnlyMatch = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
    : new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eventStartTime(event) {
  return parseEventBoundary(event?.startDate)?.getTime() || 0;
}

function eventEndTime(event) {
  const end = parseEventBoundary(event?.endDate || event?.startDate, true);
  return end?.getTime() || eventStartTime(event);
}

function eventOccursInRange(event, rangeStart, rangeEnd) {
  const startTime = eventStartTime(event);
  const endTime = eventEndTime(event);
  if (!startTime || !endTime) {
    return false;
  }

  if (startTime <= rangeEnd.getTime() && endTime >= rangeStart.getTime()) {
    return true;
  }

  if (!event?.repeatEnabled) {
    return false;
  }

  const repeatUntil = event.repeatUntil ? parseEventBoundary(event.repeatUntil, true) : null;
  if (startTime > rangeEnd.getTime()) {
    return false;
  }
  return !repeatUntil || repeatUntil.getTime() >= rangeStart.getTime();
}

function eventListItem(event) {
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

function getEvents({ startDate, endDate, page = 1, pageSize = 50, includeMedia = false } = {}) {
  if (db.enabled()) {
    return db.getEvents({ startDate, endDate, page, pageSize, includeMedia });
  }
  const allEvents = csvDatabaseEnabled() ? getCsvDatabasePayload().events : readJson(files.events, []);
  const rangeStart = parseEventBoundary(startDate) || new Date(0);
  const rangeEnd = parseEventBoundary(endDate, true) || new Date(8640000000000000);
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 50));

  const filteredEvents = allEvents
    .filter((event) => eventOccursInRange(event, rangeStart, rangeEnd))
    .sort((a, b) => eventStartTime(a) - eventStartTime(b));
  const offset = (safePage - 1) * safePageSize;

  return {
    events: filteredEvents.slice(offset, offset + safePageSize).map((event) => includeMedia ? event : eventListItem(event)),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: filteredEvents.length,
      totalPages: Math.ceil(filteredEvents.length / safePageSize),
    },
    range: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
  };
}

function getEventById(eventId, { includeMedia = true } = {}) {
  if (db.enabled()) {
    return db.getEventById(eventId, { includeMedia });
  }
  const event = (csvDatabaseEnabled() ? getCsvDatabasePayload().events : readJson(files.events, [])).find((item) => String(item.id) === String(eventId));
  if (!event) {
    return null;
  }
  return includeMedia ? event : eventListItem(event);
}

function saveScouts(scouts) {
  const normalizedScouts = scouts.map((scout) => ({
    id: scout.id,
    name: scoutFullName(scout),
    firstName: scoutFirstName(scout),
    lastName: scoutLastName(scout),
    nickname: scout.nickname || defaultNicknameForName(scoutFullName(scout)),
    gender: scout.gender,
    patrol: scout.patrol,
    patrolBadge: scout.patrolBadge,
    rank: scout.rank,
    leadershipRole: scout.leadershipRole,
    avatar: scout.avatar && scout.avatar !== legacyDefaultScoutAvatarUrl ? scout.avatar : defaultScoutAvatarUrl,
  }));
  if (db.enabled()) {
    return db.replaceScouts(normalizedScouts);
  }
  if (csvDatabaseEnabled()) {
    return saveCsvDatabaseScouts(normalizedScouts);
  }
  writeCsv(
    files.scouts,
    scoutHeaders,
    normalizedScouts.map((scout) => [
      scout.id,
      scout.name,
      scout.firstName,
      scout.lastName,
      scout.nickname,
      scout.gender,
      scout.patrol,
      scout.patrolBadge,
      scout.rank,
      scout.leadershipRole,
      scout.avatar,
    ])
  );
}

function saveAdults(adults) {
  if (db.enabled()) {
    return db.replaceAdults(adults);
  }
  if (csvDatabaseEnabled()) {
    return saveCsvDatabaseAdults(adults);
  }
  writeCsv(
    files.adults,
    adultHeaders,
    adults.map((adult) => [adult.id, adult.name, adult.relationship, adult.email, adult.homePhone || "", adult.cellPhone || ""])
  );
}

function saveAdultLeaders(adultLeaders) {
  if (db.enabled()) {
    return db.replaceAdultLeaders(adultLeaders);
  }
  if (csvDatabaseEnabled()) {
    return saveCsvDatabaseAdultLeaders(adultLeaders);
  }
  writeCsv(
    files.adultLeaders,
    adultLeaderHeaders,
    adultLeaders.map((adultLeader) => [adultLeader.adultId, adultLeader.role])
  );
}

function saveAdultScoutRelationships(adultScoutRelationships) {
  if (db.enabled()) {
    return db.replaceAdultScoutRelationships(adultScoutRelationships);
  }
  if (csvDatabaseEnabled()) {
    return saveCsvDatabaseAdultScoutRelationships(adultScoutRelationships);
  }
  writeCsv(
    files.adultScoutRelationships,
    adultScoutRelationshipHeaders,
    adultScoutRelationships.map((relationship) => [
      relationship.adultId,
      relationship.scoutId,
      relationship.relationship,
      relationship.priority,
    ])
  );
}

function savePatrols(patrols) {
  if (db.enabled()) {
    return db.replacePatrols(patrols);
  }
  if (csvDatabaseEnabled()) {
    return saveCsvDatabasePatrols(patrols);
  }
  writeJson(
    files.patrols,
    patrols.map((patrol) => ({
      name: patrol.name,
      badge: patrol.badge,
    }))
  );
}

function getHolidays() {
  if (db.enabled()) {
    return db.getHolidays();
  }
  if (csvDatabaseEnabled()) {
    return getCsvDatabasePayload().holidays;
  }
  return readJson(files.holidays, []).map(normalizeHoliday).filter((holiday) => holiday.id && holiday.date);
}

function saveHolidays(holidays) {
  const normalized = (Array.isArray(holidays) ? holidays : []).map(normalizeHoliday).filter((holiday) => holiday.id && holiday.date);
  if (db.enabled()) {
    return db.replaceHolidays(normalized);
  }
  if (csvDatabaseEnabled()) {
    return saveCsvDatabaseHolidays(normalized);
  }
  writeJson(files.holidays, normalized);
}

function saveEvents(events) {
  if (db.enabled()) {
    return db.replaceEvents(dataDir, events);
  }
  if (csvDatabaseEnabled()) {
    return saveCsvDatabaseEvents(events);
  }
  writeJson(files.events, events);

  const eventImageReferences = buildEventImageReferences(events, readJson(files.eventImageReferences, {}));
  writeJson(files.eventImageReferences, eventImageReferences.imageReferences);
}

module.exports = {
  dataDir,
  ensureDataFiles,
  ensureFileDataFiles,
  getDataPayload,
  getHolidays,
  getEventById,
  getEvents,
  saveScouts,
  saveAdults,
  saveAdultLeaders,
  saveAdultScoutRelationships,
  savePatrols,
  saveHolidays,
  saveEvents,
};
