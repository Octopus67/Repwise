# Phase 3.7: Multi-stage build — smaller runtime image
# Stage 1: Builder — install build deps and pip packages
FROM python:3.12-slim AS builder

WORKDIR /app

# Install system build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY src/ src/
COPY alembic.ini .

RUN pip install --no-cache-dir --prefix=/install .

# Stage 2: Runtime — lean image with only what's needed
FROM python:3.12-slim

WORKDIR /app

# Install only runtime system deps (libpq for psycopg2)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 && \
    rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code and alembic config
# Migrations live in src/database/migrations (copied with src/)
COPY --from=builder /app/src/ src/
COPY --from=builder /app/alembic.ini .

RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 8000

# Use Railway's PORT env var if set, otherwise default to 8000
# NOTE: --forwarded-allow-ips='*' is required for Railway's reverse proxy.
# For other deployments, restrict to the actual proxy IP range.
CMD gunicorn src.main:app -w ${WEB_CONCURRENCY:-1} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --forwarded-allow-ips='*' --timeout 120 --graceful-timeout 30 --keep-alive 5
