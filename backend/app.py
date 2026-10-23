import os
import time

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()
app = Flask(__name__)
CORS(app, origins=[f"http://{h}:{p}" for h in ("localhost", "127.0.0.1") for p in (3000, 3001, 3055)])

from routes import ai_routes, portfolio_routes, timemachine_routes

for module in (portfolio_routes, ai_routes, timemachine_routes):
    app.register_blueprint(module.bp)

for _name in ("proof_routes", "live_routes", "audit_routes"):
    try:
        _mod = __import__(f"routes.{_name}", fromlist=["bp"])
    except ImportError:  # optional feature not present in this checkout
        continue
    app.register_blueprint(_mod.bp)


_hits: dict[str, list[float]] = {}
LIMITED = ("/api/ask", "/api/profile/parse", "/api/portfolio")


@app.before_request
def rate_limit():
    """Public demo URL: cap LLM-backed routes per client (60/min) so a stray loop can't burn the team key."""
    if request.path not in LIMITED:
        return None
    ip = (request.headers.get("X-Forwarded-For") or request.remote_addr or "?").split(",")[0].strip()
    now = time.monotonic()
    window = [t for t in _hits.get(ip, []) if now - t < 60]
    if len(window) >= int(os.getenv("RATE_LIMIT_PER_MIN", "60")):
        return jsonify({"error": "Too many requests, slow down", "fallback": True}), 429
    window.append(now)
    _hits[ip] = window
    return None


@app.get("/api/health")
def health():
    return {"ok": True, "mocks": os.getenv("USE_MOCKS", "1") == "1"}


if __name__ == "__main__":
    app.run(port=int(os.getenv("FLASK_PORT", "5000")), debug=True)
