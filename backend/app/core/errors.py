from __future__ import annotations

import logging
import traceback
import uuid

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger("app.errors")


class APIErrorDetail(BaseModel):
    code: str
    message: str
    details: dict | list | None = None


class APIErrorResponse(BaseModel):
    error: APIErrorDetail


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


def error_code_for_http_exception(exc: HTTPException) -> str:
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code")
        if isinstance(code, str) and code:
            return code
    if isinstance(exc.detail, str):
        return _MESSAGE_CODES.get(
            exc.detail, _STATUS_DEFAULT_CODES.get(exc.status_code, "HTTP_ERROR")
        )
    return _STATUS_DEFAULT_CODES.get(exc.status_code, "HTTP_ERROR")


def error_message_for_http_exception(exc: HTTPException) -> str:
    if isinstance(exc.detail, str):
        return exc.detail
    if isinstance(exc.detail, dict):
        message = exc.detail.get("message")
        if isinstance(message, str) and message:
            return message
        return str(exc.detail)
    return "Request failed"


def error_details_for_http_exception(exc: HTTPException) -> dict | list | None:
    if isinstance(exc.detail, dict):
        details = exc.detail.get("details")
        if details is not None:
            return details
        filtered = exc.detail.copy()
        filtered.pop("code", None)
        filtered.pop("message", None)
        return filtered or None
    return None


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
    body = APIErrorResponse(
        error=APIErrorDetail(
            code=error_code_for_http_exception(exc),
            message=error_message_for_http_exception(exc),
            details=error_details_for_http_exception(exc),
        )
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=body.model_dump(exclude_none=True),
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
    details = exc.errors()
    body = APIErrorResponse(
        error=APIErrorDetail(
            code="VALIDATION_ERROR",
            message="Validation failed",
            details=details,  # type: ignore[arg-type]
        )
    )
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content=body.model_dump(exclude_none=True))


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
        body = APIErrorResponse(
            error=APIErrorDetail(
                code="CONFLICT",
                message="Concurrent update conflict, please retry",
            )
        )
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=body.model_dump(exclude_none=True))
    logger.error(
        "Database error %s %s [%s]: %s\n%s",
        request.method,
        request.url.path,
        request_id,
        str(exc),
        traceback.format_exc(),
    )
    body = APIErrorResponse(
        error=APIErrorDetail(
            code="DATABASE_ERROR",
            message="A database error occurred. Please try again.",
        )
    )
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body.model_dump(exclude_none=True))


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
    body = APIErrorResponse(
        error=APIErrorDetail(
            code="INTERNAL_ERROR",
            message="An unexpected error occurred. Please try again.",
        )
    )
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body.model_dump(exclude_none=True))
