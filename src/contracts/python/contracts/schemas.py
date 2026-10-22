"""Request/response schemas for the HTTP API (all routes under ``/api``).

Rules that every implementation must honor are documented on each schema and
in ``src/contracts/README.md``.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from contracts.permissions import Module

USERNAME_PATTERN = r"^[a-zA-Z0-9_.-]+$"
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 100


class ErrorResponse(BaseModel):
    detail: str


class HealthRead(BaseModel):
    status: Literal["ok"] = "ok"


# --- Auth -------------------------------------------------------------------


class Token(BaseModel):
    """Response of ``POST /api/auth/token`` (OAuth2 password flow, form-encoded)."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Lifetime of the access token in seconds.")


class PasswordChange(BaseModel):
    """Body of ``POST /api/me/password``. Returns 204; 400 if current_password is wrong."""

    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)


# --- Permissions ------------------------------------------------------------


class ModulePermissions(BaseModel):
    """Permission flags of one user for one module."""

    model_config = ConfigDict(from_attributes=True)

    module: Module
    can_list: bool = False
    can_create: bool = False
    can_update: bool = False
    can_delete: bool = False


# --- Users ------------------------------------------------------------------


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    is_active: bool = True


class UserCreate(UserBase):
    """Body of ``POST /api/users``.

    ``is_admin`` and ``permissions`` may only be set by admins; a non-admin
    sending ``is_admin=true`` or any granted flag gets 403.
    """

    username: str = Field(min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    is_admin: bool = False
    permissions: list[ModulePermissions] = Field(default_factory=list)


class UserUpdate(BaseModel):
    """Body of ``PATCH /api/users/{user_id}``; only fields sent are changed.

    ``username`` is immutable. ``password`` is an admin-style reset (no current
    password needed). ``permissions`` replaces the whole matrix when sent.
    A non-admin sending ``is_admin`` or ``permissions`` at all gets 403.
    """

    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None
    is_admin: bool | None = None
    password: str | None = Field(
        default=None, min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )
    permissions: list[ModulePermissions] | None = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_admin: bool
    permissions: list[ModulePermissions] = Field(
        description="One entry per Module, in Module order; missing rows are all-false."
    )
    created_at: datetime
    updated_at: datetime


class MeRead(UserRead):
    """Response of ``GET /api/me``: the current user plus effective scopes."""

    scopes: list[str] = Field(
        description="Effective scopes, e.g. ['companies:list']. Admins get every scope."
    )


# --- Companies --------------------------------------------------------------


class CompanyBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    legal_name: str | None = Field(default=None, max_length=200)
    tax_id: str = Field(min_length=1, max_length=32, description="Unique across companies.")
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=255)
    is_active: bool = True


class CompanyCreate(CompanyBase):
    """Body of ``POST /api/companies``. 409 if tax_id already exists."""


class CompanyUpdate(BaseModel):
    """Body of ``PATCH /api/companies/{company_id}``; only fields sent are changed."""

    name: str | None = Field(default=None, min_length=1, max_length=150)
    legal_name: str | None = Field(default=None, max_length=200)
    tax_id: str | None = Field(default=None, min_length=1, max_length=32)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class CompanyRead(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by_id: int | None
    created_at: datetime
    updated_at: datetime


# --- Pagination -------------------------------------------------------------


class Page[T](BaseModel):
    """List response. Query params: ``page`` (>=1, default 1), ``size``
    (1..100, default 20), ``q`` (optional case-insensitive search)."""

    items: list[T]
    total: int
    page: int
    size: int


class UserPage(Page[UserRead]):
    pass


class CompanyPage(Page[CompanyRead]):
    pass
