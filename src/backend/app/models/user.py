from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from contracts.permissions import Action, Module, scope


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    permission_rows: Mapped[list["UserPermission"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )

    def has_permission(self, module: Module, action: Action) -> bool:
        if self.is_admin:
            return True
        for row in self.permission_rows:
            if row.module == module.value:
                return bool(getattr(row, f"can_{action.value}"))
        return False

    @property
    def scopes(self) -> list[str]:
        return [scope(m, a) for m in Module for a in Action if self.has_permission(m, a)]

    @property
    def permissions(self) -> list["UserPermission"]:
        """One row per Module in Module order; missing rows are transient all-false rows."""
        by_module = {row.module: row for row in self.permission_rows}
        return [by_module.get(m.value) or UserPermission(module=m.value) for m in Module]


class UserPermission(Base):
    __tablename__ = "user_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "module", name="uq_user_permissions_user_module"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    module: Mapped[str] = mapped_column(String(32))
    can_list: Mapped[bool] = mapped_column(Boolean, default=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False)
    can_update: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="permission_rows")

    def __init__(self, **kwargs: object) -> None:
        for flag in ("can_list", "can_create", "can_update", "can_delete"):
            kwargs.setdefault(flag, False)
        super().__init__(**kwargs)
