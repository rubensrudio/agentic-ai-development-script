from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User
from contracts.permissions import ALL_SCOPES, Action, Module, scope

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", scopes=ALL_SCOPES)

DbSession = Annotated[Session, Depends(get_db)]


def _unauthorized(detail: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    security_scopes: SecurityScopes,
    db: DbSession,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    """Resolve the bearer token to an active user.

    Permissions are re-read from the database on every request, so revoking a
    permission or deactivating a user takes effect immediately; the scopes in
    the token are informational.
    """
    try:
        payload = decode_access_token(token)
        user_id = int(str(payload["sub"]))
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise _unauthorized() from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _unauthorized()
    for required in security_scopes.scopes:
        module_name, action_name = required.split(":")
        if not user.has_permission(Module(module_name), Action(action_name)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
            )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_permission(module: Module, action: Action) -> Callable[..., User]:
    """Dependency factory: ``user: Annotated[User, Depends(require_permission(...))]``.

    401 when unauthenticated, 403 when the user lacks the permission.
    """

    def dependency(
        user: Annotated[User, Security(get_current_user, scopes=[scope(module, action)])],
    ) -> User:
        return user

    return dependency
