"""
SimulationState — shared in-memory state for the hydraulic model.

Holds the loaded WaterNetworkModel, the set of currently closed pipes,
and the most recent simulation results. Thread-safe via asyncio.Lock.
"""

import asyncio
from typing import Optional, Set
import wntr
import wntr.network

from app.network.generator import build_network
from app.models.simulation import SimulationResult


class SimulationState:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._wn: Optional[wntr.network.WaterNetworkModel] = None
        self._closed_pipes: Set[str] = set()
        self._last_results: Optional[SimulationResult] = None
        self._results_valid: bool = False

    # ------------------------------------------------------------------
    # Initialisation (called once at startup)
    # ------------------------------------------------------------------

    async def initialise(self) -> None:
        """Build the WNTR model from the topology generator."""
        async with self._lock:
            self._wn = build_network()
            self._closed_pipes = set()
            self._last_results = None
            self._results_valid = False

    # ------------------------------------------------------------------
    # Read-only accessors (no lock needed for reads on immutable attrs)
    # ------------------------------------------------------------------

    @property
    def wn(self) -> wntr.network.WaterNetworkModel:
        if self._wn is None:
            raise RuntimeError("SimulationState not initialised. Call await state.initialise() first.")
        return self._wn

    @property
    def closed_pipes(self) -> Set[str]:
        return frozenset(self._closed_pipes)

    @property
    def last_results(self) -> Optional[SimulationResult]:
        return self._last_results

    @property
    def results_valid(self) -> bool:
        return self._results_valid

    def all_pipe_ids(self):
        return list(self.wn.pipe_name_list)

    # ------------------------------------------------------------------
    # Mutating operations (all acquire the lock)
    # ------------------------------------------------------------------

    async def close_pipes(self, pipe_ids: list) -> dict:
        """
        Close one or more pipes by setting their status to Closed.
        Returns a dict with 'closed', 'not_found', 'already_closed' lists.
        """
        async with self._lock:
            closed = []
            not_found = []
            already_closed = []

            all_links = set(self._wn.pipe_name_list)
            for pid in pipe_ids:
                if pid not in all_links:
                    not_found.append(pid)
                elif pid in self._closed_pipes:
                    already_closed.append(pid)
                else:
                    self._wn.get_link(pid).initial_status = wntr.network.LinkStatus.Closed
                    self._closed_pipes.add(pid)
                    closed.append(pid)

            if closed:
                self._results_valid = False

            return {"closed": closed, "not_found": not_found, "already_closed": already_closed}

    async def open_pipes(self, pipe_ids: list) -> dict:
        """Re-open one or more pipes."""
        async with self._lock:
            opened = []
            not_found = []
            already_open = []

            all_links = set(self._wn.pipe_name_list)
            for pid in pipe_ids:
                if pid not in all_links:
                    not_found.append(pid)
                elif pid not in self._closed_pipes:
                    already_open.append(pid)
                else:
                    self._wn.get_link(pid).initial_status = wntr.network.LinkStatus.Open
                    self._closed_pipes.discard(pid)
                    opened.append(pid)

            if opened:
                self._results_valid = False

            return {"opened": opened, "not_found": not_found, "already_open": already_open}

    async def reset(self) -> None:
        """Reopen all closed pipes and clear simulation results."""
        async with self._lock:
            for pid in list(self._closed_pipes):
                self._wn.get_link(pid).initial_status = wntr.network.LinkStatus.Open
            self._closed_pipes.clear()
            self._last_results = None
            self._results_valid = False

    async def store_results(self, results: SimulationResult) -> None:
        """Store simulation results after a successful run."""
        async with self._lock:
            self._last_results = results
            self._results_valid = True


# Module-level singleton — initialised during FastAPI lifespan
simulation_state = SimulationState()
