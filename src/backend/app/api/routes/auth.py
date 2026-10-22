# OWNER: agent auth-users
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import DbSession
from app.core.security import create_access_token
from app.services import users as users_service
from contracts.schemas import ErrorResponse, Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/token",
    response_model=Token,
    responses={401: {"model": ErrorResponse}},
)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession) -> Token:
    """OAuth2 password flow. 401 ``Incorrect username or password`` (with
    ``WWW-Authenticate: Bearer``) for unknown user, wrong password or inactive
    user. The token carries the user's effective scopes; requested
    ``form.scopes`` are ignored."""
    user = users_service.authenticate(db, form.username, form.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token, expires_in = create_access_token(user.id, user.scopes)
    return Token(access_token=access_token, expires_in=expires_in)
