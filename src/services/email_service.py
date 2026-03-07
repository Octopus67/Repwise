"""Email service — send verification and password reset codes via AWS SES."""

from __future__ import annotations

import logging
import random
import string

import boto3
from botocore.exceptions import ClientError

from src.config.settings import settings

logger = logging.getLogger(__name__)


def _get_ses_client():
    """Create a boto3 SES client. Uses default credential chain (env vars, IAM role, etc.)."""
    return boto3.client("ses", region_name=settings.SES_REGION)


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


class EmailService:
    """Sends transactional emails via AWS SES."""

    def __init__(self, ses_client=None):
        self._client = ses_client or _get_ses_client()

    def send_verification_code(self, to_email: str, code: str) -> bool:
        """Send a 6-digit verification code to the user's email."""
        subject = f"{settings.APP_NAME} — Verify your email"
        body = (
            f"Your verification code is: {code}\n\n"
            f"This code expires in 10 minutes.\n"
            f"If you didn't create an account, please ignore this email."
        )
        return self._send(to_email, subject, body)

    def send_password_reset_code(self, to_email: str, code: str) -> bool:
        """Send a password reset code to the user's email."""
        subject = f"{settings.APP_NAME} — Password reset code"
        body = (
            f"Your password reset code is: {code}\n\n"
            f"This code expires in 10 minutes.\n"
            f"If you didn't request this, please ignore this email."
        )
        return self._send(to_email, subject, body)

    def send_account_exists_notification(self, to_email: str) -> bool:
        """Notify the email owner that a registration attempt was made."""
        subject = f"{settings.APP_NAME} — Sign-in attempt"
        body = (
            "Someone tried to create an account with this email address, "
            "but an account already exists.\n\n"
            "If this was you, please log in instead. "
            "If you didn't request this, you can safely ignore this email."
        )
        return self._send(to_email, subject, body)

    def _send(self, to_email: str, subject: str, body: str) -> bool:
        """Send an email via SES. Returns True on success."""
        try:
            self._client.send_email(
                Source=settings.SES_SENDER_EMAIL,
                Destination={"ToAddresses": [to_email]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
                },
            )
            return True
        except ClientError:
            logger.exception("Failed to send email to %s", to_email)
            return False
