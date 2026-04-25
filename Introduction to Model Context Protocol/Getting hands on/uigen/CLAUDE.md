# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # First-time setup: install deps, generate Prisma client, run migrations
npm run dev            # Start dev server with Turbopack at http://localhost:3000
npm run build          # Production build
npm run lint           # ESLint
npm test               # Run all Vitest tests
npx vitest run src/path/to/__tests__/file.test.ts  # Run a single test file
npm run db:reset       # Reset SQLite database (destructive)
```

The dev server requires `NODE_OPTIONS='--require ./node-compat.cjs'` (already included in npm scripts) due to a Node.js compatibility shim.

## Architecture Overview

UIGen is an AI-powered React component generator. Users describe components in chat; Claude generates code that is immediately previewed in an iframe — no files are written to disk.

### Core data flow

1. **Chat** (`src/app/api/chat/route.ts`) — The POST handler receives chat messages plus the serialized virtual file system. It calls Claude via the Vercel AI SDK (`streamText`) with two tools: `str_replace_editor` and `file_manager`. Tool calls stream back to the client in real time.

2. **Virtual File System** (`src/lib/file-system.ts`) — An in-memory tree (`VirtualFileSystem`) backed by a `Map<string, FileNode>`. The server reconstructs it from JSON on each request, applies tool-call mutations, then returns the updated state. No files ever touch the real filesystem.

3. **File System Context** (`src/lib/contexts/file-system-context.tsx`) — React context that owns the client-side `VirtualFileSystem` instance. It intercepts tool calls from the AI SDK (`handleToolCall`) and applies mutations (create/str_replace/insert/rename/delete) to keep the in-memory FS in sync with what Claude produced.

4. **Chat Context** (`src/lib/contexts/chat-context.tsx`) — Wraps the Vercel AI SDK `useChat` hook. Serializes `fileSystem.serialize()` into every request body so the server always has the current FS state.

5. **Preview** (`src/components/preview/PreviewFrame.tsx`) — Watches `refreshTrigger` from the file system context. On each change it calls `createImportMap` + `createPreviewHTML` (from `src/lib/transform/jsx-transformer.ts`) which transpiles all JSX/TSX files in the browser via Babel Standalone and renders them in a sandboxed `<iframe>`.

6. **Provider** (`src/lib/provider.ts`) — Returns the real `anthropic(MODEL)` when `ANTHROPIC_API_KEY` is set; otherwise falls back to `MockLanguageModel` which streams hard-coded component templates. Model is `claude-haiku-4-5`.

### Authentication

JWT-based sessions stored in a cookie (`session`). `src/lib/auth.ts` handles sign-up/sign-in (bcrypt passwords), session creation (jose JWT), and verification. Middleware (`src/middleware.ts`) guards `/api/projects` and `/api/filesystem`. `/api/chat` is public; project persistence is skipped for unauthenticated users.

### Persistence

Prisma with SQLite (`prisma/dev.db`). Two models: `User` and `Project`. A `Project` stores the full message history and VFS state as JSON strings (`messages`, `data` columns). The Prisma client is generated into `src/generated/prisma/`.

### AI Tools

- `str_replace_editor` (`src/lib/tools/str-replace.ts`) — Implements `view`, `create`, `str_replace`, and `insert` commands against the `VirtualFileSystem`.
- `file_manager` (`src/lib/tools/file-manager.ts`) — Implements `rename` and `delete`.

### Anonymous work tracking

`src/lib/anon-work-tracker.ts` persists chat messages and FS state to `localStorage` for users who haven't signed in, so their work survives a page refresh and can be prompted for save on sign-up.

## Key conventions

- All function parameters and return values must have explicit TypeScript type annotations.
- Use comments sparingly. Only comment complex code.
- UI primitives live in `src/components/ui/` (shadcn/Radix-based).
- Server-only modules import from `"server-only"` to prevent client bundle leakage.
- `@/` path alias maps to `src/`.
- The database schema is defined in the `prisma/schema.prisma` file. Reference it anytime you need to understand the structure of data stored in the database.
