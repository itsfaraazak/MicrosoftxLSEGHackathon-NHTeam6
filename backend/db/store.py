"""Audit log + saved profiles. Azure Cosmos DB when configured, local JSONL otherwise.
Every input/output/trade is logged here (plan: 'No audit trail' guardrail)."""
import json
import os
import time
import uuid
from pathlib import Path

LOCAL = Path(__file__).parent.parent / "data" / "local_store.jsonl"
_container = None


def _cosmos():
    global _container
    if _container is None and os.getenv("COSMOS_ENDPOINT") and os.getenv("COSMOS_KEY"):
        from azure.cosmos import CosmosClient, PartitionKey
        c = CosmosClient(os.environ["COSMOS_ENDPOINT"], os.environ["COSMOS_KEY"])
        db = c.create_database_if_not_exists(os.getenv("COSMOS_DATABASE", "dontdoubledown"))
        _container = db.create_container_if_not_exists("events", PartitionKey(path="/kind"))
    return _container


def log(kind: str, payload: dict) -> dict:
    """kind: profile | portfolio | explanation | guard_event | agent_action | llm_call"""
    doc = {"id": str(uuid.uuid4()), "kind": kind, "ts": time.time(), "payload": payload}
    c = _cosmos()
    if c:
        c.upsert_item(doc)
    else:
        LOCAL.parent.mkdir(exist_ok=True)
        with LOCAL.open("a") as f:
            f.write(json.dumps(doc) + "\n")
    return doc
