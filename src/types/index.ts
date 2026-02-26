/**
 * Base provider interface for LLM backends.
 * Implement this to support OpenAI, Anthropic, Ollama, or any other provider.
 */
export interface BaseProvider {
  /**
   * Sends the prompt to the LLM and returns the raw text response.
   * @param prompt - The full prompt (including system/format instructions)
   * @returns The model's raw text output
   */
  generateResponse(prompt: string): Promise<string>;
}
