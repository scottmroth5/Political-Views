#!/bin/sh
# Runs once, when the database volume is first created (docker-entrypoint-initdb.d).
# Creates the app's own login role, which owns the database and schema (so Prisma migrations work)
# but is not a superuser.
set -eu

psql -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE app LOGIN PASSWORD :'app_password';
ALTER DATABASE political_views OWNER TO app;
ALTER SCHEMA public OWNER TO app;
REVOKE ALL ON DATABASE political_views FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE political_views TO app;
SQL
