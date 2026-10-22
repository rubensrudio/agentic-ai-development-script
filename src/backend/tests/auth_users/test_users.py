from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, UserPermission
from app.services import users as users_service
from contracts.permissions import Action, Module
from tests.conftest import DEFAULT_PASSWORD, UserFactory

Headers = Callable[[User], dict[str, str]]

ALL_USER_ACTIONS = [Action.LIST, Action.CREATE, Action.UPDATE, Action.DELETE]


@pytest.fixture
def manager(make_user: UserFactory) -> User:
    """Non-admin with every ``users`` permission."""
    return make_user("manager", permissions={Module.USERS: ALL_USER_ACTIONS})


@pytest.fixture
def manager_headers(manager: User, auth_headers: Headers) -> dict[str, str]:
    return auth_headers(manager)


def _new_user(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "username": "newbie",
        "email": "newbie@example.com",
        "full_name": "New Bie",
        "password": "Password123",
    }
    body.update(overrides)
    return body


def _rows(db: Session, user_id: int) -> dict[str, UserPermission]:
    db.expire_all()
    rows = db.scalars(select(UserPermission).where(UserPermission.user_id == user_id)).all()
    return {row.module: row for row in rows}


# --- List / get -------------------------------------------------------------


def test_list_paginates_ordered_by_id(
    client: TestClient, make_user: UserFactory, admin: User, admin_headers: dict[str, str]
) -> None:
    created = [make_user() for _ in range(4)]
    response = client.get("/api/users", params={"page": 2, "size": 2}, headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert body["page"] == 2
    assert body["size"] == 2
    assert [u["id"] for u in body["items"]] == [created[1].id, created[2].id]
    assert all(len(u["permissions"]) == len(Module) for u in body["items"])


def test_list_search_is_case_insensitive_across_fields(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    by_name = make_user("zeta", full_name="Maria Souza")
    by_email = make_user("omega", email="contact@SOUZA.dev")
    make_user("other", full_name="Somebody")
    response = client.get("/api/users", params={"q": "souza"}, headers=admin_headers)
    ids = [u["id"] for u in response.json()["items"]]
    assert ids == [by_name.id, by_email.id]
    assert response.json()["total"] == 2

    response = client.get("/api/users", params={"q": "ZET"}, headers=admin_headers)
    assert [u["id"] for u in response.json()["items"]] == [by_name.id]


def test_list_search_treats_wildcards_literally(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    make_user("plain")
    response = client.get("/api/users", params={"q": "%"}, headers=admin_headers)
    assert response.json()["total"] == 0


def test_list_validates_query_params(client: TestClient, admin_headers: dict[str, str]) -> None:
    assert client.get("/api/users", params={"page": 0}, headers=admin_headers).status_code == 422
    assert client.get("/api/users", params={"size": 101}, headers=admin_headers).status_code == 422


def test_list_requires_permission(
    client: TestClient, make_user: UserFactory, auth_headers: Headers
) -> None:
    user = make_user(permissions={Module.COMPANIES: [Action.LIST]})
    assert client.get("/api/users", headers=auth_headers(user)).status_code == 403


def test_get_user_and_not_found(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    target = make_user("target", permissions={Module.COMPANIES: [Action.DELETE]})
    response = client.get(f"/api/users/{target.id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "target"
    assert response.json()["permissions"][1] == {
        "module": "companies",
        "can_list": False,
        "can_create": False,
        "can_update": False,
        "can_delete": True,
    }
    missing = client.get("/api/users/999999", headers=admin_headers)
    assert missing.status_code == 404
    assert missing.json() == {"detail": "User not found"}


# --- Create -----------------------------------------------------------------


def test_admin_creates_user_with_permissions(
    client: TestClient, db: Session, admin_headers: dict[str, str]
) -> None:
    body = _new_user(permissions=[{"module": "companies", "can_list": True, "can_update": True}])
    response = client.post("/api/users", json=body, headers=admin_headers)
    assert response.status_code == 201
    created = response.json()
    assert created["username"] == "newbie"
    assert created["is_active"] is True
    assert created["is_admin"] is False
    assert created["permissions"][0]["module"] == "users"
    assert created["permissions"][1]["can_update"] is True
    assert set(_rows(db, created["id"])) == {"companies"}

    login = client.post("/api/auth/token", data={"username": "newbie", "password": "Password123"})
    assert login.status_code == 200


def test_non_admin_creates_plain_user(client: TestClient, manager_headers: dict[str, str]) -> None:
    body = _new_user(permissions=[{"module": "companies"}])
    response = client.post("/api/users", json=body, headers=manager_headers)
    assert response.status_code == 201


@pytest.mark.parametrize(
    "extra",
    [
        {"is_admin": True},
        {"permissions": [{"module": "companies", "can_list": True}]},
    ],
)
def test_non_admin_cannot_grant_privileges_on_create(
    client: TestClient, manager_headers: dict[str, str], extra: dict[str, Any]
) -> None:
    response = client.post("/api/users", json=_new_user(**extra), headers=manager_headers)
    assert response.status_code == 403
    assert response.json() == {"detail": "Only admins can manage permissions"}


def test_create_duplicate_username_and_email(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    make_user("taken", email="taken@example.com")
    response = client.post("/api/users", json=_new_user(username="taken"), headers=admin_headers)
    assert response.status_code == 409
    assert response.json() == {"detail": "Username already registered"}
    response = client.post(
        "/api/users", json=_new_user(email="taken@example.com"), headers=admin_headers
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}


def test_create_duplicate_module(client: TestClient, admin_headers: dict[str, str]) -> None:
    body = _new_user(permissions=[{"module": "users"}, {"module": "users", "can_list": True}])
    response = client.post("/api/users", json=body, headers=admin_headers)
    assert response.status_code == 422
    assert response.json() == {"detail": "Duplicate module in permissions"}


def test_create_validates_body(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/users", json=_new_user(username="bad name!"), headers=admin_headers
    )
    assert response.status_code == 422


def test_create_requires_permission(
    client: TestClient, make_user: UserFactory, auth_headers: Headers
) -> None:
    user = make_user(permissions={Module.USERS: [Action.LIST]})
    response = client.post("/api/users", json=_new_user(), headers=auth_headers(user))
    assert response.status_code == 403


# --- Update -----------------------------------------------------------------


def test_admin_updates_fields_and_resets_password(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    target = make_user("target")
    response = client.patch(
        f"/api/users/{target.id}",
        json={
            "email": "changed@example.com",
            "full_name": "Changed Name",
            "is_active": True,
            "password": "ResetPass123",
        },
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "changed@example.com"
    assert body["full_name"] == "Changed Name"
    assert body["username"] == "target"

    login = client.post("/api/auth/token", data={"username": "target", "password": "ResetPass123"})
    assert login.status_code == 200
    old = client.post("/api/auth/token", data={"username": "target", "password": DEFAULT_PASSWORD})
    assert old.status_code == 401


def test_permissions_patch_replaces_whole_matrix(
    client: TestClient, db: Session, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    target = make_user(
        permissions={Module.USERS: [Action.LIST], Module.COMPANIES: [Action.LIST, Action.CREATE]}
    )
    response = client.patch(
        f"/api/users/{target.id}",
        json={"permissions": [{"module": "companies", "can_delete": True}]},
        headers=admin_headers,
    )
    assert response.status_code == 200
    users_perm, companies_perm = response.json()["permissions"]
    assert users_perm == {
        "module": "users",
        "can_list": False,
        "can_create": False,
        "can_update": False,
        "can_delete": False,
    }
    assert companies_perm["can_delete"] is True
    assert companies_perm["can_list"] is False
    rows = _rows(db, target.id)
    assert set(rows) == {"companies"}
    assert rows["companies"].can_delete is True

    response = client.patch(
        f"/api/users/{target.id}", json={"permissions": []}, headers=admin_headers
    )
    assert response.status_code == 200
    assert _rows(db, target.id) == {}


def test_admin_can_promote_and_demote_others(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    target = make_user()
    url = f"/api/users/{target.id}"
    assert client.patch(url, json={"is_admin": True}, headers=admin_headers).json()["is_admin"]
    response = client.patch(url, json={"is_admin": False}, headers=admin_headers)
    assert response.json()["is_admin"] is False


def test_revoked_permission_applies_immediately(
    client: TestClient, make_user: UserFactory, auth_headers: Headers, admin_headers: dict[str, str]
) -> None:
    target = make_user(permissions={Module.USERS: [Action.LIST]})
    headers = auth_headers(target)
    assert client.get("/api/users", headers=headers).status_code == 200
    client.patch(f"/api/users/{target.id}", json={"permissions": []}, headers=admin_headers)
    assert client.get("/api/users", headers=headers).status_code == 403


@pytest.mark.parametrize(
    "body",
    [
        {"is_admin": False},
        {"permissions": []},
        {"permissions": None},
    ],
)
def test_non_admin_cannot_send_privilege_fields(
    client: TestClient,
    make_user: UserFactory,
    manager_headers: dict[str, str],
    body: dict[str, Any],
) -> None:
    target = make_user()
    response = client.patch(f"/api/users/{target.id}", json=body, headers=manager_headers)
    assert response.status_code == 403
    assert response.json() == {"detail": "Only admins can manage permissions"}


def test_non_admin_updates_plain_user(
    client: TestClient, make_user: UserFactory, manager_headers: dict[str, str]
) -> None:
    target = make_user()
    response = client.patch(
        f"/api/users/{target.id}", json={"full_name": "Edited"}, headers=manager_headers
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Edited"


def test_non_admin_cannot_update_admin(
    client: TestClient, make_user: UserFactory, manager_headers: dict[str, str]
) -> None:
    other_admin = make_user(is_admin=True)
    response = client.patch(
        f"/api/users/{other_admin.id}", json={"full_name": "Hacked"}, headers=manager_headers
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "Only admins can manage admin users"}


@pytest.mark.parametrize("body", [{"is_active": False}, {"is_admin": False}])
def test_admin_cannot_deactivate_or_demote_self(
    client: TestClient, admin: User, admin_headers: dict[str, str], body: dict[str, Any]
) -> None:
    response = client.patch(f"/api/users/{admin.id}", json=body, headers=admin_headers)
    assert response.status_code == 400
    assert response.json() == {"detail": "You cannot deactivate or demote yourself"}


def test_non_admin_cannot_deactivate_self(
    client: TestClient, manager: User, manager_headers: dict[str, str]
) -> None:
    response = client.patch(
        f"/api/users/{manager.id}", json={"is_active": False}, headers=manager_headers
    )
    assert response.status_code == 400


def test_update_email_conflict(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    make_user(email="taken@example.com")
    target = make_user(email="mine@example.com")
    url = f"/api/users/{target.id}"
    response = client.patch(url, json={"email": "taken@example.com"}, headers=admin_headers)
    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}
    same = client.patch(url, json={"email": "mine@example.com"}, headers=admin_headers)
    assert same.status_code == 200


def test_update_duplicate_module(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    target = make_user()
    response = client.patch(
        f"/api/users/{target.id}",
        json={"permissions": [{"module": "companies"}, {"module": "companies"}]},
        headers=admin_headers,
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "Duplicate module in permissions"}


def test_update_not_found(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.patch("/api/users/999999", json={"full_name": "X"}, headers=admin_headers)
    assert response.status_code == 404


# --- Delete -----------------------------------------------------------------


def test_delete_user(
    client: TestClient, make_user: UserFactory, manager_headers: dict[str, str]
) -> None:
    target = make_user(permissions={Module.COMPANIES: [Action.LIST]})
    response = client.delete(f"/api/users/{target.id}", headers=manager_headers)
    assert response.status_code == 204
    assert client.get(f"/api/users/{target.id}", headers=manager_headers).status_code == 404


def test_cannot_delete_self(client: TestClient, admin: User, admin_headers: dict[str, str]) -> None:
    response = client.delete(f"/api/users/{admin.id}", headers=admin_headers)
    assert response.status_code == 400
    assert response.json() == {"detail": "You cannot delete yourself"}


def test_non_admin_cannot_delete_admin(
    client: TestClient, admin: User, manager_headers: dict[str, str]
) -> None:
    response = client.delete(f"/api/users/{admin.id}", headers=manager_headers)
    assert response.status_code == 403
    assert response.json() == {"detail": "Only admins can manage admin users"}


def test_admin_can_delete_admin(
    client: TestClient, make_user: UserFactory, admin_headers: dict[str, str]
) -> None:
    other_admin = make_user(is_admin=True)
    response = client.delete(f"/api/users/{other_admin.id}", headers=admin_headers)
    assert response.status_code == 204


def test_delete_not_found(client: TestClient, admin_headers: dict[str, str]) -> None:
    assert client.delete("/api/users/999999", headers=admin_headers).status_code == 404


# --- Check ordering ---------------------------------------------------------


DUPLICATE_GRANTS = [
    {"module": "companies", "can_list": True},
    {"module": "companies", "can_list": True},
]


def test_non_admin_gets_403_not_422_for_duplicate_grants_on_create(
    client: TestClient, manager_headers: dict[str, str]
) -> None:
    body = _new_user(permissions=DUPLICATE_GRANTS)
    response = client.post("/api/users", json=body, headers=manager_headers)
    assert response.status_code == 403
    assert response.json() == {"detail": "Only admins can manage permissions"}


def test_non_admin_gets_403_not_422_for_duplicate_modules_on_update(
    client: TestClient, make_user: UserFactory, manager_headers: dict[str, str]
) -> None:
    target = make_user()
    response = client.patch(
        f"/api/users/{target.id}",
        json={"permissions": [{"module": "users"}, {"module": "users"}]},
        headers=manager_headers,
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "Only admins can manage permissions"}


# --- Unique-index races -----------------------------------------------------


def _skip_pre_checks(monkeypatch: pytest.MonkeyPatch) -> None:
    """Simulate a concurrent request that passed the pre-checks first."""
    monkeypatch.setattr(users_service, "_check_unique_username", lambda *a, **k: None)
    monkeypatch.setattr(users_service, "_check_unique_email", lambda *a, **k: None)


@pytest.mark.parametrize(
    ("overrides", "detail"),
    [
        ({"username": "taken"}, "Username already registered"),
        ({"email": "taken@example.com"}, "Email already registered"),
    ],
)
def test_create_race_returns_409(
    client: TestClient,
    make_user: UserFactory,
    admin_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    overrides: dict[str, Any],
    detail: str,
) -> None:
    make_user("taken", email="taken@example.com")
    _skip_pre_checks(monkeypatch)
    response = client.post("/api/users", json=_new_user(**overrides), headers=admin_headers)
    assert response.status_code == 409
    assert response.json() == {"detail": detail}
    # The session is usable again after the rollback.
    assert client.get("/api/users", headers=admin_headers).status_code == 200


def test_update_race_returns_409(
    client: TestClient,
    make_user: UserFactory,
    admin_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    make_user(email="taken@example.com")
    target = make_user(email="mine@example.com")
    _skip_pre_checks(monkeypatch)
    response = client.patch(
        f"/api/users/{target.id}", json={"email": "taken@example.com"}, headers=admin_headers
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}
    current = client.get(f"/api/users/{target.id}", headers=admin_headers).json()
    assert current["email"] == "mine@example.com"
