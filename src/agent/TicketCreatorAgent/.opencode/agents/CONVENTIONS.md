# CONVENTIONS.md

## Python Version & Tooling

- **Python 3.11+** required. Use modern syntax: `match`, `X | Y` union types, `tomllib`, etc.
- **Formatter**: `black` (line length 88). Non-negotiable — no manual formatting debates.
- **Linter**: `ruff` with default rules enabled. Fix all warnings before committing.
- **Type checker**: `mypy` in strict mode. All public functions must have full type annotations.
- **Dependency management**: `pip` + `requirements.txt` for simplicity, or `uv` if speed matters.

---

## Project Layout Conventions

- All application code lives under `app/`
- One module per responsibility — do not create "utils.py" dumping grounds
- Module names are lowercase, underscore-separated (`ticket_agent.py`, not `TicketAgent.py`)
- Tests mirror the `app/` structure under `tests/`

---

## SOLID Principles

### Single Responsibility
Every class and function does exactly one thing. If you find yourself writing "and" in a docstring (`"validates input and calls the agent"`), split it into two functions.

```python
# ❌ Bad — two responsibilities
async def validate_and_create_ticket(req: TicketRequest): ...

# ✅ Good — each function has one job
def validate_ticket_request(req: TicketRequest) -> None: ...
async def create_ticket(req: TicketRequest) -> TicketResult: ...
```

### Open/Closed
Extend behaviour through abstraction, not by modifying existing code. Use abstract base classes or Protocols for components that may have multiple implementations (e.g. different LLM backends or MCP transports).

```python
from typing import Protocol

class LLMBackend(Protocol):
    async def generate(self, prompt: str) -> str: ...
```

### Liskov Substitution
Subclasses must honour the contract of their parent. If overriding a method, do not change its signature or narrow its accepted types.

### Interface Segregation
Keep interfaces small and focused. A class that only needs to generate text should not depend on a class that also manages MCP connections.

### Dependency Inversion
High-level modules (handlers, agents) depend on abstractions, not concrete implementations. Inject dependencies via function parameters or constructors — do not instantiate collaborators inside business logic.

```python
# ❌ Bad — hard dependency
async def run_agent(prompt: str):
    llm = ChatOpenAI(api_key=os.environ["OPENAI_API_KEY"])  # hardcoded inside

# ✅ Good — injected
async def run_agent(prompt: str, llm: BaseChatModel) -> str: ...
```

---

## General Coding Practices

### Functions & Methods
- Functions should be **short** (aim for < 20 lines). If a function is longer, break it up.
- Prefer **pure functions** — same input always produces same output, no side effects.
- Use **keyword arguments** for anything beyond two positional parameters.
- Avoid boolean flag parameters — they usually signal a function doing two things.

```python
# ❌ Bad
def create_ticket(req, send_email=True): ...

# ✅ Good
def create_ticket(req: TicketRequest) -> TicketResult: ...
def notify_customer(ticket: TicketResult) -> None: ...
```

### Type Annotations
- Annotate **all** function signatures (parameters and return types).
- Use `from __future__ import annotations` at the top of every file for forward references.
- Use `TypeAlias` for complex repeated types.
- Never use `Any` unless wrapping a truly untyped 3rd-party interface, and always add a `# type: ignore` comment explaining why.

### Error Handling
- **Never silence exceptions** with a bare `except: pass`.
- Catch the most specific exception type possible.
- Use custom exception classes for domain errors — do not raise raw `Exception("something went wrong")`.
- Always log the original exception when re-raising or wrapping.

```python
# ❌ Bad
try:
    result = await agent.run(prompt)
except Exception:
    pass

# ✅ Good
try:
    result = await agent.run(prompt)
except OpenAIError as exc:
    logger.error("OpenAI call failed: %s", exc)
    raise TicketGenerationError("LLM unavailable") from exc
```

### Async Code
- Use `async def` for all I/O-bound functions (HTTP calls, MCP communication).
- Never call blocking code inside a coroutine — use `asyncio.to_thread()` if unavoidable.
- Do not mix `asyncio.run()` with framework event loops (FastAPI manages its own loop).

### Configuration
- All configuration comes from `config.py` — never read `os.environ` or `.env` directly in other modules.
- Fail fast at startup if required config is missing (`pydantic-settings` handles this automatically by raising `ValidationError`).
- Never commit `.env` files. Provide `.env.example` with placeholder values.

### Logging
- Use Python's standard `logging` module — not `print()`.
- Get a per-module logger: `logger = logging.getLogger(__name__)`.
- Log at appropriate levels: `DEBUG` for trace info, `INFO` for normal operations, `WARNING` for recoverable issues, `ERROR` for failures.
- Never log secrets (API keys, tokens, passwords).

### Imports
- Standard library imports first, then 3rd-party, then local — separated by blank lines (enforced by `ruff`).
- No wildcard imports (`from module import *`).
- Absolute imports only — no relative imports (`from .module` is acceptable within a package, but prefer absolute).

---

## FastAPI Conventions

- All route handlers are `async def`.
- Request bodies are always Pydantic `BaseModel` subclasses — never raw `dict`.
- Response models are always declared on the route decorator (`response_model=...`).
- Use `HTTPException` for expected error responses; let unhandled exceptions propagate to a global exception handler.
- Group related routes using `APIRouter` and include them in `main.py`.

---

## LangChain Conventions

- Never build prompt strings with f-strings inside handlers. All prompts live in `prompts/`.
- Always use `ChatPromptTemplate` — not plain string prompts.
- The `AgentExecutor` is **not** a singleton — create it per request to avoid shared state.
- Prefer `ainvoke` over `invoke` everywhere (this is an async codebase).
- Do not catch `LangChainException` generically — handle specific error types.

---

## Testing

- Every public function in `agents/` and `models/` must have at least one unit test.
- Use `pytest` with `pytest-asyncio` for async tests.
- Mock external calls (OpenAI, MCP) using `unittest.mock.AsyncMock` — tests must never make real network calls.
- Test file names: `test_<module_name>.py`.
- Aim for high coverage on business logic; do not chase 100% coverage on boilerplate.

---

## Git & Commit Conventions

- Commits follow **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Each commit should represent one logical change.
- Do not commit commented-out code or debugging statements.
- Branch names: `feat/<short-description>` or `fix/<short-description>`
