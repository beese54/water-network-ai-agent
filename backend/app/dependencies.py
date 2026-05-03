from app.simulation.state import simulation_state, SimulationState


def get_simulation_state() -> SimulationState:
    """FastAPI dependency — returns the singleton simulation state."""
    return simulation_state
