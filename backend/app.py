import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()
app = Flask(__name__)
CORS(app, origins=[f"http://{h}:{p}" for h in ("localhost", "127.0.0.1") for p in (3000, 3001, 3055)])

from routes import ai_routes, portfolio_routes, timemachine_routes

for module in (portfolio_routes, ai_routes, timemachine_routes):
    app.register_blueprint(module.bp)

try:
    from routes import proof_routes
except ImportError:  # proof feature not present in this checkout
    proof_routes = None
if proof_routes:
    app.register_blueprint(proof_routes.bp)


@app.get("/api/health")
def health():
    return {"ok": True, "mocks": os.getenv("USE_MOCKS", "1") == "1"}


if __name__ == "__main__":
    app.run(port=int(os.getenv("FLASK_PORT", "5000")), debug=True)
