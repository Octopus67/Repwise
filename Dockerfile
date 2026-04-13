FROM python:3.12-slim@sha256:804ddf3251a60bbf9c92e73b7566c40428d54d0e79d3428194edf40da6521286

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY src/ src/
COPY alembic.ini .

RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1

CMD gunicorn src.main:app -w ${WEB_CONCURRENCY:-1} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --forwarded-allow-ips='*' --timeout 120 --graceful-timeout 30 --keep-alive 5
