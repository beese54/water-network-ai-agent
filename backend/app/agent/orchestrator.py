"""
Multi-provider Agentic Loop Orchestrator

Supports Anthropic Claude, OpenAI, and Together.ai (OpenAI-compatible).
Provider is selected via LLM_PROVIDER env var; Together.ai is the default.
"""

import json
import re
from typing import Dict, List, Any

from app.agent.schemas import ChatRequest, ChatResponse, ToolCallRecord
from app.agent.tools import (
    tool_list_pipes, tool_list_nodes, tool_shutdown_pipes,
    tool_run_simulation, tool_get_affected_nodes, tool_get_network_status,
)
from app.models.simulation import AffectedNode
from app.config import settings


# ---------------------------------------------------------------------------
# Tool definitions — Anthropic format (source of truth)
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS_ANTHROPIC = [
    {
        "name": "list_pipes",
        "description": (
            "Returns all pipes in the network with IDs, connected nodes, diameter, length, "
            "zone, and current status (open or closed). Use this to discover pipe IDs before "
            "shutting them down, or to understand the network topology."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {
                    "type": "string",
                    "description": (
                        "Optional. Filter pipes by zone ID: 'bukit_batok_central', "
                        "'bukit_batok_west', 'bukit_batok_east', or 'bukit_gombak'. "
                        "If omitted, returns all pipes."
                    ),
                },
                "status_filter": {
                    "type": "string",
                    "enum": ["all", "open", "closed"],
                    "description": "Filter by pipe status. Defaults to 'all'.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "list_nodes",
        "description": (
            "Returns all junction nodes in the network with IDs, coordinates, elevation, "
            "zone membership, and base demand."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {
                    "type": "string",
                    "description": "Optional. Filter nodes by zone ID.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "shutdown_pipes",
        "description": (
            "Closes one or more pipes by setting their status to CLOSED in the hydraulic model. "
            "This simulates emergency pipe shutdown for maintenance or isolation. "
            "IMPORTANT: This does NOT run the simulation — call run_simulation() after this "
            "to see the hydraulic impact."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pipe_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "List of pipe IDs to close (e.g. ['T001', 'D003']). "
                        "Use list_pipes() if you need to discover valid pipe IDs first."
                    ),
                },
            },
            "required": ["pipe_ids"],
        },
    },
    {
        "name": "run_simulation",
        "description": (
            "Runs the hydraulic simulation with the current network state "
            "(including any closed pipes). Returns a pressure summary. "
            "Must be called after shutdown_pipes(). "
            "Always ask the user whether to use peak demand (hour 7, 07:00 — worst case) "
            "or a specific hour before calling this tool."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "demand_hour": {
                    "type": "integer",
                    "description": (
                        "Hour of day (0–23) at which to evaluate network demand. "
                        "Use 7 for peak demand (07:00, multiplier 1.95 — morning peak, "
                        "worst-case pressure scenario). "
                        "Other useful hours: 8 (08:00, also peak), 17–19 (evening, 1.73), "
                        "0–5 (night, 0.32 — optimistic baseline). "
                        "Always confirm this with the user before calling."
                    ),
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_affected_nodes",
        "description": (
            "Returns nodes where pressure has dropped below a threshold after the last "
            "simulation. The project minimum is 1 bar = 10.197 metres head. "
            "Each result includes node ID, zone name, pressure value, and coordinates. "
            "Results are sorted by pressure ascending (most severely affected first)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "threshold_m": {
                    "type": "number",
                    "description": (
                        "Pressure threshold in metres head. Nodes below this are 'affected'. "
                        "Default: 10.197m (1 bar — the project minimum standard)."
                    ),
                },
                "zone": {
                    "type": "string",
                    "description": "Optional. Restrict results to a specific zone ID.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_network_status",
        "description": (
            "Returns the current operational status of the network: which pipes are closed, "
            "reservoir head, total pipe count, and whether simulation results are up to date."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


def _to_openai_tools(anthropic_tools: list) -> list:
    """Convert Anthropic tool definitions to OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            },
        }
        for t in anthropic_tools
    ]


TOOL_DEFINITIONS_OPENAI = _to_openai_tools(TOOL_DEFINITIONS_ANTHROPIC)


SYSTEM_PROMPT = """You are a hydraulic network analysis assistant for Singapore's Bukit Batok \
water distribution system. You help engineers analyse the impact of pipe shutdowns on service pressure.

Key facts about the network:
- Gravity-fed from Bukit Batok Service Reservoir (R001) at 145m ASL
- 4 service zones: Bukit Batok Central, West, East, and Bukit Gombak
- Project minimum acceptable residual pressure: 1 bar = 10.197 metres head
- Nodes below 10.197m head are "affected" (inadequate service pressure)
- 6 trunk mains (T001–T006, DN1000 steel) connect the reservoir to zone hubs
- 16 distribution mains (D series, DN300 steel) form zone spines
- 20 gate valves (V001–V020, DN300) allow zone isolation
- 160 service mains (P series, DN100 ductile iron) serve individual demand nodes

Always follow this workflow for emergency shutdown analysis:
1. Collect ALL required information in a SINGLE prompt (see MANDATORY PROCEDURE below) \
before calling any tools.
2. Call list_pipes() only if the pipe ID is ambiguous and needs to be confirmed.
3. Call shutdown_pipes() with the confirmed pipe IDs.
4. Call run_simulation(demand_hour=<chosen hour>) to get updated pressures.
5. Call get_affected_nodes(threshold_m=10.197) to find impacted nodes.
6. Report the full results to the user.

When reporting results, always include:
- Which demand hour was used (e.g. "07:00 peak demand — worst-case scenario")
- Total number of affected nodes (below 1 bar / 10.197m head)
- Which zones are impacted and how many nodes per zone
- The lowest pressure recorded and which node has it
- Whether the impact is severe (entire zone isolated) or partial (pressure reduction only)

If pipe IDs are ambiguous (e.g. "the pipe near the reservoir"), call list_pipes() \
to help identify the correct pipe before proceeding.

MANDATORY SHUTDOWN PROCEDURE — collect ALL FOUR items before calling any tools:
When a user asks to shut down, close, isolate, or take offline any pipe or node, \
ask for ALL of the following in a single message if any are missing:
  (a) Shutdown start date and time  (e.g. "19 April 2025, 08:00")
  (b) Shutdown end date and time    (e.g. "20 April 2025, 06:00")
  (c) The specific pipe ID(s) or node(s) to shut — confirmed, not assumed
  (d) Demand period: peak demand (07:00 morning peak, worst-case, multiplier 1.95) \
or a specific hour (0–23, e.g. 14 for 14:00). Default to peak (hour 7) if not specified.
Do NOT call shutdown_pipes() until you have all four confirmed.
If the user has already provided all four items in their message, proceed directly \
to calling the tools — do not ask again.
Example prompt when items are missing: "Before I proceed, I need four things: \
(1) planned shutdown start date and time, \
(2) planned shutdown end date and time, \
(3) confirmation of the exact pipe ID(s) — for example, is it S0231 you mean? \
(4) pressure analysis period — peak demand (07:00, worst-case) or a specific hour (0–23)?\""""


# ---------------------------------------------------------------------------
# Session history stores (separate per provider family)
# ---------------------------------------------------------------------------

_history_anthropic: Dict[str, List[Dict[str, Any]]] = {}
_history_openai: Dict[str, List[Dict[str, Any]]] = {}


def clear_session(session_id: str) -> None:
    _history_anthropic.pop(session_id, None)
    _history_openai.pop(session_id, None)


# ---------------------------------------------------------------------------
# Text tool call fallback (handles Llama printing calls as plain text)
# ---------------------------------------------------------------------------

_KNOWN_TOOLS = frozenset({
    "list_pipes", "list_nodes", "shutdown_pipes",
    "run_simulation", "get_affected_nodes", "get_network_status",
})


def _parse_text_tool_call(text: str) -> tuple[str | None, dict]:
    """
    Llama 3.3 sometimes outputs tool calls as plain text, e.g.:
        run_simulation(demand_hour=7)
    instead of using the structured tool_calls API field.
    This function detects and parses those cases so the loop can execute them.
    """
    text = text.strip()
    m = re.match(r'^(\w+)\((.*)\)\s*$', text, re.DOTALL)
    if not m or m.group(1) not in _KNOWN_TOOLS:
        return None, {}

    tool_name = m.group(1)
    args_str = m.group(2).strip()
    if not args_str:
        return tool_name, {}

    args: dict = {}
    # Integer / float args: key=7 or key=10.197
    for km in re.finditer(r'(\w+)\s*=\s*(-?\d+(?:\.\d+)?)', args_str):
        k, v = km.group(1), km.group(2)
        args[k] = int(v) if '.' not in v else float(v)
    # JSON list args: key=["a", "b"]
    for km in re.finditer(r'(\w+)\s*=\s*(\[.*?\])', args_str, re.DOTALL):
        k, v = km.group(1), km.group(2)
        if k not in args:
            try:
                args[k] = json.loads(v)
            except Exception:
                pass
    # Quoted string args: key="value" or key='value'
    for km in re.finditer(r'(\w+)\s*=\s*["\']([^"\']*)["\']', args_str):
        k, v = km.group(1), km.group(2)
        if k not in args:
            args[k] = v

    return tool_name, args


# ---------------------------------------------------------------------------
# Tool input coercion helpers
# ---------------------------------------------------------------------------

def _to_float(val: Any, default: float | None = None) -> float | None:
    """Extract a float from a tool input value, handling dict-wrapped primitives.
    Llama models sometimes return {\"value\": 10.197} instead of 10.197."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, dict):
        for v in val.values():
            if isinstance(v, (int, float)):
                return float(v)
    return default


def _to_int(val: Any, default: int | None = None) -> int | None:
    """Extract an int from a tool input value, handling dict-wrapped primitives."""
    result = _to_float(val)
    return int(result) if result is not None else default


# ---------------------------------------------------------------------------
# Tool dispatcher (shared)
# ---------------------------------------------------------------------------

async def _dispatch_tool(name: str, tool_input: dict, state) -> Any:
    if name == "list_pipes":
        return await tool_list_pipes(
            state,
            zone=tool_input.get("zone"),
            status_filter=tool_input.get("status_filter", "all"),
        )
    elif name == "list_nodes":
        return await tool_list_nodes(state, zone=tool_input.get("zone"))
    elif name == "shutdown_pipes":
        return await tool_shutdown_pipes(state, tool_input.get("pipe_ids", []))
    elif name == "run_simulation":
        return await tool_run_simulation(state, demand_hour=_to_int(tool_input.get("demand_hour")))
    elif name == "get_affected_nodes":
        return await tool_get_affected_nodes(
            state,
            threshold_m=_to_float(tool_input.get("threshold_m")),
            zone=tool_input.get("zone"),
        )
    elif name == "get_network_status":
        return await tool_get_network_status(state)
    else:
        return {"error": f"Unknown tool: {name}"}


# ---------------------------------------------------------------------------
# Anthropic agentic loop
# ---------------------------------------------------------------------------

async def _handle_anthropic(request: ChatRequest, state) -> ChatResponse:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    history = _history_anthropic.setdefault(request.session_id, [])
    history.append({"role": "user", "content": request.message})

    tool_call_records: list[ToolCallRecord] = []
    network_state_changed = False
    affected_nodes: list[AffectedNode] = []
    reply_text = ""

    for _ in range(12):
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS_ANTHROPIC,
            messages=history,
        )

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    reply_text += block.text
            history.append({"role": "assistant", "content": response.content})
            break

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                tool_output = await _dispatch_tool(block.name, block.input, state)
                _record_side_effects(block.name, tool_output, tool_call_records, affected_nodes)
                if block.name in ("shutdown_pipes", "run_simulation"):
                    network_state_changed = True
                tool_call_records.append(ToolCallRecord(
                    tool=block.name, input=block.input, output=tool_output,
                ))
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(tool_output),
                })
            history.append({"role": "assistant", "content": response.content})
            history.append({"role": "user", "content": tool_results})
        else:
            reply_text = f"[Unexpected stop reason: {response.stop_reason}]"
            break
    else:
        reply_text = "[Reached maximum tool iteration limit. Please simplify your request.]"

    _history_anthropic[request.session_id] = history
    return ChatResponse(
        session_id=request.session_id,
        reply=reply_text,
        tool_calls=tool_call_records,
        affected_nodes=affected_nodes,
        network_state_changed=network_state_changed,
    )


# ---------------------------------------------------------------------------
# OpenAI-compatible agentic loop (covers OpenAI and Together.ai)
# ---------------------------------------------------------------------------

async def _handle_openai_compatible(request: ChatRequest, state) -> ChatResponse:
    from openai import OpenAI

    if settings.llm_provider == "together":
        client = OpenAI(
            api_key=settings.together_api_key,
            base_url="https://api.together.xyz/v1",
        )
        model = settings.together_model
    else:
        client = OpenAI(api_key=settings.openai_api_key)
        model = settings.openai_model

    history = _history_openai.setdefault(request.session_id, [])
    if not history:
        history.append({"role": "system", "content": SYSTEM_PROMPT})
    history.append({"role": "user", "content": request.message})

    tool_call_records: list[ToolCallRecord] = []
    network_state_changed = False
    affected_nodes: list[AffectedNode] = []
    reply_text = ""

    for _ in range(12):
        response = client.chat.completions.create(
            model=model,
            messages=history,
            tools=TOOL_DEFINITIONS_OPENAI,
            tool_choice="auto",
        )

        msg = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        if finish_reason == "stop" or not msg.tool_calls:
            reply_text = msg.content or ""

            # Llama fallback: detect tool call printed as plain text and execute it
            text_tool_name, text_tool_args = _parse_text_tool_call(reply_text)
            if text_tool_name:
                tool_output = await _dispatch_tool(text_tool_name, text_tool_args, state)
                if text_tool_name in ("shutdown_pipes", "run_simulation"):
                    network_state_changed = True
                _record_side_effects(text_tool_name, tool_output, tool_call_records, affected_nodes)
                tool_call_records.append(ToolCallRecord(
                    tool=text_tool_name, input=text_tool_args, output=tool_output,
                ))
                # Inject result as a user message (no tool_call_id available for text calls)
                history.append({"role": "assistant", "content": reply_text})
                history.append({
                    "role": "user",
                    "content": f"Tool '{text_tool_name}' result: {json.dumps(tool_output)}. Please continue.",
                })
                continue

            history.append({"role": "assistant", "content": reply_text})
            break

        if finish_reason == "tool_calls" or msg.tool_calls:
            # Exclude None fields — Together.ai rejects null fields like refusal/audio on follow-up turns
            history.append(msg.model_dump(exclude_none=True))

            for tc in msg.tool_calls:
                try:
                    tool_input = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    tool_input = {}
                tool_output = await _dispatch_tool(tc.function.name, tool_input, state)

                if tc.function.name in ("shutdown_pipes", "run_simulation"):
                    network_state_changed = True
                _record_side_effects(tc.function.name, tool_output, tool_call_records, affected_nodes)
                tool_call_records.append(ToolCallRecord(
                    tool=tc.function.name, input=tool_input, output=tool_output,
                ))

                history.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(tool_output),
                })
        else:
            reply_text = f"[Unexpected finish reason: {finish_reason}]"
            break
    else:
        reply_text = "[Reached maximum tool iteration limit. Please simplify your request.]"

    _history_openai[request.session_id] = history
    return ChatResponse(
        session_id=request.session_id,
        reply=reply_text,
        tool_calls=tool_call_records,
        affected_nodes=affected_nodes,
        network_state_changed=network_state_changed,
    )


# ---------------------------------------------------------------------------
# Side-effect tracker (shared)
# ---------------------------------------------------------------------------

def _record_side_effects(
    tool_name: str,
    tool_output: dict,
    tool_call_records: list,
    affected_nodes: list,
) -> None:
    if tool_name == "get_affected_nodes":
        for n in tool_output.get("nodes", []):
            affected_nodes.append(AffectedNode(
                node_id=n["node_id"],
                pressure_bar=n["pressure_bar"],
                head_m=n["head_m"],
                lat=n["lat"],
                lon=n["lon"],
                elevation_m=n["elevation_m"],
                zone=n.get("zone"),
                zone_display=n.get("zone_display"),
            ))


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def handle_message(request: ChatRequest, state) -> ChatResponse:
    provider = settings.llm_provider.lower()
    if provider == "anthropic":
        return await _handle_anthropic(request, state)
    elif provider in ("openai", "together"):
        return await _handle_openai_compatible(request, state)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider!r}. Use 'anthropic', 'openai', or 'together'.")
