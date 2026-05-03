"""Saves a WNTR WaterNetworkModel to an EPANET .inp file."""

import os
from pathlib import Path
import wntr.network


def save_network(wn: wntr.network.WaterNetworkModel, file_path: str) -> None:
    """Write the network to an EPANET .inp file, creating parent directories if needed."""
    import wntr.epanet.io
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    inp = wntr.epanet.io.InpFile()
    inp.write(str(path), wn)
    print(f"Network saved to: {path.resolve()}")
