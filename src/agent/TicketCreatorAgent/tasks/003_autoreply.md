# Endpoint
Create new POST endpoint:
/tickets/all/autoreply

Endpoint logic: similar to other agents - start agentic process in background and return jobId

# New Agentic process
* implement multi-agent system using CrewAI framework
* include knowledge base based on text files (app/crewai/documents/*.txt)

# Multi agent system setup

## Crew
Crew name: TicketReplyCrew
Input: { "ticket_id": "..." }

## Tools
get_support_thread_by_id(ticket_id)
kb_search(query)
create_support_message(ticket_id, content)

## Agents (3 total)

1. Fetcher + Analyzer
Calls: get_support_thread_by_id
Uses: kb_search
Outputs (JSON):
{
  "should_reply": true, // false if last message was created by 'SupportAgent' - expects to cancel rest of flow in that case
  "analysis": "...",
  "proposed_reply": "...",
  "confidence": 0.85
}

2. Response Writer
Input: analyzer output
Produces final, clean reply (string)

3. Sender
If should_reply == true
Calls: create_support_message

## Flow
ticket_id
  ↓
Analyzer (fetch + reason + draft)
  ↓
Writer (polish)
  ↓
Sender (post via MCP)

# Notes
* API endpoint schedules new job (schedule_job) and calls new agent through run_for_all_threads orchestration provided by support_threads_orchestrator
* Analyzer does heavy lifting
* Keep JSON between agents strict using strongly-typed Pydantic model
* implement new agent code in app/crewai folder