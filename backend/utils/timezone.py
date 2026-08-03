# -*- coding: utf-8 -*-
"""台北時區（UTC+8）日曆日相關工具。

台北無夏令時間；使用固定 offset，避免 Windows 缺 tzdata 時 ZoneInfo 失敗。
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

TAIPEI = timezone(timedelta(hours=8))
UTC = timezone.utc


def taipei_today() -> date:
    """回傳目前台北日曆日。"""
    return datetime.now(TAIPEI).date()


def taipei_inclusive_range_to_utc_naive(start: date, end: date) -> tuple[datetime, datetime]:
    """台北日曆日起訖（含）→ UTC naive [start, end)，供與 DB 的 utcnow naive datetime 比對。"""
    start_local = datetime.combine(start, time.min, tzinfo=TAIPEI)
    end_exclusive_local = datetime.combine(end + timedelta(days=1), time.min, tzinfo=TAIPEI)
    start_utc = start_local.astimezone(UTC).replace(tzinfo=None)
    end_utc = end_exclusive_local.astimezone(UTC).replace(tzinfo=None)
    return start_utc, end_utc


def format_utc_naive_as_taipei(dt: datetime | None) -> str | None:
    """DB 的 UTC naive datetime → 台北時間字串 YYYY-MM-DD HH:MM:SS；None 則回 None。"""
    if dt is None:
        return None
    aware = dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)
    return aware.astimezone(TAIPEI).strftime("%Y-%m-%d %H:%M:%S")
