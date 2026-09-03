"""Initialize Therafam's Railway PostgreSQL database.

The Railway deployment path is intentionally independent of Supabase.
The script is idempotent and safe to run as a Railway pre-deploy command.
"""
from pathlib import Path
import os
import psycopg

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "database" / "therafam_schema.sql"
AUTH = ROOT / "database" / "railway_auth_migration.sql"
SUBS = ROOT / "database" / "railway_subscriptions_earnings.sql"


def run(conn, path: Path) -> None:
    print(f"Applying {path.name}")
    conn.execute(path.read_text(encoding="utf-8"))


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")

    with psycopg.connect(url) as conn:
        exists = conn.execute(
            "SELECT to_regclass('public.users') AS users_table"
        ).fetchone()[0]
        if not exists:
            run(conn, SCHEMA)
        run(conn, SUBS)
        run(conn, AUTH)
        conn.execute("ANALYZE")

    print("Therafam Railway database is ready.")


if __name__ == "__main__":
    main()
