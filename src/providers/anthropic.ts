import Anthropic from "@anthropic-ai/sdk";
import type { BaseProvider, GenerateResponseOptions } from "../types/index.js";

const FORMAT_OUTPUT_TOOL_NAME = "format_output";

/** Mock tool used to force Claude to return structured JSON via tool use. */
const FORMAT_OUTPUT_TOOL = {
  name: FORMAT_OUTPUT_TOOL_NAME,
  description:
    "Call this tool with your final JSON result. Pass the result in the 'result' field.",
  input_schema: {
    type: "object" as const,
    properties: {
      result: {
        type: "object" as const,
        description: "The JSON result matching the requested schema.",
        additionalProperties: true,
      },
    },
    required: ["result" as const],
  },
};

export interface AnthropicProviderOptions {
  /** Anthropic API key (default: process.env.ANTHROPIC_API_KEY). */
  apiKey?: string;
  /** Model (default: "claude-3-5-haiku-20241022"). */
  model?: string;
  /** Max tokens (default: 4096). */
  maxTokens?: number;
}

/**
 * Anthropic provider using the official SDK.
 * Uses a mock "format_output" tool so Claude returns structured JSON via tool_use.
 */
export class AnthropicProvider implements BaseProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions = {}) {
    this.client = new Anthropic({
      apiKey: options.apiKey ?? process.env["ANTHROPIC_API_KEY"],
    });
    this.model = options.model ?? "claude-3-5-haiku-20241022";
    this.maxTokens = options.maxTokens ?? 4096;
  }

  async generateResponse(
    prompt: string,
    _options?: GenerateResponseOptions
  ): Promise<string> {
    const instruction =
      "\n\nRespond using the format_output tool with your JSON result in the 'result' field. Do not respond with text outside the tool.";
    const userMessage = prompt + instruction;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      tools: [FORMAT_OUTPUT_TOOL],
      messages: [{ role: "user", content: userMessage }],
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === FORMAT_OUTPUT_TOOL_NAME) {
        const result = (block as { input: { result?: unknown } }).input?.result;
        if (result !== undefined) {
          return JSON.stringify(result);
        }
      }
    }

    throw new Error(
      "Anthropic response did not include a format_output tool use with result"
    );
  }
}
