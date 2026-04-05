"""Audit fix 2.4 — HTML sanitization utility."""
import html
import re


def strip_html(value: str) -> str:
    """Remove HTML tags and escape special characters."""
    cleaned = re.sub(r'<[^>]+>', '', value)
    return html.escape(cleaned)
