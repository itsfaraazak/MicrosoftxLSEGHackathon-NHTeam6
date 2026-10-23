"""Pre-warm the backend caches for the demo personas so the first judge click is instant.
Usage: python scripts/prewarm.py [http://localhost:5070]"""
import json
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from engine.personas import PERSONAS

base = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5070").rstrip("/")


def post(path, body):
    req = urllib.request.Request(base + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    t = time.time()
    with urllib.request.urlopen(req, timeout=60) as r:
        r.read()
        return r.status, round(time.time() - t, 1)


profiles = [p if isinstance(p, dict) else p.model_dump(mode="json") for p in PERSONAS.values()] \
    if isinstance(PERSONAS, dict) else []
for p in profiles:
    print(p.get("name"), "portfolio", post("/api/portfolio", {"profile": p, "sim_date": "2022-01-03"}))
print("compare", post("/api/compare", {"profiles": profiles, "sim_date": "2022-01-03"}))
print("proof", post("/api/proof", {"sim_date": "2022-01-03"}))
