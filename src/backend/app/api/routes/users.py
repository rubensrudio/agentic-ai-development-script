# OWNER: agent auth-users
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DbSession, require_permission
from app.models import User
from app.services import users as users_service
from contracts.permissions import Action, Module
from contracts.schemas import (
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
    ErrorResponse,
    UserCreate,
    UserPage,
    UserRead,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])

ERRORS: dict[int | str, dict[str, Any]] = {
    403: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
}


@router.get("", response_model=UserPage)
def list_users(
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.USERS, Action.LIST))],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_DEFAULT,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> UserPage:
    """Ordered by id. ``q`` matches username, email or full_name (ILIKE)."""
    items, total = users_service.list_users(db, page, size, q)
    return UserPage(
        items=[UserRead.model_validate(u) for u in items], total=total, page=page, size=size
    )


@router.post(
    "",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    responses={403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
def create_user(
    body: UserCreate,
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.USERS, Action.CREATE))],
) -> UserRead:
    """409 ``Username already registered`` / ``Email already registered``."""
    return UserRead.model_validate(users_service.create_user(db, user, body))


@router.get("/{user_id}", response_model=UserRead, responses=ERRORS)
def get_user(
    user_id: int,
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.USERS, Action.LIST))],
) -> UserRead:
    return UserRead.model_validate(users_service.get_user(db, user_id))


@router.patch(
    "/{user_id}",
    response_model=UserRead,
    responses={**ERRORS, 409: {"model": ErrorResponse}},
)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.USERS, Action.UPDATE))],
) -> UserRead:
    """Non-admins cannot modify admin users nor send is_admin/permissions (403).
    Nobody can deactivate or demote themselves (400)."""
    return UserRead.model_validate(users_service.update_user(db, user, user_id, body))


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ERRORS, 400: {"model": ErrorResponse}},
)
def delete_user(
    user_id: int,
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.USERS, Action.DELETE))],
) -> None:
    """400 ``You cannot delete yourself``. Non-admins cannot delete admins (403)."""
    users_service.delete_user(db, user, user_id)
