"""Structured JSON security logger for auth events, rate limits, and suspicious activity."""

import json
import logging
import time

logger = logging.getLogger("security")


def _log(level: str, event: str, **kwargs) -> None:
    entry = {"event": event, "timestamp": time.time(), **kwargs}
    getattr(logger, level)(json.dumps(entry))


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email or ""
    local, domain = email.split("@", 1)
    return local[:3] + "***@" + domain


def log_auth_success(email: str, ip: str, method: str = "email") -> None:
    _log("info", "auth_success", email=_mask_email(email), ip=ip, method=method)


def log_auth_failure(email: str, ip: str, reason: str, method: str = "email") -> None:
    _log("warning", "auth_failure", email=_mask_email(email), ip=ip, reason=reason, method=method)


def log_rate_limit_hit(ip: str, endpoint: str, identifier: str = "") -> None:
    _log("warning", "rate_limit_hit", ip=ip, endpoint=endpoint, identifier=identifier)


def log_suspicious_activity(ip: str, reason: str, path: str = "", **extra) -> None:
    _log("warning", "suspicious_activity", ip=ip, reason=reason, path=path, **extra)


def log_account_event(user_id: str, action: str, ip: str = "") -> None:
    _log("info", "account_event", user_id=user_id, action=action, ip=ip)


def log_api_error(path: str, status: int, error: str, ip: str = "", user_id: str = "") -> None:
    _log("error", "api_error", path=path, status=status, error=error, ip=ip, user_id=user_id)
