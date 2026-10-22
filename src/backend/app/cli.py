"""Management commands, e.g. ``uv run app-cli create-admin``."""

import argparse
import sys

from sqlalchemy import or_, select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User


def create_admin(username: str, email: str, password: str) -> int:
    with SessionLocal() as db:
        existing = db.scalar(
            select(User).where(or_(User.username == username, User.email == email))
        )
        if existing is not None:
            print(f"User '{existing.username}' already exists; nothing to do.")
            return 0
        db.add(
            User(
                username=username,
                email=email,
                full_name="Administrator",
                hashed_password=hash_password(password),
                is_active=True,
                is_admin=True,
            )
        )
        db.commit()
    print(f"Admin user '{username}' created.")
    return 0


def main(argv: list[str] | None = None) -> int:
    settings = get_settings()
    parser = argparse.ArgumentParser(prog="app-cli")
    sub = parser.add_subparsers(dest="command", required=True)
    admin = sub.add_parser("create-admin", help="Create the first admin user")
    admin.add_argument("--username", default=settings.first_admin_username)
    admin.add_argument("--email", default=settings.first_admin_email)
    admin.add_argument("--password", default=settings.first_admin_password)
    args = parser.parse_args(argv)

    if args.command == "create-admin":
        if not (args.username and args.email and args.password):
            parser.error("username, email and password are required (args or FIRST_ADMIN_* env)")
        return create_admin(args.username, args.email, args.password)
    return 1


if __name__ == "__main__":
    sys.exit(main())
