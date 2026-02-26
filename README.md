# TypeCast AI

The smallest, most reliable, and most developer-friendly way to get **structured data** out of any LLM. Think “Axios of AI”: contract-first with Zod, provider-agnostic, and built for the edge.

## Features

- **Contract-first** – Define your output with Zod; the library handles the rest.
- **Provider-agnostic** – One interface for OpenAI, Anthropic, and local LLMs (e.g. Ollama).
- **Zero-bloat** – Minimal dependencies, built for Vercel/Cloudflare Edge.

## Install

```bash
npm install typecast-ai zod
```

## Quick Start

```ts
import { TypeCast, OpenAIProvider } from "typecast-ai";
import { z } from "zod";

// Use the OpenAI provider (or AnthropicProvider – same interface)
const provider = new OpenAIProvider({ model: "gpt-4o-mini" });
const typecast = new TypeCast(provider);

const schema = z.object({ name: z.string(), age: z.number() });
const data = await typecast.cast(schema, "Return a user: name Alice, age 30.");
// data is { name: string; age: number }
```

### Using Anthropic (Claude)

```ts
import { TypeCast, AnthropicProvider } from "typecast-ai";

const provider = new AnthropicProvider({ model: "claude-3-5-haiku-20241022" });
const typecast = new TypeCast(provider);
// .cast() works the same – providers are interchangeable
```

## Testing

```bash
npm test              # run suite once
npm run test:watch    # watch mode
npm run test:coverage # coverage report (v8)
```

Tests use **Vitest** in strict mode: unit tests for local repair (`tests/repair.test.ts`) and mocked-provider tests for the self-healing loop (`tests/caster.test.ts`). Core and repair logic have high coverage; add integration tests with real API keys before major releases.

## Project structure

- `src/core` – TypeCast class and core logic
- `src/providers` – Provider implementations (OpenAI, Anthropic, Ollama)
- `src/types` – Shared types (e.g. `BaseProvider`)
- `src/utils` – Helpers (e.g. local JSON repair)

## License

MIT
