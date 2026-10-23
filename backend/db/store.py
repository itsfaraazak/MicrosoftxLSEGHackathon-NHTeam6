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


def recent(limit: int = 50, kinds: list[str] | str | None = None) -> list[dict]:
    """Most-recent-first audit events, optionally filtered to `kinds`. Reads Cosmos if configured, else the
    local JSONL. Safe if the store is empty/missing/corrupt - returns [] rather than raising, since this
    backs a read-only diagnostics endpoint that must never 500."""
    if isinstance(kinds, str):
        kinds = [kinds]
    try:
        c = _cosmos()
        if c:
            docs = list(c.query_items(query="SELECT * FROM c", enable_cross_partition_query=True))
        else:
            if not LOCAL.exists():
                return []
            docs = []
            for line in LOCAL.read_text().splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    docs.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        if kinds:
            docs = [d for d in docs if d.get("kind") in kinds]
        docs.sort(key=lambda d: d.get("ts", 0), reverse=True)
        return docs[:limit]
    except Exception:  # noqa: BLE001 - a diagnostics read must never break the app
        return []
