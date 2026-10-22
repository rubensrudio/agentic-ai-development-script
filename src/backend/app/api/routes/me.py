# OWNER: agent auth-users
from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from contracts.schemas import ErrorResponse, MeRead, PasswordChange

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=MeRead)
def read_me(user: CurrentUser) -> MeRead:
    """Current user with effective scopes. Any authenticated active user."""
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Not implemented")


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={400: {"model": ErrorResponse}},
)
def change_password(body: PasswordChange, user: CurrentUser, db: DbSession) -> None:
    """Change own password. 400 ``Current password is incorrect``."""
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Not implemented")
