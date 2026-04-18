from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import yaml
from crewai import LLM, Agent, Crew, Process, Task

from app.config import Settings
from app.crewai.models import AnalyzerOutput
from app.crewai.tools import make_tools
from app.langchain.models.autoreply import AutoreplyResult

logger = logging.getLogger(__name__)

_AGENTS_DIR = Path(__file__).parent / "agents"


def _load_agent_yaml(name: str) -> dict:
    with open(_AGENTS_DIR / f"{name}.yaml") as f:
        return yaml.safe_load(f)


def _build_agents(llm: LLM, tools_map: dict) -> dict[str, Agent]:
    configs = {
        "fetcher_analyzer": _load_agent_yaml("fetcher_analyzer"),
        "response_writer": _load_agent_yaml("response_writer"),
        "sender": _load_agent_yaml("sender"),
    }
    agents = {}
    for key, cfg in configs.items():
        agent_tools = [tools_map[t] for t in (cfg.get("tools") or []) if t in tools_map]
        agents[key] = Agent(
            role=cfg["role"],
            goal=cfg["goal"],
            backstory=cfg["backstory"],
            tools=agent_tools,
            llm=llm,
            verbose=True,
        )
    return agents


def _build_tasks(agents: dict[str, Agent], thread_id: int) -> tuple[Task, Task, Task]:
    analyze_task = Task(
        description=(
            f"Fetch support thread {thread_id} using the get_support_thread_by_id tool. "
            "Review all messages in the thread. "
            "Search the knowledge base using kb_search for relevant company policies. "
            "Determine whether a reply is needed. "
            "Set should_reply to false if the last message was authored by 'SupportAgent'. "
            "Output ONLY a raw JSON object with exactly these fields: "
            "should_reply (bool), analysis (str), proposed_reply (str), confidence (float 0-1). "
            "No markdown, no preamble, no explanation — just the JSON object."
        ),
        expected_output=(
            'A raw JSON object: {"should_reply": bool, "analysis": str, '
            '"proposed_reply": str, "confidence": float}'
        ),
        agent=agents["fetcher_analyzer"],
    )

    write_task = Task(
        description=(
            "Review the analysis JSON from the previous task. "
            "If should_reply is false, output exactly the string NO_REPLY_NEEDED and nothing else. "
            "Otherwise, take the proposed_reply and polish it into a warm, professional, "
            "concise support reply. Output ONLY the final reply text — no JSON, no preamble."
        ),
        expected_output="Either the string NO_REPLY_NEEDED or a polished reply message.",
        context=[analyze_task],
        agent=agents["response_writer"],
    )

    send_task = Task(
        description=(
            f"You have the finalized reply from the writer and the analysis from the analyzer. "
            "If the writer output is NO_REPLY_NEEDED or the analysis shows should_reply is false, "
            "output exactly SKIPPED and do NOT call any tools. "
            f"Otherwise call create_support_message with ticket_id={thread_id} and "
            "the polished reply as the content. Output SENT on success."
        ),
        expected_output="Either SKIPPED or SENT.",
        context=[analyze_task, write_task],
        agent=agents["sender"],
    )

    return analyze_task, write_task, send_task


async def process_thread(
    session,  # noqa: ARG001 — required by run_for_all_threads signature; tools open their own sessions
    thread_id: int,
    settings: Settings,
) -> AutoreplyResult:
    try:
        tools_map = make_tools(settings)
        llm = LLM(
            model=f"openai/{settings.openai_model}",
            api_key=settings.openai_api_key,
            temperature=0,
        )
        agents = _build_agents(llm, tools_map)
        analyze_task, write_task, send_task = _build_tasks(agents, thread_id)

        crew = Crew(
            agents=list(agents.values()),
            tasks=[analyze_task, write_task, send_task],
            process=Process.sequential,
            verbose=True,
        )

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: crew.kickoff(inputs={"ticket_id": str(thread_id)}),
        )

        analyzer_raw = (analyze_task.output.raw or "{}") if analyze_task.output else "{}"
        try:
            analyzer_output = AnalyzerOutput.model_validate_json(analyzer_raw)
            should_reply = analyzer_output.should_reply
            analysis = analyzer_output.analysis
        except Exception:
            logger.warning("Could not parse analyzer output for thread %d: %s", thread_id, analyzer_raw[:200])
            should_reply = False
            analysis = "Failed to parse analyzer output."

        writer_raw = (write_task.output.raw or "").strip() if write_task.output else ""
        sender_raw = (send_task.output.raw or "").strip() if send_task.output else ""

        if should_reply and "SKIPPED" not in sender_raw.upper():
            return AutoreplyResult(
                id=thread_id,
                action="replied",
                analysis=analysis,
                message=writer_raw,
            )
        return AutoreplyResult(
            id=thread_id,
            action="skipped",
            analysis=analysis,
            message="Skipped — last message was from SupportAgent." if not should_reply else "Skipped by sender.",
        )

    except Exception as exc:
        logger.error("Autoreply failed for thread %d: %s", thread_id, exc, exc_info=True)
        return AutoreplyResult(
            id=thread_id,
            action="error",
            analysis="",
            message=f"Error: {exc}",
        )
