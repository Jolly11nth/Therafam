"""Backward-compatible entrypoint for Therafam's PostgreSQL-backed FastAPI app.

The Railway Docker image starts backend.bootstrap:app directly. Keep this module
as an alias so local users do not accidentally start the obsolete Supabase app.
"""
import os

import uvicorn

from backend.bootstrap import app

if __name__ == "__main__":
    uvicorn.run(
        "backend.bootstrap:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
    )
