/** Optional context passed to generateResponse (e.g. for schema-constrained providers like OpenAI). */
export interface GenerateResponseOptions {
  /** JSON Schema for the expected response shape. Providers may use this for response_format. */
  jsonSchema?: object;
}

/**
 * Base provider interface for LLM backends.
 * Implement this to support OpenAI, Anthropic, Ollama, or any other provider.
 */
export interface BaseProvider {
  /**
   * Sends the prompt to the LLM and returns the raw text response.
   * @param prompt - The full prompt (including system/format instructions)
   * @param options - Optional context (e.g. jsonSchema for structured output)
   * @returns The model's raw text output (e.g. JSON string)
   */
  generateResponse(
    prompt: string,
    options?: GenerateResponseOptions
  ): Promise<string>;
}
