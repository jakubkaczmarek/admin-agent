# Task 1: RAG Infrastructure Setup

## Overview

Enhance the application architecture to support **Retrieval-Augmented Generation (RAG)**. This is a foundational task — subsequent agents (autoreply, autocomplete) will depend on the RAG pipeline to make context-aware decisions grounded in system documentation.

Reference article for approach and implementation details:
https://www.datacamp.com/tutorial/building-a-rag-system-with-langchain-and-fastapi

---

## What RAG Adds

Without RAG, agents reason purely from ChatGPT's general training data. With RAG, agents can query a curated vector store built from your own documents (system manuals, FAQs, policy docs, etc.) before generating a response — making replies accurate and scoped to the actual system.

```
User message
     │
     ▼
 Embed query → search vector store → retrieve relevant document chunks
                                              │
                                              ▼
                               Inject chunks into LLM prompt
                                              │
                                              ▼
                              LLM generates grounded response
```

---

## New Dependencies

```
langchain-community
faiss-cpu          # local vector store (no external service required)
pypdf              # PDF document loading
tiktoken           # token-aware text splitting
```

Add all to `requirements.txt`.

---

## New Environment Variables (`.env`)

| Variable | Description |
|---|---|
| `RAG_DOCS_PATH` | Path to directory containing source documents (default: `./docs`) |
| `RAG_CHUNK_SIZE` | Token size per text chunk (default: `500`) |
| `RAG_CHUNK_OVERLAP` | Token overlap between chunks (default: `50`) |
| `RAG_TOP_K` | Number of chunks to retrieve per query (default: `4`) |

---

## Architecture Changes

### New module: `app/rag/`

```
app/
└── rag/
    ├── loader.py       # Document loading and text splitting
    ├── vectorstore.py  # Vector store initialisation and persistence
    └── retriever.py    # Retriever factory used by agents
```

### `rag/loader.py`
- Use `langchain_community.document_loaders.PyPDFLoader` for `.pdf` files
- Use `langchain_community.document_loaders.TextLoader` for `.txt` / `.md` files
- Scan the entire `RAG_DOCS_PATH` directory recursively and load all supported files
- Split all loaded documents using `RecursiveCharacterTextSplitter` with `RAG_CHUNK_SIZE` and `RAG_CHUNK_OVERLAP`
- Return a flat `list[Document]`

### `rag/vectorstore.py`
- Embed documents using `OpenAIEmbeddings` (reuses `OPENAI_API_KEY` from config)
- Store vectors in a local **FAISS** index
- On startup: if a persisted index exists on disk (`./faiss_index`), load it; otherwise build from documents and persist it
- Expose a `get_vectorstore() -> FAISS` function

### `rag/retriever.py`
- Expose a `get_retriever() -> VectorStoreRetriever` factory function
- Applies `RAG_TOP_K` as `search_kwargs={"k": settings.rag_top_k}`
- This is the only entry point agents should use — they must not import `vectorstore.py` directly

### `config.py` changes
- Add the four new RAG settings fields to the `Settings` class

### `main.py` changes
- On application startup (`@app.on_event("startup")`), trigger vector store initialisation so the index is ready before any request arrives
- If `RAG_DOCS_PATH` is empty or missing, log a warning but do not crash — agents will simply have no RAG context

---

## Document Upload Endpoint (optional but recommended)

### `POST /rag/ingest`

Accepts one or more uploaded files (`.pdf`, `.txt`, `.md`), saves them to `RAG_DOCS_PATH`, rebuilds the FAISS index, and persists it.

```json
// Response
{
  "ingested": ["system-manual.pdf", "faq.md"],
  "chunks_indexed": 142
}
```

This allows adding new documentation without restarting the service.

---

## How Agents Use RAG

Agents that need RAG context should use a `RetrievalQA` chain or pass the retriever into their prompt pipeline. The pattern is:

```python
from app.rag.retriever import get_retriever
from langchain.chains import RetrievalQA

retriever = get_retriever()
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
)
answer = await qa_chain.ainvoke({"query": "Does the system support CSV imports?"})
```

Agents must **not** build their own retrievers — always import from `app.rag.retriever`.

---

## Acceptance Criteria

- On startup, the app loads and indexes all documents from `RAG_DOCS_PATH` into a FAISS vector store
- The FAISS index is persisted to disk and reloaded on subsequent startups (no re-indexing unless documents change)
- `get_retriever()` returns a working retriever usable by any LangChain agent or chain
- The optional `/rag/ingest` endpoint rebuilds the index and returns a count of indexed chunks
- If `RAG_DOCS_PATH` is empty, the app starts normally with a warning log
- No agent imports `vectorstore.py` directly — all RAG access goes through `retriever.py`
