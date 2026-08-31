# Stage 1: Builder
FROM python:3.11-slim AS builder

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.11.3 /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Compile bytecode for faster startup
ENV UV_COMPILE_BYTECODE=1
# Use copy instead of hardlink since we'll copy to another stage
ENV UV_LINK_MODE=copy

# Copy application source
COPY app ./app
COPY migrations ./migrations
COPY main.py migrate.py manage.py alembic.ini entrypoint.sh ./

# Sync dependencies and create virtual environment
RUN uv sync --no-dev

# Stage 2: Final Runner
FROM python:3.11-slim

WORKDIR /app

# Copy application and the prepared virtual environment from builder
COPY --from=builder /app /app

# Add virtual environment to PATH so binaries (like uvicorn/alembic) are available globally
ENV PATH="/app/.venv/bin:$PATH"

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Security: non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
RUN chmod +x /app/entrypoint.sh && chown appuser:appuser /app/entrypoint.sh
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health').read()" || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
