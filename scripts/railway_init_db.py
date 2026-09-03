"""Initialize a new Railway PostgreSQL database for Therafam.

This script is intentionally idempotent after the first initialization. It is
safe to run from a Railway pre-deploy command. It never connects to Supabase.
"""
from pathlib import Path
import os
import psycopg

ROOT=Path(__file__).resolve().parents[1]
SCHEMA=ROOT/"database"/"therafam_schema.sql"
AUTH=ROOT/"database"/"railway_auth_migration.sql"
SUBS=ROOT/"supabase"/"migrations"/"20260831000003_subscriptions_and_therapist_earnings.sql"

def run(conn, path):
    print(f"Applying {path.name}")
    conn.execute(path.read_text(encoding="utf-8"))

def main():
    url=os.environ.get("DATABASE_URL")
    if not url: raise SystemExit("DATABASE_URL is required")
    with psycopg.connect(url) as conn:
        exists=conn.execute("SELECT to_regclass('public.users') AS users_table").fetchone()[0]
        if not exists:
            run(conn,SCHEMA)
        run(conn,SUBS)
        run(conn,AUTH)
        conn.execute("ANALYZE")
    print("Therafam Railway database is ready.")

if __name__=="__main__": main()
