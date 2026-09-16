-- Auditoría de solo lectura. Confirmar proyecto/rama/base en Neon antes de ejecutar.
-- No devuelve contenido de documentos, claves ni contraseñas.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT current_database() AS database_name, current_user AS database_role,
       current_setting('server_version') AS postgres_version,
       current_setting('TimeZone') AS timezone;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.reltuples::bigint AS estimated_rows,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p') AND n.nspname = 'public'
ORDER BY c.relname;

SELECT table_name, column_name, data_type, udt_name, is_nullable,
       numeric_precision, numeric_scale
FROM information_schema.columns WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

SELECT c.conrelid::regclass::text AS table_name, c.conname, c.contype,
       c.convalidated, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' ORDER BY table_name, c.conname;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles WHERE rolname = current_user;

SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS has_migration_history;
COMMIT;
