"""Tests for sensitive data redaction and security masking."""

from selfheal_agent.utils.redaction import redact_sensitive_data


def test_redact_bearer_token() -> None:
    raw = "Request failed with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz"
    sanitized = redact_sensitive_data(raw)
    assert "Bearer [REDACTED_TOKEN]" in sanitized
    assert "eyJhbGci" not in sanitized


def test_redact_password_and_secret() -> None:
    raw = 'DB_PASSWORD: "SuperSecret123!" and secret=\'MySecretPass\''
    sanitized = redact_sensitive_data(raw)
    assert "SuperSecret123!" not in sanitized
    assert "MySecretPass" not in sanitized
    assert "[REDACTED]" in sanitized


def test_redact_captone_token() -> None:
    raw = "Failed handshake with token cap_live_9876543210abcdef"
    sanitized = redact_sensitive_data(raw)
    assert "cap_[REDACTED]" in sanitized
    assert "9876543210" not in sanitized


def test_redact_aws_access_key() -> None:
    raw = "Uploaded artifact using AKIAIOSFODNN7EXAMPLE key"
    sanitized = redact_sensitive_data(raw)
    assert "[REDACTED_AWS_KEY]" in sanitized
    assert "AKIAIOSFODNN7EXAMPLE" not in sanitized


def test_clean_string_remains_unchanged() -> None:
    raw = "Normal pod startup initialized on node-worker-1"
    assert redact_sensitive_data(raw) == raw
