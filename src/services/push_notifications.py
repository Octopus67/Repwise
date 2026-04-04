"""Push notification service using Expo Push API.

Handles batching, error handling, token deactivation, and logging.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.notifications.models import DeviceToken, NotificationLog
from src.utils.retry import async_retry

logger = logging.getLogger("hypertrophy_os.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH_SIZE = 100


class PushNotificationService:
    """Sends push notifications via the Expo Push API."""

    def __init__(self, db: AsyncSession, http_client: Optional[httpx.AsyncClient] = None) -> None:
        self.db = db
        self._http_client = http_client

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return httpx.AsyncClient(timeout=30.0)

    async def send_notification(
        self,
        user_id: uuid.UUID,
        title: str,
        body: str,
        data: Optional[dict[str, Any]] = None,
        sound: str = "default",
        badge: Optional[int] = None,
        notification_type: str = "general",
    ) -> int:
        """Send push notification to all active tokens for a user.

        Returns the number of successfully queued messages.
        """
        tokens = await self._get_active_tokens(user_id)
        if not tokens:
            return 0

        messages = []
        for token in tokens:
            push_token = token.expo_push_token or token.token
            msg: dict[str, Any] = {
                "to": push_token,
                "title": title,
                "body": body,
                "sound": sound,
            }
            if data:
                msg["data"] = data
            if badge is not None:
                msg["badge"] = badge
            messages.append((token, msg))

        sent = 0
        # Batch in groups of BATCH_SIZE
        for i in range(0, len(messages), BATCH_SIZE):
            batch = messages[i : i + BATCH_SIZE]
            batch_msgs = [m for _, m in batch]
            batch_tokens = [t for t, _ in batch]
            sent += await self._send_batch(batch_tokens, batch_msgs)

        # Log notification
        await self._log_notification(user_id, notification_type, title, body, data)

        return sent

    async def _get_active_tokens(self, user_id: uuid.UUID) -> list[DeviceToken]:
        stmt = select(DeviceToken).where(
            DeviceToken.user_id == user_id,
            DeviceToken.is_active.is_(True),
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _send_batch(
        self, tokens: list[DeviceToken], messages: list[dict],
    ) -> int:
        """POST a batch of messages to Expo and handle responses."""
        access_token = os.environ.get("EXPO_ACCESS_TOKEN", "")
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        client = await self._get_client()
        owns_client = self._http_client is None
        try:
            result = await self._post_expo(client, messages, headers)
        except httpx.HTTPError as exc:
            logger.error("Expo push API error: %s", exc)
            return 0
        finally:
            if owns_client:
                await client.aclose()

        sent = 0
        data_list = result.get("data", [])
        for idx, ticket in enumerate(data_list):
            if idx >= len(tokens):
                break
            status = ticket.get("status")
            if status == "ok":
                sent += 1
            elif status == "error":
                detail = ticket.get("details", {})
                error_type = detail.get("error", "") if isinstance(detail, dict) else ""
                message = ticket.get("message", "")
                if error_type == "DeviceNotRegistered" or "DeviceNotRegistered" in message:
                    tokens[idx].is_active = False
                    logger.info("Deactivated token %s: DeviceNotRegistered", tokens[idx].id)
                else:
                    logger.warning("Push error for token %s: %s", tokens[idx].id, message)

        await self.db.flush()
        return sent

    @staticmethod
    @async_retry(
        max_retries=2,
        base_delay=0.5,
        retryable_exceptions=(httpx.ConnectError, httpx.TimeoutException),
    )
    async def _post_expo(client: httpx.AsyncClient, messages: list[dict], headers: dict) -> dict:
        """Retryable POST to Expo Push API."""
        response = await client.post(EXPO_PUSH_URL, json=messages, headers=headers)
        response.raise_for_status()
        return response.json()

    async def _log_notification(
        self,
        user_id: uuid.UUID,
        notification_type: str,
        title: str,
        body: str,
        data: Optional[dict[str, Any]],
    ) -> None:
        log = NotificationLog(
            user_id=user_id,
            type=notification_type,
            title=title,
            body=body,
            data=data,
            sent_at=datetime.utcnow(),
        )
        self.db.add(log)
        await self.db.flush()
