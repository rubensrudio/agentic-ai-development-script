from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Company, User
from contracts.permissions import Action, Module
from tests.conftest import UserFactory

URL = "/api/companies"
Headers = dict[str, str]
AuthHeaders = Callable[[User], Headers]


def company_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "Acme",
        "legal_name": "Acme Industries Ltd",
        "tax_id": "12.345.678/0001-90",
        "email": "contact@acme.example.com",
        "phone": "+55 11 99999-0000",
        "address": "1 Main St",
        "is_active": True,
    }
    payload.update(overrides)
    return payload


def create(client: TestClient, headers: Headers, **overrides: Any) -> dict[str, Any]:
    response = client.post(URL, json=company_payload(**overrides), headers=headers)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


# --- Create -------------------------------------------------------------------


def test_create_sets_created_by_and_normalizes_tax_id(
    client: TestClient, db: Session, admin: User, admin_headers: Headers
) -> None:
    body = create(client, admin_headers, tax_id="  123  ")
    assert body["created_by_id"] == admin.id
    assert body["tax_id"] == "123"
    assert body["name"] == "Acme"
    assert body["created_at"] and body["updated_at"]
    stored = db.get(Company, body["id"])
    assert stored is not None and stored.tax_id == "123"


def test_create_with_only_required_fields(client: TestClient, admin_headers: Headers) -> None:
    response = client.post(URL, json={"name": "Min", "tax_id": "1"}, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["legal_name"] is None
    assert body["is_active"] is True


def test_create_duplicate_tax_id_conflicts(client: TestClient, admin_headers: Headers) -> None:
    create(client, admin_headers, tax_id="111")
    response = client.post(URL, json=company_payload(tax_id=" 111 "), headers=admin_headers)
    assert response.status_code == 409
    assert response.json() == {"detail": "Tax ID already registered"}


@pytest.mark.parametrize(
    "overrides",
    [
        {"email": "not-an-email"},
        {"name": ""},
        {"tax_id": ""},
        {"name": "x" * 151},
        {"tax_id": "   "},
    ],
)
def test_create_validation_errors(
    client: TestClient, admin_headers: Headers, overrides: dict[str, Any]
) -> None:
    response = client.post(URL, json=company_payload(**overrides), headers=admin_headers)
    assert response.status_code == 422


def test_create_missing_required_field(client: TestClient, admin_headers: Headers) -> None:
    response = client.post(URL, json={"name": "No tax id"}, headers=admin_headers)
    assert response.status_code == 422


# --- Read ---------------------------------------------------------------------


def test_get_company(client: TestClient, admin_headers: Headers) -> None:
    created = create(client, admin_headers)
    response = client.get(f"{URL}/{created['id']}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json() == created


def test_list_orders_by_name_then_id(client: TestClient, admin_headers: Headers) -> None:
    b1 = create(client, admin_headers, name="Beta", tax_id="1")
    a = create(client, admin_headers, name="Alpha", tax_id="2")
    b2 = create(client, admin_headers, name="Beta", tax_id="3")
    response = client.get(URL, headers=admin_headers)
    assert response.status_code == 200
    assert [c["id"] for c in response.json()["items"]] == [a["id"], b1["id"], b2["id"]]


def test_list_pagination(client: TestClient, admin_headers: Headers) -> None:
    for i in range(5):
        create(client, admin_headers, name=f"Company {i}", tax_id=f"T{i}")
    response = client.get(URL, params={"page": 2, "size": 2}, headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert body["page"] == 2
    assert body["size"] == 2
    assert [c["name"] for c in body["items"]] == ["Company 2", "Company 3"]

    last = client.get(URL, params={"page": 3, "size": 2}, headers=admin_headers).json()
    assert [c["name"] for c in last["items"]] == ["Company 4"]
    beyond = client.get(URL, params={"page": 10, "size": 2}, headers=admin_headers).json()
    assert beyond["items"] == [] and beyond["total"] == 5


def test_list_defaults(client: TestClient, admin_headers: Headers) -> None:
    body = client.get(URL, headers=admin_headers).json()
    assert body == {"items": [], "total": 0, "page": 1, "size": 20}


@pytest.mark.parametrize("params", [{"page": 0}, {"size": 0}, {"size": 101}, {"q": "x" * 101}])
def test_list_invalid_params(
    client: TestClient, admin_headers: Headers, params: dict[str, Any]
) -> None:
    assert client.get(URL, params=params, headers=admin_headers).status_code == 422


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("acme", ["Acme Corp"]),  # name, case-insensitive
        ("GLOBEX HOLD", ["Globex"]),  # legal_name
        ("999", ["Initech"]),  # tax_id
        ("e", ["Acme Corp", "Globex", "Initech"]),
        ("nothing", []),
        ("%", []),  # wildcards are matched literally
        ("_", ["Initech"]),
    ],
)
def test_list_search(
    client: TestClient, admin_headers: Headers, q: str, expected: list[str]
) -> None:
    create(client, admin_headers, name="Acme Corp", legal_name=None, tax_id="100")
    create(client, admin_headers, name="Globex", legal_name="Globex Holdings", tax_id="200")
    create(client, admin_headers, name="Initech", legal_name="Init_tech", tax_id="999")
    body = client.get(URL, params={"q": q}, headers=admin_headers).json()
    assert [c["name"] for c in body["items"]] == expected
    assert body["total"] == len(expected)


def test_search_total_counts_filtered_results(client: TestClient, admin_headers: Headers) -> None:
    for i in range(3):
        create(client, admin_headers, name=f"Match {i}", tax_id=f"M{i}")
    create(client, admin_headers, name="Other", tax_id="O1")
    body = client.get(URL, params={"q": "match", "size": 1}, headers=admin_headers).json()
    assert body["total"] == 3
    assert len(body["items"]) == 1


# --- Update -------------------------------------------------------------------


def test_patch_changes_only_sent_fields(client: TestClient, admin_headers: Headers) -> None:
    created = create(client, admin_headers)
    response = client.patch(
        f"{URL}/{created['id']}",
        json={"name": "Renamed", "legal_name": None, "tax_id": " 555 "},
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed"
    assert body["legal_name"] is None
    assert body["tax_id"] == "555"
    for field in ("email", "phone", "address", "is_active", "created_by_id"):
        assert body[field] == created[field]


def test_patch_same_tax_id_is_not_a_conflict(client: TestClient, admin_headers: Headers) -> None:
    created = create(client, admin_headers, tax_id="777")
    response = client.patch(f"{URL}/{created['id']}", json={"tax_id": "777"}, headers=admin_headers)
    assert response.status_code == 200


def test_patch_tax_id_collision_conflicts(client: TestClient, admin_headers: Headers) -> None:
    create(client, admin_headers, tax_id="AAA")
    other = create(client, admin_headers, tax_id="BBB")
    response = client.patch(f"{URL}/{other['id']}", json={"tax_id": " AAA "}, headers=admin_headers)
    assert response.status_code == 409
    assert response.json() == {"detail": "Tax ID already registered"}


@pytest.mark.parametrize(
    "body",
    [
        {"email": "bad"},
        {"name": ""},
        {"name": None},
        {"tax_id": None},
        {"tax_id": "  "},
        {"is_active": None},
    ],
)
def test_patch_validation_errors(
    client: TestClient, admin_headers: Headers, body: dict[str, Any]
) -> None:
    created = create(client, admin_headers)
    response = client.patch(f"{URL}/{created['id']}", json=body, headers=admin_headers)
    assert response.status_code == 422


# --- Delete -------------------------------------------------------------------


def test_delete_is_hard_delete(client: TestClient, db: Session, admin_headers: Headers) -> None:
    created = create(client, admin_headers)
    response = client.delete(f"{URL}/{created['id']}", headers=admin_headers)
    assert response.status_code == 204
    assert response.content == b""
    db.expire_all()
    assert db.get(Company, created["id"]) is None
    assert client.get(f"{URL}/{created['id']}", headers=admin_headers).status_code == 404


# --- Not found ----------------------------------------------------------------


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_unknown_id_returns_404(client: TestClient, admin_headers: Headers, method: str) -> None:
    kwargs: dict[str, Any] = {"headers": admin_headers}
    if method == "patch":
        kwargs["json"] = {"name": "x"}
    response = client.request(method.upper(), f"{URL}/999999", **kwargs)
    assert response.status_code == 404
    assert response.json() == {"detail": "Company not found"}


# --- Permissions --------------------------------------------------------------

ENDPOINTS: list[tuple[str, str, Action]] = [
    ("GET", URL, Action.LIST),
    ("GET", f"{URL}/{{id}}", Action.LIST),
    ("POST", URL, Action.CREATE),
    ("PATCH", f"{URL}/{{id}}", Action.UPDATE),
    ("DELETE", f"{URL}/{{id}}", Action.DELETE),
]


def _call(
    client: TestClient, method: str, path: str, company_id: int, headers: Headers | None
) -> int:
    url = path.format(id=company_id)
    json: dict[str, Any] | None = None
    if method == "POST":
        json = company_payload(tax_id="perm-new")
    elif method == "PATCH":
        json = {"name": "Changed"}
    response = client.request(method, url, json=json, headers=headers)
    status_code: int = response.status_code
    return status_code


@pytest.fixture
def existing_company(client: TestClient, admin_headers: Headers) -> dict[str, Any]:
    return create(client, admin_headers, tax_id="perm-existing")


@pytest.mark.parametrize(("method", "path", "action"), ENDPOINTS)
def test_endpoint_requires_token(
    client: TestClient,
    existing_company: dict[str, Any],
    method: str,
    path: str,
    action: Action,
) -> None:
    assert _call(client, method, path, existing_company["id"], None) == 401


@pytest.mark.parametrize(("method", "path", "action"), ENDPOINTS)
def test_endpoint_forbidden_without_action(
    client: TestClient,
    make_user: UserFactory,
    auth_headers: AuthHeaders,
    existing_company: dict[str, Any],
    method: str,
    path: str,
    action: Action,
) -> None:
    others = [a for a in Action if a != action]
    user = make_user(permissions={Module.COMPANIES: others, Module.USERS: list(Action)})
    status_code = _call(client, method, path, existing_company["id"], auth_headers(user))
    assert status_code == 403


@pytest.mark.parametrize(
    ("method", "path", "action", "expected"),
    [(*e, code) for e, code in zip(ENDPOINTS, [200, 200, 201, 200, 204], strict=True)],
)
def test_endpoint_allowed_with_action(
    client: TestClient,
    make_user: UserFactory,
    auth_headers: AuthHeaders,
    existing_company: dict[str, Any],
    method: str,
    path: str,
    action: Action,
    expected: int,
) -> None:
    user = make_user(permissions={Module.COMPANIES: [action]})
    status_code = _call(client, method, path, existing_company["id"], auth_headers(user))
    assert status_code == expected


def test_non_admin_create_records_creator(
    client: TestClient, make_user: UserFactory, auth_headers: AuthHeaders
) -> None:
    user = make_user(permissions={Module.COMPANIES: [Action.CREATE]})
    body = create(client, auth_headers(user), tax_id="creator")
    assert body["created_by_id"] == user.id
