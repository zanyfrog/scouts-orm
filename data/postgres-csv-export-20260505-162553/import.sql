\set ON_ERROR_STOP on
BEGIN;
TRUNCATE TABLE public.event_activities, public.event_media, public.events, public.adult_leaders, public.adult_scout_relationships, public.adults, public.scouts, public.patrols, public.holidays RESTART IDENTITY CASCADE;
\copy public.scouts FROM 'csv/scouts.csv' WITH (FORMAT csv, HEADER true);
\copy public.adults FROM 'csv/adults.csv' WITH (FORMAT csv, HEADER true);
\copy public.adult_leaders FROM 'csv/adult_leaders.csv' WITH (FORMAT csv, HEADER true);
\copy public.adult_scout_relationships FROM 'csv/adult_scout_relationships.csv' WITH (FORMAT csv, HEADER true);
\copy public.patrols FROM 'csv/patrols.csv' WITH (FORMAT csv, HEADER true);
\copy public.events FROM 'csv/events.csv' WITH (FORMAT csv, HEADER true);
\copy public.event_activities FROM 'csv/event_activities.csv' WITH (FORMAT csv, HEADER true);
\copy public.event_media FROM 'csv/event_media.csv' WITH (FORMAT csv, HEADER true);
\copy public.holidays FROM 'csv/holidays.csv' WITH (FORMAT csv, HEADER true);
COMMIT;
