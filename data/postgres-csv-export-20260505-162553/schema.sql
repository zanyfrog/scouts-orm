--
-- PostgreSQL database dump
--

\restrict J5sDHL89eJI7GeamH8Pb9t3mPtmkz09nYtNDqiibqDC8UdYKczSGJGXPxNkTySK

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: adult_leaders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adult_leaders (
    adult_id text NOT NULL,
    role text DEFAULT ''::text NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: adult_scout_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adult_scout_relationships (
    adult_id text NOT NULL,
    scout_id text NOT NULL,
    relationship text DEFAULT ''::text NOT NULL,
    priority text DEFAULT ''::text NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: adults; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adults (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    relationship text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    home_phone text DEFAULT ''::text NOT NULL,
    cell_phone text DEFAULT ''::text NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: event_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_activities (
    event_id text NOT NULL,
    "position" integer NOT NULL,
    activity jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: event_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_media (
    id text NOT NULL,
    event_id text NOT NULL,
    role text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    media_type text DEFAULT ''::text NOT NULL,
    src text DEFAULT ''::text NOT NULL,
    filename text DEFAULT ''::text NOT NULL,
    mime_type text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    start_date text DEFAULT ''::text NOT NULL,
    end_date text DEFAULT ''::text NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    date_label text DEFAULT ''::text NOT NULL,
    home_base text DEFAULT ''::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    audience text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    detail_note text DEFAULT ''::text NOT NULL,
    image_src text DEFAULT ''::text NOT NULL,
    image_filename text DEFAULT ''::text NOT NULL,
    image_mime_type text DEFAULT ''::text NOT NULL,
    upcoming boolean,
    repeat_enabled boolean,
    repeat_frequency text,
    repeat_interval text,
    repeat_until text,
    repeat_monthly_pattern text,
    repeat_monthly_ordinal text,
    repeat_monthly_weekday text,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id text NOT NULL,
    holiday_date date,
    name text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: patrols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patrols (
    name text NOT NULL,
    badge text DEFAULT ''::text NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: scouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scouts (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    first_name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text NOT NULL,
    nickname text DEFAULT ''::text NOT NULL,
    gender text DEFAULT ''::text NOT NULL,
    patrol text DEFAULT ''::text NOT NULL,
    patrol_badge text DEFAULT ''::text NOT NULL,
    rank text DEFAULT ''::text NOT NULL,
    leadership_role text DEFAULT ''::text NOT NULL,
    avatar text DEFAULT ''::text NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: adult_leaders adult_leaders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_leaders
    ADD CONSTRAINT adult_leaders_pkey PRIMARY KEY (adult_id, role);


--
-- Name: adult_scout_relationships adult_scout_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_scout_relationships
    ADD CONSTRAINT adult_scout_relationships_pkey PRIMARY KEY (adult_id, scout_id, priority);


--
-- Name: adults adults_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adults
    ADD CONSTRAINT adults_pkey PRIMARY KEY (id);


--
-- Name: event_activities event_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_activities
    ADD CONSTRAINT event_activities_pkey PRIMARY KEY (event_id, "position");


--
-- Name: event_media event_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_media
    ADD CONSTRAINT event_media_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: patrols patrols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patrols
    ADD CONSTRAINT patrols_pkey PRIMARY KEY (name);


--
-- Name: scouts scouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scouts
    ADD CONSTRAINT scouts_pkey PRIMARY KEY (id);


--
-- Name: event_media_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_media_event_idx ON public.event_media USING btree (event_id, role, "position");


--
-- Name: events_start_end_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_start_end_idx ON public.events USING btree (start_at, end_at);


--
-- Name: event_activities event_activities_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_activities
    ADD CONSTRAINT event_activities_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_media event_media_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_media
    ADD CONSTRAINT event_media_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict J5sDHL89eJI7GeamH8Pb9t3mPtmkz09nYtNDqiibqDC8UdYKczSGJGXPxNkTySK

