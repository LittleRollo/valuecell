"""Service for personalized scheduled news delivery and realtime tracking."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional
from uuid import uuid4

from loguru import logger

from valuecell.agents.news_agent.tools import web_search
from valuecell.utils.env import ensure_system_env_dir

DEFAULT_USER_ID = "default_user"
SUBSCRIPTIONS_FILE = "news_subscriptions.json"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(value: datetime) -> str:
    return value.isoformat()


def _from_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _clean_keywords(keywords: List[str]) -> List[str]:
    unique_keywords: list[str] = []
    for keyword in keywords:
        trimmed = keyword.strip()
        if trimmed and trimmed not in unique_keywords:
            unique_keywords.append(trimmed)
    return unique_keywords


class NewsSubscriptionService:
    """Manage news subscriptions and deliver due updates."""

    def __init__(self, storage_path: Optional[Path] = None):
        base_dir = ensure_system_env_dir()
        self.storage_path = storage_path or (base_dir / SUBSCRIPTIONS_FILE)
        self._lock = Lock()

    def _load_data(self) -> Dict[str, Any]:
        with self._lock:
            if not self.storage_path.exists():
                return {"subscriptions": []}

            try:
                content = self.storage_path.read_text(encoding="utf-8")
                parsed = json.loads(content)
                if isinstance(parsed, dict) and isinstance(
                    parsed.get("subscriptions"), list
                ):
                    return parsed
            except Exception as exc:
                logger.warning("Failed to load news subscriptions: {}", exc)

            return {"subscriptions": []}

    def _save_data(self, data: Dict[str, Any]) -> None:
        with self._lock:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            self.storage_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    def list_subscriptions(self, user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
        data = self._load_data()
        rows = [s for s in data["subscriptions"] if s.get("user_id") == user_id]
        rows.sort(key=lambda row: row.get("updated_at", ""), reverse=True)
        return rows

    def create_subscription(
        self,
        name: str,
        keywords: List[str],
        interval_minutes: int,
        enabled: bool,
        realtime_tracking: bool,
        user_id: str = DEFAULT_USER_ID,
    ) -> Dict[str, Any]:
        cleaned_keywords = _clean_keywords(keywords)
        if not cleaned_keywords:
            raise ValueError("keywords cannot be empty")

        now = _utc_now()
        next_run_at = now + timedelta(minutes=interval_minutes)
        row = {
            "id": str(uuid4()),
            "user_id": user_id,
            "name": name.strip(),
            "keywords": cleaned_keywords,
            "interval_minutes": interval_minutes,
            "enabled": enabled,
            "realtime_tracking": realtime_tracking,
            "last_run_at": None,
            "next_run_at": _to_iso(next_run_at) if enabled else None,
            "created_at": _to_iso(now),
            "updated_at": _to_iso(now),
        }

        data = self._load_data()
        data["subscriptions"].append(row)
        self._save_data(data)
        return row

    def update_subscription(
        self,
        subscription_id: str,
        name: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        interval_minutes: Optional[int] = None,
        enabled: Optional[bool] = None,
        realtime_tracking: Optional[bool] = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> Optional[Dict[str, Any]]:
        data = self._load_data()
        target: Optional[Dict[str, Any]] = None
        for row in data["subscriptions"]:
            if row.get("id") == subscription_id and row.get("user_id") == user_id:
                target = row
                break

        if target is None:
            return None

        if name is not None:
            target["name"] = name.strip()
        if keywords is not None:
            cleaned_keywords = _clean_keywords(keywords)
            if not cleaned_keywords:
                raise ValueError("keywords cannot be empty")
            target["keywords"] = cleaned_keywords
        if interval_minutes is not None:
            target["interval_minutes"] = interval_minutes
        if enabled is not None:
            target["enabled"] = enabled
        if realtime_tracking is not None:
            target["realtime_tracking"] = realtime_tracking

        now = _utc_now()
        target["updated_at"] = _to_iso(now)

        is_enabled = bool(target.get("enabled", True))
        current_next = _from_iso(target.get("next_run_at"))
        if not is_enabled:
            target["next_run_at"] = None
        elif current_next is None or current_next < now:
            target["next_run_at"] = _to_iso(
                now + timedelta(minutes=int(target["interval_minutes"]))
            )

        self._save_data(data)
        return target

    def delete_subscription(
        self, subscription_id: str, user_id: str = DEFAULT_USER_ID
    ) -> bool:
        data = self._load_data()
        before = len(data["subscriptions"])
        data["subscriptions"] = [
            row
            for row in data["subscriptions"]
            if not (row.get("id") == subscription_id and row.get("user_id") == user_id)
        ]
        changed = len(data["subscriptions"]) != before
        if changed:
            self._save_data(data)
        return changed

    async def deliver_subscription(
        self, subscription_id: str, user_id: str = DEFAULT_USER_ID
    ) -> Optional[Dict[str, Any]]:
        data = self._load_data()
        target = next(
            (
                row
                for row in data["subscriptions"]
                if row.get("id") == subscription_id and row.get("user_id") == user_id
            ),
            None,
        )
        if target is None:
            return None

        if not bool(target.get("enabled", True)):
            return {
                "subscription_id": target["id"],
                "subscription_name": target["name"],
                "keywords": target.get("keywords", []),
                "delivered_at": _utc_now(),
                "content": "该订阅已禁用，未执行新闻推送。",
            }

        query = self._build_query(target)
        content = await web_search(query)

        now = _utc_now()
        target["last_run_at"] = _to_iso(now)
        target["next_run_at"] = _to_iso(
            now + timedelta(minutes=int(target["interval_minutes"]))
        )
        target["updated_at"] = _to_iso(now)
        self._save_data(data)

        return {
            "subscription_id": target["id"],
            "subscription_name": target["name"],
            "keywords": target.get("keywords", []),
            "delivered_at": now,
            "content": content,
        }

    async def deliver_due_subscriptions(
        self,
        user_id: str = DEFAULT_USER_ID,
    ) -> List[Dict[str, Any]]:
        now = _utc_now()
        rows = self.list_subscriptions(user_id)

        due_ids = []
        for row in rows:
            if not bool(row.get("enabled", True)):
                continue

            next_run_at = _from_iso(row.get("next_run_at"))
            if next_run_at is None or next_run_at <= now:
                due_ids.append(row["id"])

        if not due_ids:
            return []

        deliveries = await asyncio.gather(
            *(self.deliver_subscription(subscription_id, user_id) for subscription_id in due_ids)
        )
        return [delivery for delivery in deliveries if delivery is not None]

    @staticmethod
    def _build_query(row: Dict[str, Any]) -> str:
        keywords = row.get("keywords", [])
        keyword_clause = " OR ".join(str(item) for item in keywords)
        realtime_clause = "实时" if row.get("realtime_tracking", True) else "最新"
        today = _utc_now().strftime("%Y-%m-%d")
        return f"{realtime_clause} 新闻 {keyword_clause} {today}"


_news_subscription_service: Optional[NewsSubscriptionService] = None


def get_news_subscription_service() -> NewsSubscriptionService:
    """Get global news subscription service instance."""
    global _news_subscription_service
    if _news_subscription_service is None:
        _news_subscription_service = NewsSubscriptionService()
    return _news_subscription_service
