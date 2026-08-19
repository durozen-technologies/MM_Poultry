FROM python:3.11-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.11.3 /uv /usr/local/bin/uv
COPY pyproject.toml ./
COPY app ./app
COPY main.py migrate.py manage.py seed.py ./
RUN uv sync --no-dev
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
