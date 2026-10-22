# OWNER: agent companies
"""Business rules and queries for companies."""

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Company, User
from contracts.schemas import CompanyCreate, CompanyPage, CompanyRead, CompanyUpdate

COMPANY_NOT_FOUND = "Company not found"
TAX_ID_TAKEN = "Tax ID already registered"
TAX_ID_BLANK = "Tax ID cannot be blank"

# Columns that are NOT NULL in the database; an explicit null in a PATCH body is rejected.
_REQUIRED_FIELDS = ("name", "tax_id", "is_active")


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _normalize_tax_id(tax_id: str) -> str:
    normalized = tax_id.strip()
    if not normalized:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, TAX_ID_BLANK)
    return normalized


def _ensure_tax_id_available(db: Session, tax_id: str, exclude_id: int | None = None) -> None:
    stmt = select(Company.id).where(Company.tax_id == tax_id)
    if exclude_id is not None:
        stmt = stmt.where(Company.id != exclude_id)
    if db.scalar(stmt.limit(1)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, TAX_ID_TAKEN)


def _commit(db: Session) -> None:
    """Commit, mapping a concurrent tax_id unique violation to 409."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, TAX_ID_TAKEN) from None


def get_company(db: Session, company_id: int) -> Company:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, COMPANY_NOT_FOUND)
    return company


def list_companies(db: Session, page: int, size: int, q: str | None) -> CompanyPage:
    stmt = select(Company)
    if q:
        pattern = f"%{_escape_like(q)}%"
        stmt = stmt.where(
            or_(
                Company.name.ilike(pattern, escape="\\"),
                Company.legal_name.ilike(pattern, escape="\\"),
                Company.tax_id.ilike(pattern, escape="\\"),
            )
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Company.name, Company.id).offset((page - 1) * size).limit(size)
    ).all()
    return CompanyPage(
        items=[CompanyRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        size=size,
    )


def create_company(db: Session, body: CompanyCreate, current_user: User) -> Company:
    data = body.model_dump()
    data["tax_id"] = _normalize_tax_id(body.tax_id)
    _ensure_tax_id_available(db, data["tax_id"])
    company = Company(**data, created_by_id=current_user.id)
    db.add(company)
    _commit(db)
    db.refresh(company)
    return company


def update_company(db: Session, company_id: int, body: CompanyUpdate) -> Company:
    company = get_company(db, company_id)
    changes: dict[str, Any] = body.model_dump(exclude_unset=True)
    for field in _REQUIRED_FIELDS:
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"{field} cannot be null")
    if "tax_id" in changes:
        changes["tax_id"] = _normalize_tax_id(changes["tax_id"])
        _ensure_tax_id_available(db, changes["tax_id"], exclude_id=company.id)
    for field, value in changes.items():
        setattr(company, field, value)
    _commit(db)
    db.refresh(company)
    return company


def delete_company(db: Session, company_id: int) -> None:
    company = get_company(db, company_id)
    db.delete(company)
    db.commit()
