"""Utilities for extracting client IP from requests.

Railway's reverse proxy REPLACES X-Forwarded-For with the actual client IP
(it does not append). This means the header contains exactly one IP — the
real client. For non-Railway deployments that APPEND to XFF, adjust
TRUSTED_PROXY_COUNT and use the rightmost-minus-N approach.
"""

import logging
from starlette.requests import Request

logger = logging.getLogger("security")

# Number of trusted reverse proxy hops. Railway = 1 (replaces XFF).
TRUSTED_PROXY_COUNT = 1


def get_client_ip(request: Request) -> str:
    """Extract real client IP, handling reverse proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
        # Warn on suspiciously long chains (possible spoofing attempt)
        if len(ips) > TRUSTED_PROXY_COUNT + 5:
            logger.warning(
                '{"event": "suspicious_xff", "chain_length": %d, "path": "%s"}',
                len(ips),
                getattr(request.url, "path", ""),
            )
        # Railway replaces XFF entirely → first IP is the real client.
        # For append-style proxies, use: ips[-(TRUSTED_PROXY_COUNT + 1)]
        return ips[0]
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"
