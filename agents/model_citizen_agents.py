import os
import secrets
import time
from typing import Any, Dict

from uagents import Agent, Context, Model


class DispatchRequest(Model):
    task: str
    payload: Dict[str, Any]


class DispatchResponse(Model):
    task: str
    accepted: bool
    agent_address: str
    received_at: int


agent = Agent(
    name="model-citizen-orchestrator",
    seed=os.environ.get("UAGENTS_SEED") or secrets.token_hex(32),
    port=int(os.environ.get("UAGENTS_PORT", "8000")),
    endpoint=[os.environ.get("UAGENTS_ENDPOINT", "http://localhost:8000/submit")],
)


@agent.on_rest_post("/dispatch", DispatchRequest, DispatchResponse)
async def dispatch(ctx: Context, req: DispatchRequest) -> DispatchResponse:
    ctx.logger.info("Accepted Model Citizen task: %s", req.task)
    return DispatchResponse(
        task=req.task,
        accepted=True,
        agent_address=ctx.agent.address,
        received_at=int(time.time()),
    )


if __name__ == "__main__":
    agent.run()
