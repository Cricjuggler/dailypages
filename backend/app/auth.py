"""Clerk JWT verification.

Clerk signs session tokens with RS256 keys exposed via JWKS. We fetch and cache
the JWKS, verify signature + standard claims, and resolve to a local User row.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

import httpx
from fastapi import Depends, Header, HTTPException, status
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import User

_JWKS_CACHE: dict[str, tuple[float, dict]] = {}
_JWKS_TTL_SEC = 60 * 60  # 1h


async def _get_jwks(url: str) -> dict:
    cached = _JWKS_CACHE.get(url)
    now = time.time()
    if cached and now - cached[0] < _JWKS_TTL_SEC:
        return cached[1]
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()
    _JWKS_CACHE[url] = (now, data)
    return data


@dataclass
class ClerkClaims:
    sub: str
    email: str | None
    name: str | None
    raw: dict


async def _verify_token(token: str, settings: Settings) -> ClerkClaims:
    if not settings.auth_configured:
        raise HTTPException(status_code=503, detail="Auth not configured")

    try:
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
    except JWTError as e:
        raise HTTPException(status_code=401, detail="Malformed token") from e

    jwks = await _get_jwks(settings.clerk_jwks_url)  # type: ignore[arg-type]
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not key:
        # JWKS may have rotated — refetch once.
        _JWKS_CACHE.pop(settings.clerk_jwks_url, None)  # type: ignore[arg-type]
        jwks = await _get_jwks(settings.clerk_jwks_url)  # type: ignore[arg-type]
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not key:
        raise HTTPException(status_code=401, detail="Signing key not found")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=[key.get("alg", "RS256")],
            issuer=settings.clerk_issuer,
            audience=settings.clerk_audience or None,
            options={"verify_aud": bool(settings.clerk_audience)},
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e

    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject")

    return ClerkClaims(
        sub=sub,
        email=claims.get("email"),
        name=claims.get("name") or claims.get("first_name"),
        raw=claims,
    )


async def _fetch_clerk_user(user_id: str, secret_key: str) -> dict:
    """Fetch user details from Clerk's Backend API. Returns {email, name}."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {secret_key}"},
        )
        r.raise_for_status()
        data = r.json()

    # Pick the primary email address — Clerk users can have multiple.
    email = None
    primary_id = data.get("primary_email_address_id")
    for addr in data.get("email_addresses", []) or []:
        if addr.get("id") == primary_id:
            email = addr.get("email_address")
            break
    if not email and data.get("email_addresses"):
        email = data["email_addresses"][0].get("email_address")

    name_parts = [data.get("first_name"), data.get("last_name")]
    name = " ".join(p for p in name_parts if p) or data.get("username")
    return {"email": email, "name": name}


async def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_session),
) -> User:
    """Verify the bearer token and return (or upsert) the matching User row."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    claims = await _verify_token(token, settings)

    result = await db.execute(select(User).where(User.clerk_user_id == claims.sub))
    user = result.scalar_one_or_none()
    if user is None:
        email = claims.email
        name = claims.name
        # Clerk's default session JWT only carries `sub`. Fall back to the
        # Backend API for email/name on first sign-in.
        if not email and settings.clerk_secret_key:
            try:
                fetched = await _fetch_clerk_user(claims.sub, settings.clerk_secret_key)
                email = email or fetched.get("email")
                name = name or fetched.get("name")
            except Exception as e:
                raise HTTPException(
                    status_code=502, detail=f"Clerk user lookup failed: {e}"
                ) from e
        if not email:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cannot determine user email — set CLERK_SECRET_KEY in backend/.env "
                    "so the API can fetch it from Clerk."
                ),
            )
        user = User(clerk_user_id=claims.sub, email=email, name=name)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user
