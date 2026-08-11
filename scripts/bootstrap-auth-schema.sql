CREATE SCHEMA IF NOT EXISTS personai_auth;
REVOKE ALL ON SCHEMA personai_auth FROM PUBLIC, anon, authenticated;
GRANT USAGE, CREATE ON SCHEMA personai_auth TO postgres;

-- Run `bun run auth:migrate` after this bootstrap. Better Auth owns all tables
-- inside personai_auth; Alembic owns only PersonAI application tables in public.
