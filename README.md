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
import { TypeCast } from "typecast-ai";
import type { BaseProvider } from "typecast-ai";
import { z } from "zod";

// 1. Implement or use a provider
const myProvider: BaseProvider = {
  async generateResponse(prompt: string) {
    // Call your LLM (OpenAI, Anthropic, Ollama, etc.)
    return '{"name": "World"}';
  },
};

// 2. Create TypeCast and cast with a schema
const typecast = new TypeCast(myProvider);
const schema = z.object({ name: z.string() });
const data = await typecast.cast(schema, "Return JSON with a name field.");
// data is { name: string }
```

## Project structure

- `src/core` – TypeCast class and core logic
- `src/providers` – Provider implementations (OpenAI, Anthropic, Ollama)
- `src/types` – Shared types (e.g. `BaseProvider`)
- `src/utils` – Helpers (e.g. local JSON repair)

## License

MIT
