from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

_CATEGORIZE_SYSTEM_PROMPT = (
    "You are an assistant that classifies support ticket messages into categories.\n"
    "You will receive the content of the first message in a support ticket.\n"
    "Your task is to return ONLY the category name that best fits the message.\n"
    "Respond with only the category name — no explanation, no punctuation, no JSON wrapper.\n"
)

_CATEGORIZE_SYSTEM_PROMPT_WITH_CATEGORIES = (
    _CATEGORIZE_SYSTEM_PROMPT
    + "\n\n"
    "You MUST choose a category from the following allowed categories only:\n"
    "{allowed_categories}\n"
    "Do NOT invent any category outside this list. Treat this list as an exhaustive enum.\n"
)

CATEGORIZE_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        _CATEGORIZE_SYSTEM_PROMPT_WITH_CATEGORIES,
    ),
    (
        "human",
        "Message content:\n{message}",
    ),
])

CATEGORIZE_PROMPT_NO_CATEGORIES = ChatPromptTemplate.from_messages([
    (
        "system",
        _CATEGORIZE_SYSTEM_PROMPT,
    ),
    (
        "human",
        "Message content:\n{message}",
    ),
])
