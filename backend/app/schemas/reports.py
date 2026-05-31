from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel

# ── Query endpoint ─────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    sql: str
    params: dict[str, Any] | None = None


class QueryResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    truncated: bool


# ── Schema reference ───────────────────────────────────────────────────────────

class ColumnInfo(BaseModel):
    name: str
    type: str
    description: str
    foreign_key: str | None = None


class TableInfo(BaseModel):
    name: str
    description: str
    columns: list[ColumnInfo]


class SchemaResponse(BaseModel):
    tables: list[TableInfo]


# ── Dashboards & Widgets ───────────────────────────────────────────────────────

class DashboardCreate(BaseModel):
    name: str
    description: str | None = None


class DashboardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class DashboardResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None
    created_at: str
    updated_at: str
    deleted_at: str | None


class WidgetCreate(BaseModel):
    title: str
    query: str
    viz_type: str
    viz_config: dict[str, Any] | None = None
    position: dict[str, int] | None = None


class WidgetUpdate(BaseModel):
    title: str | None = None
    query: str | None = None
    viz_type: str | None = None
    viz_config: dict[str, Any] | None = None
    position: dict[str, int] | None = None


class WidgetResponse(BaseModel):
    id: uuid.UUID
    dashboard_id: uuid.UUID
    title: str
    query: str
    viz_type: str
    viz_config: dict[str, Any] | None
    position: dict[str, int] | None
    created_at: str
    updated_at: str
