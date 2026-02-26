import { describe, it, expect } from "vitest";
import { z } from "zod";
import { TypeCast } from "@/core/index.js";
import { TypeCastError } from "@/types/index.js";
import { createMockProvider } from "./helpers/mockProvider.js";

const userSchema = z.object({
  name: z.string(),
  age: z.number().int().min(0),
});
type User = z.infer<typeof userSchema>;

describe("Self-Healing – Scenario A (Happy Path)", () => {
  it("provider returns valid JSON on first try; only 1 API call is made", async () => {
    const { provider, getPrompts } = createMockProvider([
      '{"name": "Alice", "age": 30}',
    ]);
    const caster = new TypeCast(provider);

    const result = await caster.cast<User>(userSchema, "Return a user.");

    expect(result).toEqual({ name: "Alice", age: 30 });
    expect(getPrompts()).toHaveLength(1);
    expect(getPrompts()[0]).toBe("Return a user.");
  });
});

describe("Self-Healing – Scenario B (Standard Healing)", () => {
  it("provider returns invalid JSON (wrong types), then valid JSON; 2 API calls; second prompt includes Zod error", async () => {
    const { provider, getPrompts } = createMockProvider([
      '{"name": 123, "age": 30}',
      '{"name": "John", "age": 30}',
    ]);
    const caster = new TypeCast(provider);

    const result = await caster.cast<User>(userSchema, "Return a user.", {
      maxRetries: 2,
    });

    expect(result).toEqual({ name: "John", age: 30 });
    const messages = getPrompts();
    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain("Zod validation failed");
    expect(messages[1]).toContain("Your previous response:");
    expect(messages[1]).toContain('{"name": 123, "age": 30}');

    expect(messages).toMatchSnapshot();
  });
});

describe("Self-Healing – Scenario C (Max Retries)", () => {
  it("provider fails 3 times; library throws TypeCastError after exactly maxRetries", async () => {
    const { provider, getPrompts } = createMockProvider([
      "not json",
      "still not json",
      "nope",
    ]);
    const caster = new TypeCast(provider);

    await expect(
      caster.cast<User>(userSchema, "Return a user.", { maxRetries: 2 })
    ).rejects.toThrow(TypeCastError);

    const messages = getPrompts();
    expect(messages).toHaveLength(3);
  });

  it("TypeCastError has a cause (SyntaxError or ZodError)", async () => {
    const { provider } = createMockProvider(["invalid", "invalid", "invalid"]);
    const caster = new TypeCast(provider);

    try {
      await caster.cast<User>(userSchema, "Return a user.", { maxRetries: 2 });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TypeCastError);
      expect((e as TypeCastError).cause).toBeDefined();
    }
  });

  it("throws TypeCastError after maxRetries when validation (Zod) fails every time", async () => {
    const { provider, getPrompts } = createMockProvider([
      '{"name": 123, "age": 30}',
      '{"name": 456, "age": 30}',
      '{"name": 789, "age": 30}',
    ]);
    const caster = new TypeCast(provider);

    await expect(
      caster.cast<User>(userSchema, "Return a user.", { maxRetries: 2 })
    ).rejects.toThrow(TypeCastError);

    expect(getPrompts()).toHaveLength(3);
  });
});
