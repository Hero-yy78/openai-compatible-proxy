# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI SDKs**: `@anthropic-ai/sdk`, `openai` (direct, no integration lib wrapper)

## OpenAI-Compatible Reverse Proxy API

The API server exposes a fully OpenAI-compatible proxy at `/api/v1/`:

### Endpoints

- `GET /api/v1/models` — List all supported models
- `GET /api/v1/models/:model` — Get specific model info
- `POST /api/v1/chat/completions` — OpenAI-compatible chat completions (streaming + non-streaming)

### Supported Models

**Anthropic (via Replit AI Integrations):**
- `claude-opus-4-6`, `claude-opus-4-5`, `claude-opus-4-1`
- `claude-sonnet-4-6`, `claude-sonnet-4-5`
- `claude-haiku-4-5`

**OpenAI (via Replit AI Integrations):**
- `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`
- `gpt-4o`, `gpt-4o-mini`
- `o4-mini`, `o3`

### Features

- **Tool Call / Function Calling**: Full support for both Claude and GPT models
  - Anthropic tool_use → OpenAI tool_calls format conversion
- **SSE Streaming**: Real-time token-by-token streaming in OpenAI chunk format
- **Model routing**: Automatically routes claude-* models to Anthropic API, all others to OpenAI
- **Body size limit**: 50MB (supports multimodal inputs)
- **No auth required**: Replit AI Integrations handles API keys automatically

### Route Files

- `artifacts/api-server/src/routes/v1/chat-completions.ts` — Core proxy logic
- `artifacts/api-server/src/routes/v1/models.ts` — Models list endpoint
- `artifacts/api-server/src/routes/v1/index.ts` — v1 router

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
