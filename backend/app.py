import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

from routes import ai_routes, portfolio_routes, timemachine_routes

for module in (portfolio_routes, ai_routes, timemachine_routes):
    app.register_blueprint(module.bp)


@app.get("/api/health")
def health():
    return {"ok": True, "mocks": os.getenv("USE_MOCKS", "1") == "1"}


if __name__ == "__main__":
    app.run(port=int(os.getenv("FLASK_PORT", "5000")), debug=True)
