-- TapReview pilot — database schema
-- Run this once against your Postgres database before first use:
--   psql "$DATABASE_URL" -f schema.sql
-- or paste it into the Supabase SQL editor.

create table if not exists events (
  id          bigserial   primary key,
  session_id  text        not null,
  name        text        not null,
  props       jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_session_idx on events (session_id);
create index if not exists events_name_idx    on events (name);


-- ─────────────────────────────────────────────────────────────
-- Analysis queries (reference — not run by the app)
-- ─────────────────────────────────────────────────────────────

-- Funnel: distinct sessions reaching each stage
-- select
--   count(distinct session_id) filter (where name = 'page_open')        as opened,
--   count(distinct session_id) filter (where name = 'rating_selected')  as rated,
--   count(distinct session_id) filter (where name = 'chips_selected')   as selected,
--   count(distinct session_id) filter (where name = 'review_generated') as generated,
--   count(distinct session_id) filter (where name = 'copy_and_open')    as copied,
--   count(distinct session_id) filter (where name = 'posted_tap')       as posted
-- from events;

-- Headline: post-completion rate (%)
-- select round(100.0 *
--   count(distinct session_id) filter (where name = 'posted_tap') /
--   nullif(count(distinct session_id) filter (where name = 'page_open'), 0), 1)
--   as post_completion_pct
-- from events;
