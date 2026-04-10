"""Legal pages router — serves Privacy Policy and Terms of Service as HTML."""

from pathlib import Path

import markdown
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["legal"])

_DOCS_DIR = Path(__file__).resolve().parent

_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Repwise</title>
<style>
  body {{ max-width: 720px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }}
  h1 {{ font-size: 1.8rem; }} h2 {{ font-size: 1.3rem; margin-top: 2rem; }}
  table {{ border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }}
  th, td {{ border: 1px solid #ddd; padding: 8px 12px; text-align: left; }}
  th {{ background: #f5f5f5; }}
  a {{ color: #2563eb; }}
  @media (prefers-color-scheme: dark) {{
    body {{ background: #111; color: #e0e0e0; }}
    th {{ background: #222; }} th, td {{ border-color: #333; }}
    a {{ color: #60a5fa; }}
  }}
</style>
</head>
<body>{content}</body>
</html>"""


def _render(md_filename: str, title: str) -> HTMLResponse:
    md_text = (_DOCS_DIR / md_filename).read_text()
    html_body = markdown.markdown(md_text, extensions=["tables"])
    return HTMLResponse(_HTML_TEMPLATE.format(title=title, content=html_body))


@router.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    """Serve the Privacy Policy as an HTML page."""
    return _render("privacy-policy.md", "Privacy Policy")


@router.get("/terms", response_class=HTMLResponse)
async def terms_of_service():
    """Serve the Terms of Service as an HTML page."""
    return _render("terms-of-service.md", "Terms of Service")
