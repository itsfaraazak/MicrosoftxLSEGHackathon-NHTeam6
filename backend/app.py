import json
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])
MOCKS = Path(__file__).parent / "mocks"
USE_MOCKS = os.getenv("USE_MOCKS", "1") == "1"


def mock(name: str):
    return jsonify(json.loads((MOCKS / f"{name}.json").read_text()))


@app.get("/api/health")
def health():
    return {"ok": True, "mocks": USE_MOCKS}


@app.post("/api/profile/parse")
def profile_parse():
    if USE_MOCKS:
        return mock("profile_parse")
    from ai.functions import parse_profile
    return jsonify(parse_profile(request.json["text"]))


@app.post("/api/portfolio")
def portfolio():
    if USE_MOCKS:
        return mock("portfolio")
    raise NotImplementedError("Person 2: engine.portfolio.build + ai.functions.explain")


@app.post("/api/compare")
def compare():
    if USE_MOCKS:
        return mock("compare")
    raise NotImplementedError("Person 2")


@app.get("/api/replay")
def replay():
    if USE_MOCKS:
        return mock("replay")
    raise NotImplementedError("Person 2: engine.guard.replay + ai.functions.coach")


@app.post("/api/ask")
def ask():
    if USE_MOCKS:
        return mock("ask")
    from ai.functions import answer
    body = request.json
    return jsonify(answer(body["question"], body["profile"], body["sim_date"]))


@app.post("/api/agent/step")
def agent_step():
    if USE_MOCKS:
        return mock("agent_step")
    raise NotImplementedError("Bonus: engine.agent")


if __name__ == "__main__":
    app.run(port=int(os.getenv("FLASK_PORT", "5000")), debug=True)
