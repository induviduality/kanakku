"""Tests for infra/scripts/auto-backup.sh rotation logic.

Uses DRY_RUN=1 so pg_dump is never invoked — tests file-creation and
rotation behaviour only (no database required).  DOW and DOM env vars
override the date-based day-of-week / day-of-month detection so tests
are deterministic regardless of when they run.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent.parent / "infra" / "scripts" / "auto-backup.sh"

pytestmark = pytest.mark.skipif(sys.platform == "win32", reason="shell script tests require Linux")


def _run(backup_dir: Path, *, dow: str = "3", dom: str = "15") -> subprocess.CompletedProcess:
    """Run auto-backup.sh with DRY_RUN=1 and explicit DOW/DOM."""
    env = {
        **os.environ,
        "BACKUP_DIR": str(backup_dir),
        "DATABASE_URL": "postgresql://x:x@localhost/x",
        "DRY_RUN": "1",
        "DOW": dow,
        "DOM": dom,
    }
    return subprocess.run(["bash", str(SCRIPT)], env=env, capture_output=True, text=True)


def _fake_backups(backup_dir: Path, prefix: str, count: int) -> None:
    for i in range(count):
        (backup_dir / f"{prefix}_20260101T{i:06d}Z.dump").write_text("fake")
        time.sleep(0.005)


@pytest.mark.skipif(not SCRIPT.exists(), reason="auto-backup.sh not found")
def test_backup_creates_daily_file(tmp_path: Path) -> None:
    result = _run(tmp_path)
    assert result.returncode == 0, result.stderr
    assert len(list(tmp_path.glob("kanakku_daily_*.dump"))) == 1


@pytest.mark.skipif(not SCRIPT.exists(), reason="auto-backup.sh not found")
def test_non_monday_non_first_no_weekly_or_monthly(tmp_path: Path) -> None:
    result = _run(tmp_path, dow="3", dom="15")
    assert result.returncode == 0, result.stderr
    assert list(tmp_path.glob("kanakku_weekly_*.dump")) == []
    assert list(tmp_path.glob("kanakku_monthly_*.dump")) == []


@pytest.mark.skipif(not SCRIPT.exists(), reason="auto-backup.sh not found")
def test_monday_creates_weekly_backup(tmp_path: Path) -> None:
    result = _run(tmp_path, dow="1", dom="15")
    assert result.returncode == 0, result.stderr
    assert len(list(tmp_path.glob("kanakku_weekly_*.dump"))) == 1


@pytest.mark.skipif(not SCRIPT.exists(), reason="auto-backup.sh not found")
def test_first_of_month_creates_monthly_backup(tmp_path: Path) -> None:
    result = _run(tmp_path, dow="3", dom="01")
    assert result.returncode == 0, result.stderr
    assert len(list(tmp_path.glob("kanakku_monthly_*.dump"))) == 1


@pytest.mark.skipif(not SCRIPT.exists(), reason="auto-backup.sh not found")
def test_rotation_keeps_7_daily(tmp_path: Path) -> None:
    # Pre-seed 9 daily backups; script adds one more → 10 total → rotation trims to 7
    _fake_backups(tmp_path, "kanakku_daily", 9)
    result = _run(tmp_path, dow="3", dom="15")
    assert result.returncode == 0, result.stderr
    assert len(list(tmp_path.glob("kanakku_daily_*.dump"))) == 7


@pytest.mark.skipif(not SCRIPT.exists(), reason="auto-backup.sh not found")
def test_rotation_keeps_4_weekly(tmp_path: Path) -> None:
    # Pre-seed 5 weekly backups; Monday run adds one more → 6 → rotation trims to 4
    _fake_backups(tmp_path, "kanakku_weekly", 5)
    result = _run(tmp_path, dow="1", dom="15")
    assert result.returncode == 0, result.stderr
    assert len(list(tmp_path.glob("kanakku_weekly_*.dump"))) == 4


@pytest.mark.skipif(not SCRIPT.exists(), reason="auto-backup.sh not found")
def test_rotation_keeps_12_monthly(tmp_path: Path) -> None:
    # Pre-seed 14 monthly backups; 1st-of-month run adds one more → 15 → trims to 12
    _fake_backups(tmp_path, "kanakku_monthly", 14)
    result = _run(tmp_path, dow="3", dom="01")
    assert result.returncode == 0, result.stderr
    assert len(list(tmp_path.glob("kanakku_monthly_*.dump"))) == 12
