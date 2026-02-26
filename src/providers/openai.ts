import OpenAI from "openai";
import type { BaseProvider, GenerateResponseOptions } from "../types/index.js";

export interface OpenAIProviderOptions {
  /** OpenAI API key (default: process.env.OPENAI_API_KEY). */
  apiKey?: string;
  /** Model (default: "gpt-4o-mini"). */
  model?: string;
}

/**
 * OpenAI provider using the official SDK.
 * Uses response_format: { type: "json_schema" } when jsonSchema is provided for structured output.
 */
export class OpenAIProvider implements BaseProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIProviderOptions = {}) {
    this.client = new OpenAI({
      apiKey: options.apiKey ?? process.env["OPENAI_API_KEY"],
    });
    this.model = options.model ?? "gpt-4o-mini";
  }

  async generateResponse(
    prompt: string,
    options?: GenerateResponseOptions
  ): Promise<string> {
    const responseFormat = options?.jsonSchema
      ? {
          type: "json_schema" as const,
          json_schema: {
            name: "Response",
            strict: true,
            schema: options.jsonSchema as Record<string, unknown>,
          },
        }
      : { type: "json_object" as const };

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: responseFormat,
    });

    const content = completion.choices[0]?.message?.content;
    if (content == null || content === "") {
      throw new Error("OpenAI returned empty content");
    }
    return content.trim();
  }
}
