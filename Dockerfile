FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy project files and install dependencies
COPY pyproject.toml .
COPY src/ src/
COPY data/ data/
COPY alembic.ini .

RUN pip install --no-cache-dir .

RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 8000

# Use Railway's PORT env var if set, otherwise default to 8000
# NOTE: --forwarded-allow-ips='*' is required for Railway's reverse proxy.
# For other deployments, restrict to the actual proxy IP range.
CMD gunicorn src.main:app -w ${WEB_CONCURRENCY:-1} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --forwarded-allow-ips='*' --timeout 120 --graceful-timeout 30 --keep-alive 5
