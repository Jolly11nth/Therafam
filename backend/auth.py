from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException

from .db import execute, one

SESSION_DAYS = 30


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt$16384$8$1${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt_hex, digest_hex = encoded.split("$")
        if algorithm != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt_hex),
            n=int(n),
            r=int(r),
            p=int(p),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def issue_session(user_id: str) -> str:
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    execute(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
        (user_id, token_hash, expires_at),
    )
    return raw_token


def revoke_session(raw_token: str) -> None:
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    execute("UPDATE user_sessions SET revoked_at = NOW() WHERE token_hash = %s", (token_hash,))


def user_from_token(raw_token: str) -> dict | None:
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return one(
        """
        SELECT u.id, u.email, u.user_type, u.is_verified, u.is_active
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = %s
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND u.is_active = TRUE
        """,
        (token_hash,),
    )


def current_user(
    authorization: str | None = Header(default=None),
    x_therafam_user_id: str | None = Header(default=None, alias="X-Therafam-User-Id"),
) -> dict:
    if authorization and authorization.lower().startswith("bearer "):
        user = user_from_token(authorization.split(" ", 1)[1].strip())
        if user:
            return user
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    # Temporary compatibility for the existing UI while it is being migrated.
    if x_therafam_user_id:
        user = one(
            "SELECT id, email, user_type, is_verified, is_active FROM users WHERE id = %s AND is_active = TRUE",
            (x_therafam_user_id,),
        )
        if user:
            return user

    raise HTTPException(status_code=401, detail="Missing user session")
