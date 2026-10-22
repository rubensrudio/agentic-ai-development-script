"""Orchestrator-owned smoke tests for the shared skeleton."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from app.models import User
from contracts.permissions import Action, Module
from tests.conftest import UserFactory


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_route_requires_token(client: TestClient) -> None:
    response = client.get("/api/companies")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_invalid_token_is_rejected(client: TestClient) -> None:
    response = client.get("/api/companies", headers={"Authorization": "Bearer nope"})
    assert response.status_code == 401


def test_missing_permission_is_forbidden(
    client: TestClient, make_user: UserFactory, auth_headers: Callable[[User], dict[str, str]]
) -> None:
    user = make_user(permissions={Module.USERS: [Action.LIST]})
    response = client.get("/api/companies", headers=auth_headers(user))
    assert response.status_code == 403


def test_inactive_user_token_is_rejected(
    client: TestClient, make_user: UserFactory, auth_headers: Callable[[User], dict[str, str]]
) -> None:
    user = make_user(is_active=False, permissions={Module.COMPANIES: [Action.LIST]})
    response = client.get("/api/companies", headers=auth_headers(user))
    assert response.status_code == 401


def test_scopes_and_permission_matrix(make_user: UserFactory) -> None:
    user = make_user(permissions={Module.COMPANIES: [Action.LIST, Action.DELETE]})
    assert user.scopes == ["companies:list", "companies:delete"]
    assert [p.module for p in user.permissions] == ["users", "companies"]
    assert user.permissions[0].can_list is False
    admin = make_user(is_admin=True)
    assert len(admin.scopes) == len(Module) * len(Action)
