# OWNER: agent auth-users
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import DbSession
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
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Not implemented")
