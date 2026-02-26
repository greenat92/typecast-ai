import { describe, it, expect } from "vitest";
import { z } from "zod";
import { TypeCast } from "../src/core/index.js";
import type { BaseProvider, GenerateResponseOptions } from "../src/types/index.js";

/**
 * Mock provider that returns a predefined sequence of responses.
 * Records every prompt passed to generateResponse for assertions.
 */
class MockProvider implements BaseProvider {
  private callIndex = 0;
  readonly prompts: string[] = [];

  constructor(private readonly responses: string[]) {
    if (responses.length === 0) {
      throw new Error("MockProvider requires at least one response");
    }
  }

  async generateResponse(
    prompt: string,
    _options?: GenerateResponseOptions
  ): Promise<string> {
    this.prompts.push(prompt);
    const response =
      this.responses[this.callIndex] ?? this.responses[this.responses.length - 1];
    this.callIndex += 1;
    return response;
  }
}

describe("TypeCast (self-healing loop)", () => {
  const userSchema = z.object({
    name: z.string(),
    age: z.number().int().min(0),
  });
  type User = z.infer<typeof userSchema>;

  describe("Test Case 1: LLM returns valid JSON immediately", () => {
    it("returns parsed and validated data when response is valid", async () => {
      const provider = new MockProvider(['{"name": "Alice", "age": 30}']);
      const caster = new TypeCast(provider);

      const result = await caster.cast<User>(userSchema, "Return a user.");

      expect(result).toEqual({ name: "Alice", age: 30 });
      expect(provider.prompts).toHaveLength(1);
      expect(provider.prompts[0]).toBe("Return a user.");
    });

    it("succeeds when valid JSON is wrapped in markdown (local repair)", async () => {
      const provider = new MockProvider([
        '```json\n{"name": "Bob", "age": 25}\n```',
      ]);
      const caster = new TypeCast(provider);

      const result = await caster.cast<User>(userSchema, "Return a user.");

      expect(result).toEqual({ name: "Bob", age: 25 });
      expect(provider.prompts).toHaveLength(1);
    });

    it("succeeds when valid JSON has trailing commas (local repair)", async () => {
      const provider = new MockProvider([
        '{"name": "Carol", "age": 28,}',
      ]);
      const caster = new TypeCast(provider);

      const result = await caster.cast<User>(userSchema, "Return a user.");

      expect(result).toEqual({ name: "Carol", age: 28 });
      expect(provider.prompts).toHaveLength(1);
    });
  });

  describe("Test Case 2: LLM returns invalid JSON first, then valid on retry", () => {
    it("retries and succeeds; retry message contains Zod validation error", async () => {
      const provider = new MockProvider([
        '{"name": 123, "age": 30}', // name should be string
        '{"name": "John", "age": 30}',
      ]);
      const caster = new TypeCast(provider);

      const result = await caster.cast<User>(userSchema, "Return a user.", {
        maxRetries: 2,
      });

      expect(result).toEqual({ name: "John", age: 30 });
      expect(provider.prompts).toHaveLength(2);
      expect(provider.prompts[1]).toContain("Zod validation failed");
      expect(provider.prompts[1]).toContain("Your previous response:");
      expect(provider.prompts[1]).toContain('{"name": 123, "age": 30}');
    });

    it("retries on JSON parse error (invalid syntax) then succeeds", async () => {
      const provider = new MockProvider([
        "{ name: 'no quotes' }", // invalid JSON
        '{"name": "Jane", "age": 22}',
      ]);
      const caster = new TypeCast(provider);

      const result = await caster.cast<User>(userSchema, "Return a user.", {
        maxRetries: 2,
      });

      expect(result).toEqual({ name: "Jane", age: 22 });
      expect(provider.prompts).toHaveLength(2);
      expect(provider.prompts[1]).toContain("Invalid JSON");
      expect(provider.prompts[1]).toContain("Your previous response:");
    });
  });

  describe("Test Case 3: LLM keeps returning invalid JSON", () => {
    it("stops after maxRetries and throws a clear error", async () => {
      const provider = new MockProvider([
        "not json at all",
        "still not valid",
        "nope",
      ]);
      const caster = new TypeCast(provider);

      await expect(
        caster.cast<User>(userSchema, "Return a user.", { maxRetries: 2 })
      ).rejects.toThrow(); // SyntaxError from JSON.parse

      expect(provider.prompts).toHaveLength(3);
    });

    it("throws ZodError when JSON parses but validation always fails", async () => {
      const provider = new MockProvider([
        '{"name": 999, "age": 1}', // wrong type for name
        '{"name": "x", "age": -1}', // age invalid
        '{"name": 123, "age": 0}',  // name still number
      ]);
      const caster = new TypeCast(provider);

      await expect(
        caster.cast<User>(userSchema, "Return a user.", { maxRetries: 2 })
      ).rejects.toThrow(z.ZodError);

      expect(provider.prompts).toHaveLength(3);
    });

    it("uses custom maxRetries (0 = one attempt only)", async () => {
      const provider = new MockProvider(["bad", "good"]);
      const caster = new TypeCast(provider);

      await expect(
        caster.cast<User>(userSchema, "Return a user.", { maxRetries: 0 })
      ).rejects.toThrow();

      expect(provider.prompts).toHaveLength(1);
    });
  });

  describe("type-safety contract with Zod", () => {
    it("enforces schema: extra keys are stripped by parse", async () => {
      const strictSchema = z.object({ id: z.number() });
      const provider = new MockProvider(['{"id": 1, "extra": "ignored"}']);
      const caster = new TypeCast(provider);

      const result = await caster.cast<{ id: number }>(
        strictSchema,
        "Return an object with id."
      );

      expect(result).toEqual({ id: 1 });
      expect(strictSchema.parse(result)).toEqual({ id: 1 });
    });

    it("enforces schema: wrong type fails validation", async () => {
      const schema = z.object({ count: z.number() });
      const provider = new MockProvider(['{"count": "not a number"}']);
      const caster = new TypeCast(provider);

      await expect(
        caster.cast(schema, "Return { count: number }.", { maxRetries: 0 })
      ).rejects.toThrow(z.ZodError);
    });
  });

  describe("error-handling branches", () => {
    it("propagates provider errors (e.g. network)", async () => {
      const failingProvider: BaseProvider = {
        async generateResponse() {
          throw new Error("API key invalid");
        },
      };
      const caster = new TypeCast(failingProvider);

      await expect(
        caster.cast(userSchema, "Return a user.")
      ).rejects.toThrow("API key invalid");
    });

    it("retry message includes raw response for context", async () => {
      const provider = new MockProvider([
        '{"name": 123, "age": 30}',
        '{"name": "Fixed", "age": 30}',
      ]);
      const caster = new TypeCast(provider);

      await caster.cast<User>(userSchema, "Prompt.", { maxRetries: 2 });

      expect(provider.prompts[1]).toContain("Your previous response:");
      expect(provider.prompts[1]).toContain('{"name": 123, "age": 30}');
    });
  });
});
