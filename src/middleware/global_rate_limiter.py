"""Global API rate limiting middleware — protects all endpoints by IP."""

import json
import logging
import time

import redis.exceptions

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.config.redis import get_redis
from src.shared.ip_utils import get_client_ip

logger = logging.getLogger("security")

DEFAULT_RPM = 100
WINDOW = 60


async def _check_global_limit(ip: str, rpm: int) -> bool | None:
    """Check global per-IP rate limit via async Redis sorted set.

    Returns True=allowed, False=blocked, None=Redis unavailable.
    """
    r = await get_redis()
    if r is None:
        return None
    try:
        now = time.time()
        cutoff = now - WINDOW
        redis_key = f"rl:global:{ip}"

        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, cutoff)
        pipe.zcard(redis_key)
        pipe.expire(redis_key, WINDOW)
        results = await pipe.execute()
        count = results[1]

        if count >= rpm:
            return False

        pipe2 = r.pipeline()
        pipe2.zadd(redis_key, {f"{now}": now})
        pipe2.expire(redis_key, WINDOW)
        await pipe2.execute()

        return True
    except (redis.exceptions.RedisError, ConnectionError, TimeoutError) as exc:
        logger.warning(
            "[GlobalRateLimit] Redis check failed (%s), failing open: %s", type(exc).__name__, exc
        )
        return None


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rpm: int = DEFAULT_RPM) -> None:
        super().__init__(app)
        self.rpm = rpm

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path == "/api/v1/health":
            return await call_next(request)

        ip = get_client_ip(request)

        redis_result = await _check_global_limit(ip, self.rpm)
        if redis_result is not None:
            if not redis_result:
                logger.warning(
                    json.dumps(
                        {"event": "global_rate_limit_hit", "ip": ip, "path": request.url.path}
                    )
                )
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests"},
                    headers={"Retry-After": str(WINDOW)},
                )
            return await call_next(request)

        logger.warning("[GlobalRateLimit] Redis unavailable, failing open for ip=%s", ip)
        return await call_next(request)
