# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
uv venv && source .venv/bin/activate
uv pip install -e .

# Run the MCP server
uv run main.py

# Run all tests
uv run pytest

# Run a single test
uv run pytest tests/test_document.py::TestBinaryDocumentToMarkdown::test_binary_document_to_markdown_with_docx
```

## Architecture

This is a **FastMCP server** (`mcp==1.8.0`) that exposes Python functions as MCP tools to AI assistants.

**Entry point:** `main.py` — creates the `FastMCP` instance, registers tools via `mcp.tool()(fn)`, and calls `mcp.run()`.

**Tool modules** live in `tools/`. Each module defines standalone Python functions. A function is registered as an MCP tool by calling `mcp.tool()(fn)` in `main.py` — the function itself has no MCP-specific imports.

**Currently registered tools:**
- `tools/math.py` → `add` — example arithmetic tool
- `tools/document.py` → `binary_document_to_markdown` — converts binary PDF/DOCX data to markdown via `markitdown`; not yet registered in `main.py` (intended to be wired up)

## Defining MCP Tools

Tools are plain Python functions registered in `main.py`:

```python
from tools.my_module import my_function
mcp.tool()(my_function)
```

Use `pydantic.Field` for parameter descriptions — MCP exposes these to the AI client:

```python
from pydantic import Field

def my_tool(
    param1: str = Field(description="What this parameter does"),
    param2: int = Field(description="What this parameter does"),
) -> ReturnType:
    """One-line summary.

    Detailed explanation of functionality.

    When to use:
    - Use case A
    - Use case B

    Examples:
    >>> my_tool("foo", 42)
    "result"
    """
```

Docstring structure matters — the AI assistant reads it to understand when and how to invoke the tool. Include: summary, detailed behavior, when to use (and not use), and concrete examples with expected output.

## Code Style

Always apply explicit type annotations to all function parameters and return values.

## Tests

Test fixtures (`.docx`, `.pdf`) live in `tests/fixtures/`. Tests import tool functions directly and call them with binary data — there is no MCP layer involved in tests.
