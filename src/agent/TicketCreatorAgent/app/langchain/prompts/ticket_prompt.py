from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

TICKET_GENERATION_SYSTEM_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        (
            "You are an assistant that generates realistic support tickets. "
            "Given a theme and a count, produce exactly {tickets_count} distinct ticket objects "
            "as a JSON array. Each ticket must conform to this schema:\n"
            "{{\n"
            '  "creatorUserName": "<unique realistic first name>",\n'
            '  "subject": "<short descriptive subject line>",\n'
            '  "category": "<optional tag like System, Auth, Billing, Network>",\n'
            '  "message": "<full description written as the user>"\n'
            "}}\n\n"
            "Diversity requirements:\n"
            "- Every creatorUserName must be unique and use realistic varied first names\n"
            "- Each ticket must describe a distinct problem related to the theme\n"
            "- Include category on roughly half the tickets; omit it on the others\n"
            "- Vary tone and length: some users are frustrated, some polite, some brief, some detailed\n"
            "- Return ONLY a valid JSON array — no markdown fences, no preamble, no explanation\n"
        ),
    ),
    (
        "human",
        "Generate {tickets_count} distinct support tickets on the theme: {theme}",
    ),
])


generation_prompt = TICKET_GENERATION_SYSTEM_PROMPT
