"""
EPANET Hydraulic Simulation Engine

Wraps WNTR simulators and returns raw simulation results.
This module is a pure function — it does not mutate state.

DDA (Demand-Driven Analysis):  used for baseline, all pipes open.
PDA (Pressure-Driven Analysis): used when pipes are closed, so isolated nodes
  automatically receive zero demand rather than distorting the live network.
"""

import wntr
import wntr.sim
import wntr.network
from typing import Tuple

# Project minimum service pressure: 1 bar = 10.197 m head
_MIN_PRESSURE_M = 0.0
_REQUIRED_PRESSURE_M = 10.197


def run_simulation(
    wn: wntr.network.WaterNetworkModel,
    use_pda: bool = False,
    single_step: bool = False,
    demand_hour: int | None = None,
) -> Tuple[object, str]:
    """
    Run a hydraulic simulation on the provided WaterNetworkModel.

    Args:
        wn:          The WNTR WaterNetworkModel (may have pipes pre-closed).
        use_pda:     When True, uses WNTRSimulator in PDA mode so isolated nodes
                     receive zero demand automatically.
        single_step: Limits PDA to a single hydraulic timestep (~25x speedup).
                     parse_results reads index[0] only, so results are identical.
        demand_hour: Hour (0–23) at which to evaluate demand for PDA runs.
                     Uses start_clocktime to shift the demand pattern so that
                     t=0 of the single-step run corresponds to the chosen hour.
                     None = use current start_clocktime (default t=0, midnight).

    Returns:
        (wntr_results, error_message)
    """
    try:
        if use_pda:
            # Save originals — restore unconditionally in finally
            original_dm = wn.options.hydraulic.demand_model
            original_duration = wn.options.time.duration
            original_clocktime = wn.options.time.start_clocktime
            wn.options.hydraulic.demand_model = 'PDA'
            wn.options.hydraulic.minimum_pressure = _MIN_PRESSURE_M
            wn.options.hydraulic.required_pressure = _REQUIRED_PRESSURE_M
            if single_step:
                wn.options.time.duration = wn.options.time.hydraulic_timestep
            if demand_hour is not None:
                # Shift the demand pattern so t=0 aligns with the chosen hour
                wn.options.time.start_clocktime = demand_hour * 3600
            try:
                simulator = wntr.sim.WNTRSimulator(wn)
                results = simulator.run_sim()
            finally:
                wn.options.hydraulic.demand_model = original_dm
                wn.options.time.duration = original_duration
                wn.options.time.start_clocktime = original_clocktime
        else:
            simulator = wntr.sim.EpanetSimulator(wn)
            results = simulator.run_sim()

        return results, ""
    except Exception as exc:
        return None, str(exc)
