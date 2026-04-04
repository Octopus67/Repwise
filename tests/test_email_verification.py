"""Tests for email verification feature."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
import bcrypt as _bcrypt
from sqlalchemy import select

from src.modules.auth.models import EmailVerificationCode, PasswordResetCode, User
from src.modules.auth.service import AuthService
from src.middleware.rate_limiter import clear_all as clear_rate_limits
from src.services.email_service import EmailService, generate_otp


def _hash_code(code: str) -> str:
    """Hash a code using bcrypt directly (matching auth service implementation)."""
    return _bcrypt.hashpw(code.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


from src.modules.auth.router import clear_verify_attempts


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clear_rate_limits():
    clear_rate_limits()
    clear_verify_attempts()
    yield
    clear_rate_limits()
    clear_verify_attempts()


@pytest.fixture
def mock_ses():
    """Mock SES client to avoid real AWS calls."""
    with patch("src.services.email_service._get_ses_client") as mock:
        client = MagicMock()
        client.send_email.return_value = {"MessageId": "test-id"}
        mock.return_value = client
        yield client


async def _register_user(client, email="verify@example.com"):
    """Register a user and return (access_token, response)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Securepass1"},
    )
    return resp.json().get("access_token"), resp


# ---------------------------------------------------------------------------
# EmailService unit tests
# ---------------------------------------------------------------------------


class TestEmailService:
    def test_generate_otp_length(self):
        code = generate_otp()
        assert len(code) == 6
        assert code.isdigit()

    def test_generate_otp_custom_length(self):
        code = generate_otp(8)
        assert len(code) == 8

    def test_send_verification_code_success(self, mock_ses):
        svc = EmailService(ses_client=mock_ses)
        result = svc.send_verification_code("test@example.com", "123456")
        assert result is True
        mock_ses.send_email.assert_called_once()
        call_args = mock_ses.send_email.call_args
        assert "123456" in call_args[1]["Message"]["Body"]["Text"]["Data"]

    def test_send_verification_code_failure(self, mock_ses):
        from botocore.exceptions import ClientError

        mock_ses.send_email.side_effect = ClientError(
            {"Error": {"Code": "MessageRejected", "Message": "fail"}}, "SendEmail"
        )
        svc = EmailService(ses_client=mock_ses)
        result = svc.send_verification_code("test@example.com", "123456")
        assert result is False

    def test_send_password_reset_code(self, mock_ses):
        svc = EmailService(ses_client=mock_ses)
        result = svc.send_password_reset_code("test@example.com", "654321")
        assert result is True
        call_args = mock_ses.send_email.call_args
        assert "654321" in call_args[1]["Message"]["Body"]["Text"]["Data"]


# ---------------------------------------------------------------------------
# Verify email endpoint tests
# ---------------------------------------------------------------------------


class TestVerifyEmailEndpoint:
    @pytest.mark.asyncio
    async def test_verify_email_unauthenticated_returns_401(
        self, client, override_get_db
    ):
        resp = await client.post(
            "/api/v1/auth/verify-email", json={"code": "123456"}
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_email_invalid_code_returns_400(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/verify-email",
            json={"code": "000000"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_verify_email_success(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        # Get the stored verification code hash and brute-force isn't needed —
        # we'll directly create a known code
        import jwt as jose_jwt
        from src.config.settings import settings

        payload = jose_jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = uuid.UUID(payload["sub"])

        # Create a known verification code
        known_code = "123456"
        code_hash = _hash_code(known_code)
        vc = EmailVerificationCode(
            user_id=user_id,
            code_hash=code_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db_session.add(vc)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/verify-email",
            json={"code": known_code},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Email verified successfully"

        # Verify user is now marked as verified
        user = await db_session.get(User, user_id)
        assert user.email_verified is True

    @pytest.mark.asyncio
    async def test_verify_email_expired_code_returns_400(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        import jwt as jose_jwt
        from src.config.settings import settings

        payload = jose_jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = uuid.UUID(payload["sub"])

        # Create an expired code
        known_code = "123456"
        vc = EmailVerificationCode(
            user_id=user_id,
            code_hash=_hash_code(known_code),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        db_session.add(vc)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/verify-email",
            json={"code": known_code},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_verify_email_already_verified(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        import jwt as jose_jwt
        from src.config.settings import settings

        payload = jose_jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = uuid.UUID(payload["sub"])

        # Mark user as verified
        user = await db_session.get(User, user_id)
        user.email_verified = True
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/verify-email",
            json={"code": "123456"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Email already verified"

    @pytest.mark.asyncio
    async def test_verify_email_code_format_validation(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        # Non-numeric code
        resp = await client.post(
            "/api/v1/auth/verify-email",
            json={"code": "abcdef"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code in (400, 422)

        # Too short
        resp = await client.post(
            "/api/v1/auth/verify-email",
            json={"code": "123"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_used_code_cannot_be_reused(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        import jwt as jose_jwt
        from src.config.settings import settings

        payload = jose_jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = uuid.UUID(payload["sub"])

        known_code = "123456"
        vc = EmailVerificationCode(
            user_id=user_id,
            code_hash=_hash_code(known_code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            used=True,
        )
        db_session.add(vc)
        await db_session.commit()

        # Reset email_verified to test code reuse
        user = await db_session.get(User, user_id)
        user.email_verified = False
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/verify-email",
            json={"code": known_code},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Resend verification endpoint tests
# ---------------------------------------------------------------------------


class TestResendVerificationEndpoint:
    @pytest.mark.asyncio
    async def test_resend_unauthenticated_returns_401(
        self, client, override_get_db
    ):
        resp = await client.post("/api/v1/auth/resend-verification")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_resend_success(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/resend-verification",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Verification code sent"

    @pytest.mark.asyncio
    async def test_resend_already_verified(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        import jwt as jose_jwt
        from src.config.settings import settings

        payload = jose_jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = uuid.UUID(payload["sub"])

        user = await db_session.get(User, user_id)
        user.email_verified = True
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/resend-verification",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Email already verified"

    @pytest.mark.asyncio
    async def test_resend_rate_limited(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client)
        await db_session.commit()

        import jwt as jose_jwt
        from src.config.settings import settings

        payload = jose_jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = uuid.UUID(payload["sub"])

        # Create 3 recent codes (1 from registration + 2 more = 3 total)
        for _ in range(2):
            vc = EmailVerificationCode(
                user_id=user_id,
                code_hash=_hash_code("000000"),
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            )
            db_session.add(vc)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/resend-verification",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 429


# ---------------------------------------------------------------------------
# Registration sends verification email test
# ---------------------------------------------------------------------------


class TestRegistrationSendsVerification:
    @pytest.mark.asyncio
    async def test_registration_creates_verification_code(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, resp = await _register_user(client, "newuser@example.com")
        assert resp.status_code == 201
        await db_session.commit()

        import jwt as jose_jwt
        from src.config.settings import settings

        payload = jose_jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = uuid.UUID(payload["sub"])

        # Verify a code was created
        stmt = select(EmailVerificationCode).where(
            EmailVerificationCode.user_id == user_id
        )
        result = await db_session.execute(stmt)
        codes = result.scalars().all()
        assert len(codes) >= 1

        # Verify user starts unverified
        user = await db_session.get(User, user_id)
        assert user.email_verified is False

    @pytest.mark.asyncio
    async def test_registration_sends_ses_email(
        self, client, override_get_db, db_session, mock_ses
    ):
        await _register_user(client, "sestest@example.com")
        await db_session.commit()

        # SES send_email should have been called
        assert mock_ses.send_email.called


# ---------------------------------------------------------------------------
# OTP storage security test
# ---------------------------------------------------------------------------


class TestOTPSecurity:
    @pytest.mark.asyncio
    async def test_otp_stored_as_hash_not_plaintext(
        self, client, override_get_db, db_session, mock_ses
    ):
        token, _ = await _register_user(client, "security@example.com")
        await db_session.commit()

        import jwt as jose_jwt
        from src.config.settings import settings

        payload = jose_jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = uuid.UUID(payload["sub"])

        stmt = select(EmailVerificationCode).where(
            EmailVerificationCode.user_id == user_id
        )
        result = await db_session.execute(stmt)
        code = result.scalars().first()

        # The stored hash should NOT be a 6-digit number
        assert code is not None
        assert not code.code_hash.isdigit()
        assert len(code.code_hash) > 6
        # Should be a bcrypt hash
        assert code.code_hash.startswith("$2")


# ---------------------------------------------------------------------------
# Freemium gate email verification check
# ---------------------------------------------------------------------------


class TestFreemiumGateEmailVerification:
    @pytest.mark.asyncio
    async def test_unverified_user_blocked_from_premium(
        self, client, override_get_db, db_session, mock_ses
    ):
        """Unverified users should be blocked from premium endpoints."""
        token, _ = await _register_user(client, "unverified@example.com")
        await db_session.commit()

        # Try accessing a premium endpoint (dietary analysis gaps is premium-gated)
        resp = await client.get(
            "/api/v1/dietary/gaps",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Should be 403 (premium required) because email not verified
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Password reset OTP tests
# ---------------------------------------------------------------------------


class TestForgotPasswordSendsOTP:
    @pytest.mark.asyncio
    async def test_forgot_password_sends_otp_email(
        self, client, override_get_db, db_session, mock_ses
    ):
        """forgot-password should create a reset code and send email via SES."""
        await _register_user(client, "reset@example.com")
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "reset@example.com"},
        )
        assert resp.status_code == 200
        assert "reset code" in resp.json()["message"]

        # SES should have been called (once for registration verification, once for reset)
        assert mock_ses.send_email.call_count >= 2

        # A PasswordResetCode should exist
        stmt = select(PasswordResetCode)
        result = await db_session.execute(stmt)
        codes = result.scalars().all()
        assert len(codes) >= 1

    @pytest.mark.asyncio
    async def test_forgot_password_nonexistent_email_still_200(
        self, client, override_get_db, db_session, mock_ses
    ):
        """Should return 200 even for unknown emails to prevent enumeration."""
        resp = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nobody@example.com"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_forgot_password_stores_hash_not_plaintext(
        self, client, override_get_db, db_session, mock_ses
    ):
        await _register_user(client, "hashcheck@example.com")
        await db_session.commit()

        await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "hashcheck@example.com"},
        )
        await db_session.commit()

        stmt = select(PasswordResetCode)
        result = await db_session.execute(stmt)
        code = result.scalars().first()
        assert code is not None
        assert not code.code_hash.isdigit()
        assert code.code_hash.startswith("$2")


class TestResetPasswordWithOTP:
    @pytest.mark.asyncio
    async def test_reset_password_success(
        self, client, override_get_db, db_session, mock_ses
    ):
        """Valid OTP + email should reset the password."""
        await _register_user(client, "resetok@example.com")
        await db_session.commit()

        # Find the user
        stmt = select(User).where(User.email == "resetok@example.com")
        result = await db_session.execute(stmt)
        user = result.scalar_one()

        # Create a known reset code
        known_code = "654321"
        rc = PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_code(known_code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db_session.add(rc)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "resetok@example.com",
                "code": known_code,
                "new_password": "NewSecure1",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Password has been reset"

        # Mark user as verified so login works
        await db_session.refresh(user)
        user.email_verified = True
        await db_session.commit()

        # Verify login works with new password
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "resetok@example.com", "password": "NewSecure1"},
        )
        assert login_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_reset_password_invalid_code_returns_400(
        self, client, override_get_db, db_session, mock_ses
    ):
        await _register_user(client, "badcode@example.com")
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "badcode@example.com",
                "code": "000000",
                "new_password": "NewSecure1",
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reset_password_expired_code_returns_400(
        self, client, override_get_db, db_session, mock_ses
    ):
        await _register_user(client, "expired@example.com")
        await db_session.commit()

        stmt = select(User).where(User.email == "expired@example.com")
        result = await db_session.execute(stmt)
        user = result.scalar_one()

        known_code = "654321"
        rc = PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_code(known_code),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        db_session.add(rc)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "expired@example.com",
                "code": known_code,
                "new_password": "NewSecure1",
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reset_password_used_code_returns_400(
        self, client, override_get_db, db_session, mock_ses
    ):
        await _register_user(client, "usedcode@example.com")
        await db_session.commit()

        stmt = select(User).where(User.email == "usedcode@example.com")
        result = await db_session.execute(stmt)
        user = result.scalar_one()

        known_code = "654321"
        rc = PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_code(known_code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            used=True,
        )
        db_session.add(rc)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "usedcode@example.com",
                "code": known_code,
                "new_password": "NewSecure1",
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reset_password_wrong_email_returns_400(
        self, client, override_get_db, db_session, mock_ses
    ):
        """Code valid for one user should not work with a different email."""
        await _register_user(client, "real@example.com")
        await db_session.commit()

        stmt = select(User).where(User.email == "real@example.com")
        result = await db_session.execute(stmt)
        user = result.scalar_one()

        known_code = "654321"
        rc = PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_code(known_code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db_session.add(rc)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "wrong@example.com",
                "code": known_code,
                "new_password": "NewSecure1",
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reset_password_code_marked_used_after_success(
        self, client, override_get_db, db_session, mock_ses
    ):
        await _register_user(client, "markused@example.com")
        await db_session.commit()

        stmt = select(User).where(User.email == "markused@example.com")
        result = await db_session.execute(stmt)
        user = result.scalar_one()

        known_code = "654321"
        rc = PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_code(known_code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db_session.add(rc)
        await db_session.commit()

        # First reset succeeds
        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "markused@example.com",
                "code": known_code,
                "new_password": "NewSecure1",
            },
        )
        assert resp.status_code == 200

        # Second attempt with same code fails
        resp2 = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "markused@example.com",
                "code": known_code,
                "new_password": "AnotherPass1",
            },
        )
        assert resp2.status_code == 400

    @pytest.mark.asyncio
    async def test_reset_password_code_format_validation(
        self, client, override_get_db, db_session, mock_ses
    ):
        """Non-numeric or wrong-length codes should be rejected by schema."""
        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "test@example.com",
                "code": "abcdef",
                "new_password": "NewSecure1",
            },
        )
        assert resp.status_code in (400, 422)

        resp2 = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": "test@example.com",
                "code": "123",
                "new_password": "NewSecure1",
            },
        )
        assert resp2.status_code in (400, 422)
