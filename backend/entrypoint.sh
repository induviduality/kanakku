#!/bin/sh
set -e

# Apply any pending database migrations, then run whatever command the
# container was started with (e.g. uvicorn for the API, arq for the worker).
# Using "$@" instead of a hardcoded command means the per-service `command:`
# in docker-compose is honored — so the API picks up --workers/--reload and
# the worker actually runs arq instead of a second uvicorn.
alembic upgrade head

exec "$@"
