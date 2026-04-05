"""Sharing routes — public workout links, share tracking, referrals."""

from __future__ import annotations

import html as html_mod
import logging
import uuid

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.middleware.authenticate import get_current_user
from src.modules.auth.models import User
from src.modules.sharing.schemas import ShareEventCreate, ShareEventResponse
from src.modules.sharing.service import SharingService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> SharingService:
    return SharingService(db)


@router.get("/workout/{session_id}", response_class=HTMLResponse)
async def get_shared_workout(
    session_id: uuid.UUID,
    ref: str | None = Query(default=None, max_length=200, description="Referrer user ID"),
    request: Request = None,  # type: ignore[assignment]
    service: SharingService = Depends(_get_service),
) -> HTMLResponse:
    """Public endpoint — returns HTML with Open Graph meta tags for a shared workout."""
    workout = await service.get_shared_workout(session_id)

    if workout is None:
        return HTMLResponse(
            content="<html><body><h1>Workout not found</h1></body></html>",
            status_code=404,
        )

    # Track referral if ref param present
    if ref:
        try:
            referrer_id = uuid.UUID(ref)
            visitor_ip = request.client.host if request and request.client else None  # Audit fix 10.2
            user_agent = request.headers.get("user-agent") if request else None
            await service.track_referral(referrer_id, visitor_ip, user_agent)
        except ValueError:
            logger.warning("Invalid referral UUID: %s", ref)

    safe_display_name = html_mod.escape(workout['user_display_name'])
    title = f"{safe_display_name}'s Workout — Repwise"
    description = (
        f"{workout['exercise_count']} exercises · "
        f"{workout['total_sets']} sets · "
        f"{workout['total_volume_kg']:,}kg volume"
    )
    if workout["pr_count"] > 0:
        description += f" · 🏆 {workout['pr_count']} PR{'s' if workout['pr_count'] > 1 else ''}"

    # Audit fix 6.7 — HTML escape in OG meta tags
    safe_title = html_mod.escape(title, quote=True)
    safe_description = html_mod.escape(description, quote=True)
    og_url = html_mod.escape(str(request.url)) if request else ""
    og_image = "https://repwise.app/og-workout.png"

    exercises_html = "".join(
        f"<li>{html_mod.escape(ex['name'])} — {ex['sets']} sets</li>"
        for ex in workout["exercises"]
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{safe_title}</title>
    <meta property="og:title" content="{safe_title}">
    <meta property="og:description" content="{safe_description}">
    <meta property="og:image" content="{og_image}">
    <meta property="og:url" content="{og_url}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{safe_title}">
    <meta name="twitter:description" content="{safe_description}">
    <meta name="twitter:image" content="{og_image}">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0A0E13; color: #F1F5F9; max-width: 600px; margin: 0 auto; padding: 24px; }}
        h1 {{ color: #06B6D4; font-size: 1.5rem; }}
        .stats {{ display: flex; gap: 16px; margin: 16px 0; }}
        .stat {{ background: #12171F; border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center; }}
        .stat-value {{ font-size: 1.25rem; font-weight: 700; }}
        .stat-label {{ font-size: 0.75rem; color: #94A3B8; margin-top: 4px; }}
        ul {{ list-style: none; padding: 0; }}
        li {{ padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: #94A3B8; }}
        .cta {{ display: inline-block; background: #06B6D4; color: #0B0F14; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 24px; }}
        .footer {{ color: #7B8DA1; font-size: 0.75rem; margin-top: 32px; }}
    </style>
</head>
<body>
    <h1>🏋️ {safe_display_name}'s Workout</h1>
    <p style="color:#94A3B8">{workout['session_date']}</p>
    <div class="stats">
        <div class="stat"><div class="stat-value">{workout['exercise_count']}</div><div class="stat-label">Exercises</div></div>
        <div class="stat"><div class="stat-value">{workout['total_sets']}</div><div class="stat-label">Sets</div></div>
        <div class="stat"><div class="stat-value">{workout['total_volume_kg']:,}kg</div><div class="stat-label">Volume</div></div>
    </div>
    <ul>{exercises_html}</ul>
    <a class="cta" href="https://repwise.app">Try Repwise Free</a>
    <p class="footer">Built with Repwise · repwise.app</p>
</body>
</html>"""

    return HTMLResponse(content=html)


@router.post("/track", response_model=ShareEventResponse, status_code=201)
async def track_share_event(
    data: ShareEventCreate,
    user: User = Depends(get_current_user),
    service: SharingService = Depends(_get_service),
) -> ShareEventResponse:
    """Track a share event for analytics."""
    event = await service.track_share(
        user_id=user.id,
        session_id=data.session_id,
        share_type=data.share_type,
        platform=data.platform,
    )
    return ShareEventResponse.model_validate(event)
