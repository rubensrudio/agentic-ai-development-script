"""Shared fixtures. Tests run against TEST_DATABASE_URL (the ``db_test`` compose
service), never against DATABASE_URL. Each test runs inside a transaction that
is rolled back, so tests are isolated and can commit freely."""

import os
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from contracts.permissions import Action, Module

_maybe_url = Settings().test_database_url
if not _maybe_url:
    raise RuntimeError("TEST_DATABASE_URL must be set to run the tests")
_test_url: str = _maybe_url
os.environ["DATABASE_URL"] = _test_url
get_settings.cache_clear()

from app.core.database import get_db  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import User, UserPermission  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_PASSWORD = "Secret123!"

PermissionSpec = dict[Module, list[Action]]
UserFactory = Callable[..., User]


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["database_url"] = _test_url
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    eng = create_engine(_test_url)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def make_user(db: Session) -> UserFactory:
    """Create a user. ``permissions={Module.COMPANIES: [Action.LIST]}``."""
    counter = 0

    def factory(
        username: str | None = None,
        *,
        password: str = DEFAULT_PASSWORD,
        is_admin: bool = False,
        is_active: bool = True,
        permissions: PermissionSpec | None = None,
        email: str | None = None,
        full_name: str = "Test User",
    ) -> User:
        nonlocal counter
        counter += 1
        name = username or f"user{counter}"
        user = User(
            username=name,
            email=email or f"{name}@example.com",
            full_name=full_name,
            hashed_password=hash_password(password),
            is_admin=is_admin,
            is_active=is_active,
        )
        for module, actions in (permissions or {}).items():
            user.permission_rows.append(
                UserPermission(module=module.value, **{f"can_{a.value}": True for a in actions})
            )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return factory


@pytest.fixture
def auth_headers() -> Callable[[User], dict[str, str]]:
    """Bearer headers for a user, without going through the login endpoint."""

    def build(user: User) -> dict[str, str]:
        token, _ = create_access_token(user.id, user.scopes)
        return {"Authorization": f"Bearer {token}"}

    return build


@pytest.fixture
def admin(make_user: UserFactory) -> User:
    return make_user("admin", is_admin=True)


@pytest.fixture
def admin_headers(admin: User, auth_headers: Callable[[User], dict[str, str]]) -> dict[str, str]:
    return auth_headers(admin)
