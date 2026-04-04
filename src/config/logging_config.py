"""Centralized logging configuration."""

import logging
import sys


def configure_logging(debug: bool = False) -> None:
    level = logging.DEBUG if debug else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))

    security_logger = logging.getLogger("security")
    security_logger.setLevel(level)
    if not security_logger.handlers:
        security_logger.addHandler(handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
