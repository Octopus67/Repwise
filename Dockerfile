FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy project files and install dependencies
COPY pyproject.toml .
COPY src/ src/
COPY alembic.ini .

RUN pip install --no-cache-dir .

EXPOSE 8000

# Use Railway's PORT env var if set, otherwise default to 8000
CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}
