from __future__ import annotations

import logging
import traceback
import uuid

from fastapi import HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger("app.errors")

_STATUS_DEFAULT_CODES: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_422_UNPROCESSABLE_CONTENT: "VALIDATION_ERROR",
    status.HTTP_503_SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
}

_MESSAGE_CODES: dict[str, str] = {
    "Invalid username or password": "INVALID_CREDENTIALS",
    "Not authenticated": "NOT_AUTHENTICATED",
    "Invalid authentication credentials": "INVALID_CREDENTIALS",
    "User account is inactive": "USER_INACTIVE",
    "Insufficient permissions": "FORBIDDEN",
    "Organization required": "ORGANIZATION_REQUIRED",
    "Username is already taken globally": "USERNAME_TAKEN",
    "Retailer username is already taken globally": "USERNAME_TAKEN",
}


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4())[:8])
    if exc.status_code >= 500:
        logger.error(
            "HTTP %s %s [%s] %s: %s",
            request.method,
            request.url.path,
            request_id,
            exc.status_code,
            exc.detail,
        )

    code = _STATUS_DEFAULT_CODES.get(exc.status_code, "HTTP_ERROR")
    message = "Request failed"
    details = None

    if isinstance(exc.detail, dict):
        code = exc.detail.get("code") or code
        message = exc.detail.get("message") or str(exc.detail)
        details = exc.detail.get("details")
        if details is None:
            filtered = exc.detail.copy()
            filtered.pop("code", None)
            filtered.pop("message", None)
            details = filtered or None
    elif isinstance(exc.detail, str):
        message = exc.detail
        code = _MESSAGE_CODES.get(exc.detail, code)

    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details

    return JSONResponse(
        status_code=exc.status_code,
        content=body,
        headers=exc.headers,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4())[:8])
    logger.warning(
        "Validation error %s %s [%s]: %s",
        request.method,
        request.url.path,
        request_id,
        exc.errors(),
    )
    body = {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Validation failed",
            "details": exc.errors(),
        }
    }
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=jsonable_encoder(body)
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4())[:8])
    msg_lower = str(exc).lower()
    # Deadlocks and serialization failures are retryable — surface as 409 so clients can retry
    if "deadlock" in msg_lower or "serialization" in msg_lower:
        logger.warning(
            "Retryable DB deadlock %s %s [%s]: %s",
            request.method,
            request.url.path,
            request_id,
            str(exc),
        )
        body = {"error": {"code": "CONFLICT", "message": "Concurrent update conflict, please retry"}}
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=body)
        
    logger.error(
        "Database error %s %s [%s]: %s\n%s",
        request.method,
        request.url.path,
        request_id,
        str(exc),
        traceback.format_exc(),
    )
    body = {"error": {"code": "DATABASE_ERROR", "message": "A database error occurred. Please try again."}}
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4())[:8])
    logger.error(
        "Unhandled error %s %s [%s]: %s\n%s",
        request.method,
        request.url.path,
        request_id,
        str(exc),
        traceback.format_exc(),
    )
    body = {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred. Please try again."}}
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body)
