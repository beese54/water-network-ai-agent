"""
FastAPI application entry point for the Bukit Batok Hydraulic Simulation System.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.simulation.state import simulation_state
from app.api import network, simulation, agent, edit as edit_api


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise the simulation state (build WNTR model) on startup."""
    print("Initialising hydraulic model...")
    await simulation_state.initialise()
    print("Hydraulic model ready. Bukit Batok network loaded.")
    yield
    print("Shutting down.")


app = FastAPI(
    title="Bukit Batok Water Distribution Simulation API",
    description=(
        "Hydraulic simulation and emergency pipe shutdown analysis for "
        "the Bukit Batok water distribution system, Singapore."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(network.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(edit_api.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "bukit-batok-hydraulic-sim"}
