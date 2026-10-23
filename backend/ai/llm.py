"""LLM client: Azure AI Foundry / Azure OpenAI via the v1 endpoint. Swap provider here only."""
import os

from openai import OpenAI

SYSTEM = (
    "Today is {sim_date}. Use only the facts provided. Never predict. "
    "If the facts do not answer the question, say you don't know. "
    "Every number you write must appear in the facts."
)


def client() -> OpenAI:
    endpoint = os.environ["AZURE_OPENAI_ENDPOINT"].rstrip("/")
    return OpenAI(base_url=f"{endpoint}/openai/v1/", api_key=os.environ["AZURE_OPENAI_API_KEY"])


def chat(sim_date: str, user: str, *, json_mode: bool = False) -> str:
    kwargs = {"response_format": {"type": "json_object"}} if json_mode else {}
    r = client().chat.completions.create(
        model=os.environ["AZURE_OPENAI_DEPLOYMENT"],
        messages=[{"role": "system", "content": SYSTEM.format(sim_date=sim_date)},
                  {"role": "user", "content": user}],
        **kwargs,
    )
    return r.choices[0].message.content or ""
