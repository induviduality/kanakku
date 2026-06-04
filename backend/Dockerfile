FROM python:3.12-slim AS builder

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml .
COPY app/ ./app/

RUN pip install --no-cache-dir hatchling && \
    pip install --no-cache-dir .


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY . .

RUN useradd --no-create-home --shell /bin/false appuser && \
    chown -R appuser:appuser /app && \
    chmod +x /app/entrypoint.sh
USER appuser

EXPOSE 8765

ENTRYPOINT ["/app/entrypoint.sh"]
