"""Precompute real LLM coach messages into data/coach_cache.json (used by /api/replay when present)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import guard
from engine.personas import PERSONAS

if __name__ == "__main__":
    cache = {}
    for pid in PERSONAS:
        for ev in guard.replay(pid, use_llm=True)["events"]:
            cache[f"{pid}|{ev['sim_date']}"] = ev["coach_message"]
            print(pid, ev["sim_date"], ev["coach_message"])
    guard.COACH_CACHE.write_text(json.dumps(cache, indent=2))
