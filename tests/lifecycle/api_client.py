"""Async HTTP client wrapper for lifecycle simulation tests.

Uses HTTPX AsyncClient against the FastAPI test app with per-persona auth state.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from httpx import ASGITransport, AsyncClient

from src.main import app


class LifecycleClient:
    """Stateful API client for a single persona's lifecycle simulation."""

    def __init__(self) -> None:
        transport = ASGITransport(app=app)
        self._client = AsyncClient(transport=transport, base_url="http://test")
        self._token: Optional[str] = None
        self._user_id: Optional[str] = None

    @property
    def headers(self) -> dict[str, str]:
        if self._token is None:
            return {}
        return {"Authorization": f"Bearer {self._token}"}

    @property
    def user_id(self) -> Optional[str]:
        return self._user_id

    # ── Auth ──────────────────────────────────────────────────────────

    async def register(self, email: str, password: str) -> dict:
        resp = await self._client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password},
        )
        assert resp.status_code == 201, f"Register failed: {resp.status_code} {resp.text}"
        data = resp.json()
        self._token = data["access_token"]
        return data

    async def login(self, email: str, password: str) -> dict:
        resp = await self._client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
        data = resp.json()
        self._token = data["access_token"]
        return data

    async def get_me(self) -> dict:
        resp = await self._client.get("/api/v1/auth/me", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        self._user_id = data["id"]
        return data

    # ── Profile & Goals ───────────────────────────────────────────────

    async def get_profile(self) -> dict:
        resp = await self._client.get("/api/v1/users/profile", headers=self.headers)
        assert resp.status_code == 200, f"Get profile failed: {resp.status_code} {resp.text}"
        return resp.json()

    async def update_profile(self, **kwargs: Any) -> dict:
        resp = await self._client.put(
            "/api/v1/users/profile", json=kwargs, headers=self.headers,
        )
        assert resp.status_code == 200, f"Update profile failed: {resp.status_code} {resp.text}"
        return resp.json()

    async def set_goals(self, goal_type: str, **kwargs: Any) -> dict:
        body = {"goal_type": goal_type, **kwargs}
        resp = await self._client.put(
            "/api/v1/users/goals", json=body, headers=self.headers,
        )
        assert resp.status_code == 200, f"Set goals failed: {resp.status_code} {resp.text}"
        return resp.json()

    async def get_goals(self) -> Optional[dict]:
        resp = await self._client.get("/api/v1/users/goals", headers=self.headers)
        assert resp.status_code == 200
        return resp.json()

    # ── Metrics ───────────────────────────────────────────────────────

    async def log_metrics(self, **kwargs: Any) -> dict:
        resp = await self._client.post(
            "/api/v1/users/metrics", json=kwargs, headers=self.headers,
        )
        assert resp.status_code == 201, f"Log metrics failed: {resp.status_code} {resp.text}"
        return resp.json()

    # ── Bodyweight ────────────────────────────────────────────────────

    async def log_bodyweight(self, weight_kg: float, recorded_date: date) -> dict:
        resp = await self._client.post(
            "/api/v1/users/bodyweight",
            json={"weight_kg": weight_kg, "recorded_date": recorded_date.isoformat()},
            headers=self.headers,
        )
        assert resp.status_code == 201, f"Log bodyweight failed: {resp.status_code} {resp.text}"
        return resp.json()

    async def get_bodyweight_history(self, limit: int = 100) -> dict:
        resp = await self._client.get(
            "/api/v1/users/bodyweight/history",
            params={"limit": limit},
            headers=self.headers,
        )
        assert resp.status_code == 200
        return resp.json()

    # ── Nutrition ─────────────────────────────────────────────────────

    async def log_food(
        self, meal_name: str, calories: float, protein_g: float,
        carbs_g: float, fat_g: float, entry_date: date,
        micro_nutrients: Optional[dict] = None,
    ) -> dict:
        body: dict[str, Any] = {
            "meal_name": meal_name,
            "calories": calories,
            "protein_g": protein_g,
            "carbs_g": carbs_g,
            "fat_g": fat_g,
            "entry_date": entry_date.isoformat(),
        }
        if micro_nutrients:
            body["micro_nutrients"] = micro_nutrients
        resp = await self._client.post(
            "/api/v1/nutrition/entries", json=body, headers=self.headers,
        )
        assert resp.status_code == 201, f"Log food failed: {resp.status_code} {resp.text}"
        return resp.json()

    async def get_nutrition_entries(
        self, start_date: Optional[date] = None, end_date: Optional[date] = None,
        limit: int = 100,
    ) -> dict:
        params: dict[str, Any] = {"limit": limit}
        if start_date:
            params["start_date"] = start_date.isoformat()
        if end_date:
            params["end_date"] = end_date.isoformat()
        resp = await self._client.get(
            "/api/v1/nutrition/entries", params=params, headers=self.headers,
        )
        assert resp.status_code == 200, f"Get entries failed: {resp.status_code} {resp.text}"
        return resp.json()

    async def delete_nutrition_entry(self, entry_id: str) -> None:
        resp = await self._client.delete(
            f"/api/v1/nutrition/entries/{entry_id}", headers=self.headers,
        )
        assert resp.status_code == 204

    # ── Training ──────────────────────────────────────────────────────

    async def log_training(self, session_date: date, exercises: list[dict], **kwargs: Any) -> dict:
        body: dict[str, Any] = {
            "session_date": session_date.isoformat(),
            "exercises": exercises,
            **kwargs,
        }
        resp = await self._client.post(
            "/api/v1/training/sessions", json=body, headers=self.headers,
        )
        assert resp.status_code == 201, f"Log training failed: {resp.status_code} {resp.text}"
        return resp.json()

    async def get_training_sessions(
        self, start_date: Optional[date] = None, end_date: Optional[date] = None,
        limit: int = 100,
    ) -> dict:
        params: dict[str, Any] = {"limit": limit}
        if start_date:
            params["start_date"] = start_date.isoformat()
        if end_date:
            params["end_date"] = end_date.isoformat()
        resp = await self._client.get(
            "/api/v1/training/sessions", params=params, headers=self.headers,
        )
        assert resp.status_code == 200
        return resp.json()

    # ── Achievements ──────────────────────────────────────────────────

    async def get_achievements(self) -> list[dict]:
        resp = await self._client.get("/api/v1/achievements/", headers=self.headers)
        assert resp.status_code == 200
        return resp.json()

    async def get_streak(self) -> dict:
        resp = await self._client.get("/api/v1/achievements/streak", headers=self.headers)
        assert resp.status_code == 200
        return resp.json()

    # ── Adaptive ──────────────────────────────────────────────────────

    async def create_snapshot(self, body: dict) -> dict:
        resp = await self._client.post(
            "/api/v1/adaptive/snapshots", json=body, headers=self.headers,
        )
        assert resp.status_code == 201, f"Snapshot failed: {resp.status_code} {resp.text}"
        return resp.json()

    async def get_daily_targets(self, target_date: Optional[date] = None) -> dict:
        params: dict[str, Any] = {}
        if target_date:
            params["date"] = target_date.isoformat()
        resp = await self._client.get(
            "/api/v1/adaptive/daily-targets", params=params, headers=self.headers,
        )
        assert resp.status_code == 200
        return resp.json()

    # ── Raw request (for edge case testing) ───────────────────────────

    async def raw_post(self, path: str, json: Any = None, **kwargs: Any):
        return await self._client.post(path, json=json, headers=self.headers, **kwargs)

    async def raw_get(self, path: str, **kwargs: Any):
        return await self._client.get(path, headers=self.headers, **kwargs)

    async def close(self) -> None:
        await self._client.aclose()
