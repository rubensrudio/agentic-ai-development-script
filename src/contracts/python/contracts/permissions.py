"""Permission catalog: every (module, action) pair is an OAuth2 scope."""

from enum import StrEnum


class Module(StrEnum):
    USERS = "users"
    COMPANIES = "companies"


class Action(StrEnum):
    LIST = "list"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


def scope(module: Module, action: Action) -> str:
    """Return the OAuth2 scope string, e.g. ``companies:create``."""
    return f"{module.value}:{action.value}"


ALL_SCOPES: dict[str, str] = {
    scope(m, a): f"{a.value.capitalize()} {m.value}" for m in Module for a in Action
}
