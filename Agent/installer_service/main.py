"""FastAPI Application Entrypoint for SelfHeal Installer Service."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from installer_service.config import settings
from installer_service.routers.installer import router as installer_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
)
logger = logging.getLogger("selfheal.installer_service")

app = FastAPI(
    title="SelfHeal Kubernetes Agent Distribution & Installer API",
    description=(
        "Public and client-facing API for distributing SelfHeal Kubernetes Agent "
        "installers, checksums, and release metadata."
    ),
    version=settings.AGENT_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow CORS for dashboard integration if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "OPTIONS"],
    allow_headers=["*"],
)

# Include distribution router
app.include_router(installer_router)


@app.get("/health", summary="Health Check Probe", tags=["System"])
async def health_check():
    """Service liveness and readiness probe for Docker Compose / Kubernetes."""
    return {
        "status": "healthy",
        "service": "selfheal-installer-api",
        "version": settings.AGENT_VERSION,
    }


def run():
    """Run via uvicorn directly."""
    import uvicorn
    uvicorn.run(
        "installer_service.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.APP_ENV == "development",
    )


if __name__ == "__main__":
    run()
