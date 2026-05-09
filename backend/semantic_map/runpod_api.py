from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .remote_api import router as remote_router
from .remote_api import start_prompt_batch_service, stop_prompt_batch_service


app = FastAPI(title="Semantic Tile Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(remote_router)


@app.on_event("startup")
async def startup_prompt_batch_service() -> None:
    await start_prompt_batch_service()


@app.on_event("shutdown")
async def shutdown_prompt_batch_service() -> None:
    await stop_prompt_batch_service()


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "Semantic Tile Service", "status": "ok"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
