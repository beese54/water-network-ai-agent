# Bukit Batok Water Distribution System

## Starting a Session

When the user says "start the session" (or similar), run both servers:

```bash
# Terminal 1 — Backend (FastAPI + WNTR)
cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --port 8000

# Terminal 2 — Frontend (React + Vite)
cd frontend && npm run dev
```

Then confirm both are up:
- Backend health: `curl http://localhost:8000/health`
- Frontend: http://localhost:5173

Start backend first (takes ~2s to load the WNTR model), then frontend. Both must be running for the app to work.

## Project Overview

Full-stack hydraulic simulation web app for Bukit Batok water distribution estate, Singapore.

- **Backend:** Python 3.12, FastAPI, WNTR 1.4.0 — `backend/`
- **Frontend:** React + TypeScript, Vite, react-leaflet — `frontend/`
- **Venv:** `backend/venv/Scripts/python.exe` (Windows — do NOT use `source activate`)
- **Config:** `backend/.env` (API keys already set)
- **App URL:** http://localhost:5173

## Key API Endpoints

- `GET  /health` — liveness check
- `GET  /api/network/topology` — full network for map rendering
- `POST /api/simulation/run` — run hydraulic simulation
- `POST /api/agent/chat` — AI agent chat
