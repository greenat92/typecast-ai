import { type ZodSchema, ZodError } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { BaseProvider } from "../types/index.js";

/** Options for .cast() */
export interface CastOptions {
  /** Max number of retries after the first failed parse (default: 2). Total attempts = 1 + maxRetries. */
  maxRetries?: number;
}

function formatParseError(error: unknown): string {
  if (error instanceof ZodError) {
    return `Zod validation failed:\n${JSON.stringify(error.issues, null, 2)}`;
  }
  if (error instanceof SyntaxError) {
    return `Invalid JSON: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * TypeCast AI – contract-first structured output from any LLM.
 * Pass a provider (OpenAI, Anthropic, Ollama, etc.) and use .cast() to get typed, validated data.
 * Uses a self-healing loop: on parse/validation failure, the LLM is asked to fix the JSON with error context.
 */
export class TypeCast {
  constructor(private readonly provider: BaseProvider) {}

  /**
   * Sends the prompt to the provider and parses the response into the given Zod schema.
   * On parse or validation failure, asks the LLM to fix the JSON (with error details and message history).
   * @param schema - Zod schema defining the expected output shape
   * @param prompt - The user/system prompt to send to the LLM
   * @param options - Optional settings (e.g. maxRetries, default 2)
   * @returns Parsed and validated data of type T
   */
  async cast<T>(
    schema: ZodSchema<T>,
    prompt: string,
    options: CastOptions = {}
  ): Promise<T> {
    const { maxRetries = 2 } = options;
    let conversation = prompt;

    const jsonSchema = zodToJsonSchema(schema);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const raw = await this.provider.generateResponse(conversation, {
        jsonSchema,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        if (attempt < maxRetries) {
          conversation = `${conversation}\n\n---\nYour previous response:\n${raw}\n\n---\nError: ${formatParseError(e)}\n\nFix the JSON according to the schema and return only the corrected JSON.`;
          continue;
        }
        throw e;
      }

      try {
        return schema.parse(parsed) as T;
      } catch (e) {
        if (attempt < maxRetries) {
          conversation = `${conversation}\n\n---\nYour previous response:\n${raw}\n\n---\nError: ${formatParseError(e)}\n\nFix the JSON according to the schema and return only the corrected JSON.`;
          continue;
        }
        throw e;
      }
    }

    throw new Error("Unreachable");
  }
}
