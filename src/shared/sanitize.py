"""Audit fix 2.4 — HTML sanitization utility."""

import html
import re


def strip_html(value: str) -> str:
    """Remove HTML tags and escape remaining entities from user input."""
    stripped = re.sub(r"<[^>]+>", "", value)
    return html.escape(stripped, quote=True)


def clean_text(value: str) -> str:
    """Strip HTML tags from user input."""
    return re.sub(r"<[^>]+>", "", value).strip()
