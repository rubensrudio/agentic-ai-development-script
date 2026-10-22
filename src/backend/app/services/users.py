"""User business rules: authentication, listing, CRUD and privilege guards."""

from collections.abc import Sequence
from functools import cache

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models import User, UserPermission
from contracts.permissions import Module
from contracts.schemas import ModulePermissions, PasswordChange, UserCreate, UserUpdate

PERMISSION_FLAGS = ("can_list", "can_create", "can_update", "can_delete")

# Unique indexes on ``users`` (see the initial migration) and their 409 messages.
UNIQUE_CONFLICTS = {
    "ix_users_username": "Username already registered",
    "ix_users_email": "Email already registered",
}


def _error(code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


@cache
def _dummy_hash() -> str:
    return hash_password("dummy-password-for-timing")


# --- Authentication ---------------------------------------------------------


def authenticate(db: Session, username: str, password: str) -> User | None:
    """Return the active user matching the credentials, or ``None``.

    Unknown users still pay for a hash verification so response time doesn't
    reveal which accounts exist.
    """
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        verify_password(password, _dummy_hash())
        return None
    if not verify_password(password, user.hashed_password) or not user.is_active:
        return None
    return user


def change_password(db: Session, user: User, body: PasswordChange) -> None:
    if not verify_password(body.current_password, user.hashed_password):
        raise _error(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    db.commit()


# --- Queries ----------------------------------------------------------------


def _search_filter(q: str) -> ColumnElement[bool]:
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    return or_(
        User.username.ilike(pattern, escape="\\"),
        User.email.ilike(pattern, escape="\\"),
        User.full_name.ilike(pattern, escape="\\"),
    )


def list_users(db: Session, page: int, size: int, q: str | None) -> tuple[Sequence[User], int]:
    """Return ``(users of the page, total matching)``, ordered by id."""
    stmt = select(User)
    count_stmt = select(func.count()).select_from(User)
    if q:
        stmt = stmt.where(_search_filter(q))
        count_stmt = count_stmt.where(_search_filter(q))
    total = db.scalar(count_stmt) or 0
    users = db.scalars(stmt.order_by(User.id).offset((page - 1) * size).limit(size)).all()
    return users, total


def get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise _error(status.HTTP_404_NOT_FOUND, "User not found")
    return user


# --- Guards -----------------------------------------------------------------


def _check_unique_modules(permissions: list[ModulePermissions]) -> None:
    modules = [p.module for p in permissions]
    if len(modules) != len(set(modules)):
        raise _error(status.HTTP_422_UNPROCESSABLE_CONTENT, "Duplicate module in permissions")


def _grants_anything(permissions: list[ModulePermissions]) -> bool:
    return any(getattr(p, flag) for p in permissions for flag in PERMISSION_FLAGS)


def _check_unique_username(db: Session, username: str) -> None:
    if db.scalar(select(User.id).where(User.username == username)) is not None:
        raise _error(status.HTTP_409_CONFLICT, "Username already registered")


def _check_unique_email(db: Session, email: str, exclude_id: int | None = None) -> None:
    stmt = select(User.id).where(User.email == email)
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise _error(status.HTTP_409_CONFLICT, "Email already registered")


def _forbidden_permissions() -> HTTPException:
    return _error(status.HTTP_403_FORBIDDEN, "Only admins can manage permissions")


def _forbidden_admin_target() -> HTTPException:
    return _error(status.HTTP_403_FORBIDDEN, "Only admins can manage admin users")


# --- Mutations --------------------------------------------------------------


def _commit_or_conflict(db: Session) -> None:
    """Commit, turning a unique-index race on username/email into a 409.

    The pre-checks catch duplicates in the common case; this covers two
    requests passing them concurrently.
    """
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        diag = getattr(exc.orig, "diag", None)
        constraint = getattr(diag, "constraint_name", None) or ""
        detail = UNIQUE_CONFLICTS.get(constraint)
        if detail is None:
            raise
        raise _error(status.HTTP_409_CONFLICT, detail) from None


def _replace_permissions(user: User, permissions: list[ModulePermissions]) -> None:
    """Make ``user``'s matrix exactly ``permissions``; absent modules lose every flag.

    Existing rows are updated in place (rather than replaced) so the
    ``(user_id, module)`` unique constraint never sees two rows at flush time.
    """
    wanted = {p.module.value: p for p in permissions}
    existing = {row.module: row for row in user.permission_rows}
    for module in Module:
        spec = wanted.get(module.value)
        row = existing.get(module.value)
        if spec is None:
            if row is not None:
                user.permission_rows.remove(row)
            continue
        if row is None:
            row = UserPermission(module=module.value)
            user.permission_rows.append(row)
        for flag in PERMISSION_FLAGS:
            setattr(row, flag, getattr(spec, flag))


def create_user(db: Session, actor: User, body: UserCreate) -> User:
    if not actor.is_admin and (body.is_admin or _grants_anything(body.permissions)):
        raise _forbidden_permissions()
    _check_unique_modules(body.permissions)
    _check_unique_username(db, body.username)
    _check_unique_email(db, body.email)

    user = User(
        username=body.username,
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        is_active=body.is_active,
        is_admin=body.is_admin,
    )
    _replace_permissions(user, body.permissions)
    db.add(user)
    _commit_or_conflict(db)
    db.refresh(user)
    return user


def update_user(db: Session, actor: User, user_id: int, body: UserUpdate) -> User:
    if not actor.is_admin and body.model_fields_set & {"is_admin", "permissions"}:
        raise _forbidden_permissions()
    if body.permissions is not None:
        _check_unique_modules(body.permissions)
    target = get_user(db, user_id)
    if target.is_admin and not actor.is_admin:
        raise _forbidden_admin_target()
    if target.id == actor.id and (body.is_active is False or body.is_admin is False):
        raise _error(status.HTTP_400_BAD_REQUEST, "You cannot deactivate or demote yourself")
    if body.email is not None and body.email != target.email:
        _check_unique_email(db, body.email, exclude_id=target.id)

    if body.email is not None:
        target.email = body.email
    if body.full_name is not None:
        target.full_name = body.full_name
    if body.is_active is not None:
        target.is_active = body.is_active
    if body.is_admin is not None:
        target.is_admin = body.is_admin
    if body.password is not None:
        target.hashed_password = hash_password(body.password)
    if body.permissions is not None:
        _replace_permissions(target, body.permissions)
    _commit_or_conflict(db)
    db.refresh(target)
    return target


def delete_user(db: Session, actor: User, user_id: int) -> None:
    target = get_user(db, user_id)
    if target.id == actor.id:
        raise _error(status.HTTP_400_BAD_REQUEST, "You cannot delete yourself")
    if target.is_admin and not actor.is_admin:
        raise _forbidden_admin_target()
    db.delete(target)
    db.commit()
