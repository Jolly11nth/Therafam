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
REVIEWS = ROOT / "database" / "railway_therapist_reviews.sql"
RAG = ROOT / "database" / "railway_rag_migration.sql"


def run(conn, path: Path) -> None:
    print(f"Applying {path.name}")
    conn.execute(path.read_text(encoding="utf-8"))


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")

    with psycopg.connect(url) as conn:
        # The base SQL schema is idempotent: CREATE TABLE/INDEX IF NOT EXISTS,
        # CREATE OR REPLACE views/functions, replaceable triggers, and idempotent seeds.
        # Reapplying it safely repairs a partially initialized database without dropping
        # tables or rows. Do not skip it merely because public.users already exists.
        run(conn, SCHEMA)
        run(conn, SUBS)
        run(conn, AUTH)
        run(conn, REVIEWS)
        run(conn, RAG)
        conn.execute("ANALYZE")

    print("Therafam Railway database is ready.")


if __name__ == "__main__":
    main()
