"""Unified ARQ WorkerSettings — registers every job the API can enqueue."""

from arq import cron
from arq.connections import RedisSettings

from app.config import settings
from app.workers.export_worker import export_archive
from app.workers.import_worker import process_pdf_import
from app.workers.purge_worker import purge_soft_deleted


class WorkerSettings:
    functions = [purge_soft_deleted, process_pdf_import, export_archive]
    cron_jobs = [
        cron(purge_soft_deleted, hour=3, minute=0),  # 03:00 UTC daily
    ]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
