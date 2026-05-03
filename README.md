# Water Network AI Agent

A full-stack hydraulic simulation platform for the Bukit Batok water distribution network in Singapore. Engineers can run emergency shutdown analyses, simulate pressure and flow across 1,503 nodes, and query an AI agent that walks through the full impact assessment in natural language.

<video src="https://github.com/beese54/water-network-ai-agent/raw/master/water_distribution_modelling_video.mp4" controls width="100%"></video>

---

## What It Does

When a trunk main needs to go offline for maintenance, this platform answers three questions before the crew turns the valve:

1. **Which nodes lose supply entirely?** — A graph traversal engine traces the network topology to identify every node hydraulically isolated by the closure.
2. **Which zones experience pressure reduction?** — A pressure-driven hydraulic simulation runs on the affected network and reports the lowest-pressure node and zone-by-zone impact.
3. **Does any node fall below the 1 bar minimum standard?** — Results are colour-coded on the map and summarised by the AI agent.

---

## Features

- **Emergency shutdown analysis** — Select any combination of trunk or distribution mains, run a baseline vs shutdown comparison, and see the pressure and flow delta across the full 24-hour demand cycle.
- **AI-assisted planning** — Chat with a Llama 3.3 70B Turbo agent (via Together AI) that collects shutdown details, executes the full analysis workflow, and reports results in plain language.
- **Pressure-driven analysis (PDA)** — Automatically switches from the standard Demand-Driven (DDA) model to PDA when pipes are closed. This prevents the unphysical negative-pressure artefacts that DDA produces at isolated nodes in a branched network like Bukit Batok.
- **Interactive map** — React + Leaflet map with pipes colour-coded by velocity (cyan → green → amber → red), clickable nodes showing upstream/downstream connectivity, and zone overlays for Central, West, East, and Bukit Gombak.
- **Network editor** — Toggle pipes between open and closed directly on the map; changes are reflected in the live hydraulic model.
- **Flow and pressure charts** — 24-hour baseline vs shutdown comparison charts with peak demand bands highlighted.
- **Impact analysis tab** — Node-by-node and pipe-by-pipe breakdown of the shutdown effect, filterable by zone and side (upstream/downstream).

---

## Architecture

```
water-network-ai-agent/
├── backend/                    # Python 3.12 · FastAPI · WNTR 1.4.0
│   ├── app/
│   │   ├── agent/              # AI orchestrator, tool definitions, schemas
│   │   ├── api/                # REST endpoints (network, simulation, agent, edit)
│   │   ├── models/             # Pydantic request/response models
│   │   ├── network/            # Topology builder, zone assignments, EPANET overrides
│   │   └── simulation/         # Hydraulic engine, shutdown analysis, state management
│   ├── data/
│   │   └── bukit_batok.inp     # EPANET network file (120 nodes, 202 pipes)
│   └── requirements.txt
├── frontend/                   # React 18 · TypeScript · Vite
│   └── src/
│       ├── components/         # Map, chat panel, dashboard, results
│       ├── store/              # Zustand state (network, simulation, shutdown, chat)
│       ├── services/           # Axios API clients
│       └── types/              # Shared TypeScript interfaces
├── data/
│   └── network_overrides.json  # Manual zone and pipe metadata corrections
├── overpass_data.json          # OpenStreetMap geometry (loaded at startup)
└── docker-compose.yml
```

---

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/api/network/topology` | Full network topology for map rendering |
| POST | `/api/simulation/run` | Run a hydraulic snapshot of the current network |
| POST | `/api/simulation/shutdown` | Run baseline vs shutdown comparison |
| POST | `/api/agent/chat` | AI agent chat endpoint |
| POST | `/api/network/reset` | Reopen all closed pipes and clear results |

---

## Getting Started

### Prerequisites

- Python 3.12
- Node.js 18+
- API key from [Together AI](https://together.ai) (for the Llama agent)

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys:

```
TOGETHER_API_KEY=your_key_here
NETWORK_FILE_PATH=data/bukit_batok.inp
PORT=8000
```

Start the server:

```bash
uvicorn app.main:app --port 8000
```

The WNTR model loads on startup (~2 seconds). Check `http://localhost:8000/health`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Hydraulic Modelling Notes

**Why PDA instead of DDA for shutdown scenarios?**

The standard EPANET Demand-Driven Analysis (DDA) model assumes demands are always fully met. When a pipe is closed and a node has no supply path, DDA produces large negative pressures at isolated nodes — which then distort flows and pressures in the rest of the active network.

Pressure-Driven Analysis (PDA) replaces the constant demand term with a pressure-dependent function:

```
Q_actual = Q_desired × ((P - P_min) / (P_req - P_min)) ^ 0.5
```

At zero pressure, `Q_actual = 0` — isolated nodes draw nothing and the solver converges correctly. The platform uses WNTR's native `WNTRSimulator` with `demand_model = 'PDA'` for all shutdown scenarios and falls back to the faster `EpanetSimulator` (DDA) for baseline runs.

**Network: Bukit Batok, Singapore**

- Gravity-fed from a service reservoir at 45 m head
- Four supply zones: Central, West, East, Bukit Gombak
- 120 junctions, 202 pipes, 1 reservoir
- Minimum service pressure standard: 1 bar (10.197 m)

---

## AI Agent

The agent is powered by **Llama 3.3 70B Instruct Turbo** via Together AI. It collects the shutdown details (pipe IDs, start/end time, demand period), then autonomously calls `shutdown_pipes → run_simulation → get_affected_nodes` and returns a complete zone-by-zone impact report.

The platform is provider-agnostic — swapping to a different model is a one-line change in `.env`.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, WNTR 1.4.0, Uvicorn |
| Hydraulic solver | WNTR WNTRSimulator (PDA) / EpanetSimulator (DDA) |
| AI agent | Llama 3.3 70B Turbo via Together AI |
| Frontend | React 18, TypeScript, Vite |
| Map | react-leaflet, Leaflet.js |
| State management | Zustand |
| Charts | Recharts |
| Containerisation | Docker, docker-compose |
