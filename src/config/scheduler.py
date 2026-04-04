"""APScheduler integration with Redis-based leader election.

In multi-worker deployments (Gunicorn), only one worker acquires the
scheduler lock via Redis — the rest skip.  The leader renews its lock
every 30s (TTL 60s) so another worker takes over if the leader dies.

In single-worker deployments (Railway/Uvicorn without Redis), the
scheduler starts unconditionally — no lock needed.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from functools import wraps
from typing import Callable

import sentry_sdk
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.exc import SQLAlchemyError

from src.config.redis import get_redis

logger = logging.getLogger(__name__)

LOCK_KEY = "scheduler_leader"
LOCK_TTL = 60  # seconds
RENEW_INTERVAL = 30  # seconds

scheduler = AsyncIOScheduler()
_worker_id: str = uuid.uuid4().hex
_renew_task: asyncio.Task | None = None


# ── Leader election ───────────────────────────────────────────────

def try_acquire_lock() -> bool:
    """Attempt to become the scheduler leader via Redis NX lock.

    When Redis is unavailable (e.g. single-worker Railway deployment),
    assume leadership — there's only one worker, so no contention.
    """
    r = get_redis()
    if r is None:
        logger.warning("Redis unavailable — assuming single-worker mode, starting scheduler")
        return True
    try:
        acquired = r.set(LOCK_KEY, _worker_id, nx=True, ex=LOCK_TTL)
    except (OSError, ConnectionError, Exception) as exc:
        logger.warning("Redis error during lock acquisition (%s) — assuming single-worker mode", exc)
        return True
    if acquired:
        logger.info("Worker %s acquired scheduler lock", _worker_id[:8])
    else:
        logger.info("Worker %s did not acquire lock — another worker is leader", _worker_id[:8])
    return bool(acquired)


async def _renew_lock_loop() -> None:
    """Renew the Redis lock every RENEW_INTERVAL seconds to keep leadership.

    In single-worker mode (no Redis), this loop is a no-op that just sleeps.
    """
    while True:
        await asyncio.sleep(RENEW_INTERVAL)
        r = get_redis()
        if r is None:
            continue  # single-worker mode — no lock to renew
        try:
            if r.get(LOCK_KEY) == _worker_id:
                r.expire(LOCK_KEY, LOCK_TTL)
            else:
                logger.warning("Lost scheduler lock — stopping scheduler")
                scheduler.shutdown(wait=False)
                break
        except (OSError, ConnectionError, Exception) as exc:
            logger.warning("Redis error during lock renewal (%s) — will retry", exc)


# ── Safe job wrapper ──────────────────────────────────────────────

def safe_run(job_fn: Callable, job_name: str) -> Callable:
    """Wrap an async job so exceptions are captured to Sentry without crashing the scheduler."""
    @wraps(job_fn)
    async def wrapper():
        try:
            await job_fn()
        except Exception as exc:
            logger.exception("Job '%s' failed (%s)", job_name, type(exc).__name__)
            sentry_sdk.capture_exception()
    return wrapper


# ── Scheduler configuration ──────────────────────────────────────

def configure_scheduler() -> None:
    """Register all background jobs on the scheduler."""
    from src.jobs.permanent_deletion import run_permanent_deletion
    from src.jobs.cleanup_blacklist import cleanup_expired_blacklist_entries
    from src.jobs.trial_expiration import run_trial_expiration
    from src.jobs.export_worker import run_export_worker
    from src.jobs.cleanup_exports import run_cleanup_exports
    from src.jobs.refresh_leaderboards import refresh_leaderboards
    from src.jobs.workout_reminders import run_workout_reminders

    jobs = [
        ("permanent_deletion", run_permanent_deletion, CronTrigger(hour=3)),
        ("cleanup_blacklist", cleanup_expired_blacklist_entries, CronTrigger(hour=4)),
        ("trial_expiration", run_trial_expiration, CronTrigger(minute=0)),
        ("export_worker", run_export_worker, IntervalTrigger(minutes=5)),
        ("cleanup_exports", run_cleanup_exports, CronTrigger(hour=5)),
        ("refresh_leaderboards", refresh_leaderboards, IntervalTrigger(minutes=15)),
        ("workout_reminders", run_workout_reminders, IntervalTrigger(hours=2)),
    ]

    for name, fn, trigger in jobs:
        scheduler.add_job(
            safe_run(fn, name),
            trigger=trigger,
            id=name,
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )

    logger.info("Configured %d scheduled jobs", len(jobs))


# ── Lifecycle helpers ─────────────────────────────────────────────

async def start_scheduler() -> None:
    """Start the scheduler and the lock-renewal background task."""
    global _renew_task
    if scheduler.running:
        return
    configure_scheduler()
    scheduler.start()
    _renew_task = asyncio.create_task(_renew_lock_loop())
    logger.info("Scheduler started (worker %s)", _worker_id[:8])


async def stop_scheduler() -> None:
    """Gracefully shut down the scheduler and release the lock."""
    global _renew_task
    if _renew_task and not _renew_task.done():
        _renew_task.cancel()
        _renew_task = None
    if scheduler.running:
        # Wait for in-flight jobs to finish
        scheduler.shutdown(wait=True)
    r = get_redis()
    try:
        if r and r.get(LOCK_KEY) == _worker_id:
            r.delete(LOCK_KEY)
            logger.info("Released scheduler lock (worker %s)", _worker_id[:8])
    except (OSError, ConnectionError, Exception) as exc:
        logger.warning("Redis error during lock release (%s) — best-effort cleanup", exc)
