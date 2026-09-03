"""Railway entrypoint that loads the main app and optional feature routers."""
import uvicorn

from .app import app
from .therapist_directory import router as therapist_directory_router

app.include_router(therapist_directory_router)


if __name__ == "__main__":
    uvicorn.run("backend.bootstrap:app", host="0.0.0.0", port=int(__import__("os").getenv("PORT", "8000")))
