import type { BaseProvider, GenerateResponseOptions } from "@/types/index.js";

/** Result of createMockProvider: the provider plus recorded prompts for assertions. */
export interface MockProviderResult {
  /** Implements BaseProvider; returns responses sequentially. */
  provider: BaseProvider;
  /** All prompts passed to generateResponse, in order. */
  getPrompts(): string[];
}

/**
 * Creates a strictly-typed mock provider that returns the given response strings
 * in sequence (simulates a model failing then succeeding).
 * Use getPrompts() to assert on the correction prompt history.
 */
export function createMockProvider(responses: readonly string[]): MockProviderResult {
  if (responses.length === 0) {
    throw new Error("createMockProvider requires at least one response");
  }
  const prompts: string[] = [];

  const provider: BaseProvider = {
    async generateResponse(
      prompt: string,
      _options?: GenerateResponseOptions
    ): Promise<string> {
      prompts.push(prompt);
      const index = prompts.length - 1;
      const response =
        index < responses.length ? responses[index] : responses[responses.length - 1];
      return response;
    },
  };

  return {
    provider,
    getPrompts(): string[] {
      return [...prompts];
    },
  };
}
