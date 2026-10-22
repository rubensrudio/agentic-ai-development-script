# OWNER: agent auth-users
from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.services import users as users_service
from contracts.schemas import ErrorResponse, MeRead, PasswordChange

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=MeRead)
def read_me(user: CurrentUser) -> MeRead:
    """Current user with effective scopes. Any authenticated active user."""
    return MeRead.model_validate(user)


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={400: {"model": ErrorResponse}},
)
def change_password(body: PasswordChange, user: CurrentUser, db: DbSession) -> None:
    """Change own password. 400 ``Current password is incorrect``."""
    users_service.change_password(db, user, body)
