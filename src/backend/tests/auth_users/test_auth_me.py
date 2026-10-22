from collections.abc import Callable

from fastapi.testclient import TestClient

from app.models import User
from contracts.permissions import Action, Module
from tests.conftest import DEFAULT_PASSWORD, UserFactory

Headers = Callable[[User], dict[str, str]]


def test_login_then_me(client: TestClient, make_user: UserFactory) -> None:
    make_user("alice", permissions={Module.COMPANIES: [Action.LIST, Action.CREATE]})
    response = client.post(
        "/api/auth/token", data={"username": "alice", "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200
    token = response.json()
    assert token["token_type"] == "bearer"
    assert token["expires_in"] > 0

    me = client.get("/api/me", headers={"Authorization": f"Bearer {token['access_token']}"})
    assert me.status_code == 200
    body = me.json()
    assert body["username"] == "alice"
    assert body["scopes"] == ["companies:list", "companies:create"]
    assert [p["module"] for p in body["permissions"]] == ["users", "companies"]
    assert body["permissions"][0]["can_list"] is False
    assert body["permissions"][1]["can_create"] is True
    assert "hashed_password" not in body


def test_login_admin_gets_every_scope(client: TestClient, admin: User) -> None:
    response = client.post(
        "/api/auth/token", data={"username": "admin", "password": DEFAULT_PASSWORD}
    )
    token = response.json()["access_token"]
    me = client.get("/api/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert len(me["scopes"]) == len(Module) * len(Action)
    assert me["is_admin"] is True


def test_login_failures_are_indistinguishable(client: TestClient, make_user: UserFactory) -> None:
    make_user("bob")
    make_user("ghost", is_active=False)
    attempts = [
        {"username": "bob", "password": "wrong-password"},
        {"username": "nobody", "password": DEFAULT_PASSWORD},
        {"username": "ghost", "password": DEFAULT_PASSWORD},
    ]
    for data in attempts:
        response = client.post("/api/auth/token", data=data)
        assert response.status_code == 401
        assert response.json() == {"detail": "Incorrect username or password"}
        assert response.headers["www-authenticate"] == "Bearer"


def test_me_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/me").status_code == 401


def test_change_password(client: TestClient, make_user: UserFactory, auth_headers: Headers) -> None:
    user = make_user("carol")
    response = client.post(
        "/api/me/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "BrandNew123"},
        headers=auth_headers(user),
    )
    assert response.status_code == 204
    old = client.post("/api/auth/token", data={"username": "carol", "password": DEFAULT_PASSWORD})
    assert old.status_code == 401
    new = client.post("/api/auth/token", data={"username": "carol", "password": "BrandNew123"})
    assert new.status_code == 200


def test_change_password_wrong_current(
    client: TestClient, make_user: UserFactory, auth_headers: Headers
) -> None:
    user = make_user()
    response = client.post(
        "/api/me/password",
        json={"current_password": "not-it", "new_password": "BrandNew123"},
        headers=auth_headers(user),
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Current password is incorrect"}


def test_change_password_validates_length(
    client: TestClient, make_user: UserFactory, auth_headers: Headers
) -> None:
    user = make_user()
    response = client.post(
        "/api/me/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "short"},
        headers=auth_headers(user),
    )
    assert response.status_code == 422
