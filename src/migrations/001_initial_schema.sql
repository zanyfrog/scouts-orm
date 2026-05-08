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
