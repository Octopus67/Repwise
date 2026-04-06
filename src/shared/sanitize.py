"""Audit fix 2.4 — HTML sanitization utility."""
import html
import re


def strip_html(value: str) -> str:
    """Remove HTML tags from user input. Does NOT escape — Pydantic handles output encoding."""
    return re.sub(r'<[^>]+>', '', value)
