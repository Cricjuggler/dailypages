"""Cloudflare R2 (S3-compatible) helpers — presigned uploads and downloads."""
from __future__ import annotations

from functools import lru_cache

import boto3
from botocore.client import Config

from app.config import Settings, get_settings


@lru_cache
def get_s3_client():
    settings = get_settings()
    if not settings.storage_configured:
        return None
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def presigned_put(key: str, content_type: str, expires: int = 900) -> str:
    """Return a presigned URL the client can PUT directly to R2."""
    client = get_s3_client()
    if client is None:
        raise RuntimeError("R2 not configured")
    settings: Settings = get_settings()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
        HttpMethod="PUT",
    )


def presigned_get(key: str, expires: int = 900) -> str:
    client = get_s3_client()
    if client is None:
        raise RuntimeError("R2 not configured")
    settings: Settings = get_settings()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket, "Key": key},
        ExpiresIn=expires,
    )
