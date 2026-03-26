"""Lifecycle test fixtures — auto-mock SES to avoid real AWS calls."""

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def mock_ses():
    """Mock SES client for all lifecycle tests to prevent real AWS calls."""
    with patch("src.services.email_service._get_ses_client") as mock:
        client = MagicMock()
        client.send_email.return_value = {"MessageId": "test-lifecycle-id"}
        mock.return_value = client
        yield client
