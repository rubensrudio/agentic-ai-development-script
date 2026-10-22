# OWNER: agent companies
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DbSession, require_permission
from app.models import User
from app.services import companies as service
from contracts.permissions import Action, Module
from contracts.schemas import (
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
    CompanyCreate,
    CompanyPage,
    CompanyRead,
    CompanyUpdate,
    ErrorResponse,
)

router = APIRouter(prefix="/companies", tags=["companies"])

ERRORS: dict[int | str, dict[str, Any]] = {
    403: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
}


@router.get("", response_model=CompanyPage)
def list_companies(
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.COMPANIES, Action.LIST))],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_DEFAULT,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> CompanyPage:
    """Ordered by name, then id. ``q`` matches name, legal_name or tax_id (ILIKE)."""
    return service.list_companies(db, page, size, q)


@router.post(
    "",
    response_model=CompanyRead,
    status_code=status.HTTP_201_CREATED,
    responses={403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
def create_company(
    body: CompanyCreate,
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.COMPANIES, Action.CREATE))],
) -> CompanyRead:
    """Sets created_by_id to the current user. 409 ``Tax ID already registered``."""
    return CompanyRead.model_validate(service.create_company(db, body, user))


@router.get("/{company_id}", response_model=CompanyRead, responses=ERRORS)
def get_company(
    company_id: int,
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.COMPANIES, Action.LIST))],
) -> CompanyRead:
    return CompanyRead.model_validate(service.get_company(db, company_id))


@router.patch(
    "/{company_id}",
    response_model=CompanyRead,
    responses={**ERRORS, 409: {"model": ErrorResponse}},
)
def update_company(
    company_id: int,
    body: CompanyUpdate,
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.COMPANIES, Action.UPDATE))],
) -> CompanyRead:
    return CompanyRead.model_validate(service.update_company(db, company_id, body))


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT, responses=ERRORS)
def delete_company(
    company_id: int,
    db: DbSession,
    user: Annotated[User, Depends(require_permission(Module.COMPANIES, Action.DELETE))],
) -> None:
    """Hard delete."""
    service.delete_company(db, company_id)
