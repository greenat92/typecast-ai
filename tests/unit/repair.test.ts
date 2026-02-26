import { describe, it, expect } from "vitest";
import {
  repairJson,
  stripMarkdownCodeBlocks,
  fixTrailingCommas,
  extractJsonChunk,
} from "@/utils/repair.js";

describe("Local Repair – strip markdown JSON blocks", () => {
  it("strips ```json ... ``` and returns inner content", () => {
    const raw = "```json\n{\"a\": 1}\n```";
    expect(stripMarkdownCodeBlocks(raw)).toBe("{\"a\": 1}");
  });

  it("strips ```JSON ... ``` (case insensitive)", () => {
    const raw = "```JSON\n{\"x\": true}\n```";
    expect(stripMarkdownCodeBlocks(raw)).toBe("{\"x\": true}");
  });

  it("strips ``` with no language tag", () => {
    const raw = "```\n[1, 2, 3]\n```";
    expect(stripMarkdownCodeBlocks(raw)).toBe("[1, 2, 3]");
  });

  it("leaves content without code fences unchanged", () => {
    const raw = "{\"only\": \"json\"}";
    expect(stripMarkdownCodeBlocks(raw)).toBe("{\"only\": \"json\"}");
  });

  it("repairJson produces parseable JSON from markdown-wrapped response", () => {
    const raw = "```json\n{\"name\": \"Bob\"}\n```";
    const result = repairJson(raw);
    expect(JSON.parse(result) as Record<string, string>).toEqual({ name: "Bob" });
  });
});

describe("Local Repair – remove preamble text", () => {
  it("extracts JSON after 'Here is your JSON:'-style preamble", () => {
    const raw = "Here is your JSON: {\"name\": \"Alice\", \"age\": 30}";
    expect(extractJsonChunk(raw)).toBe("{\"name\": \"Alice\", \"age\": 30}");
  });

  it("removes trailing chatter after the JSON object", () => {
    const raw = "{\"ok\": true} Let me know if you need more.";
    expect(extractJsonChunk(raw)).toBe("{\"ok\": true}");
  });

  it("removes both leading and trailing chatter", () => {
    const raw = "Sure!\n{\"id\": 42}\nHope that helps.";
    expect(extractJsonChunk(raw)).toBe("{\"id\": 42}");
  });

  it("repairJson produces parseable JSON from preamble-wrapped response", () => {
    const raw = "The answer is: {\"valid\": true}.";
    const result = repairJson(raw);
    expect(JSON.parse(result) as Record<string, boolean>).toEqual({ valid: true });
  });
});

describe("Local Repair – fix trailing commas in objects and arrays", () => {
  it("removes trailing comma before ] in array", () => {
    const raw = "[1, 2, 3,]";
    expect(fixTrailingCommas(raw)).toBe("[1, 2, 3]");
  });

  it("removes trailing comma before } in object", () => {
    const raw = "{\"a\": 1, \"b\": 2,}";
    expect(fixTrailingCommas(raw)).toBe("{\"a\": 1, \"b\": 2}");
  });

  it("fixes both array and object in one string", () => {
    const raw = "{\"items\": [1, 2,], \"meta\": {},}";
    expect(fixTrailingCommas(raw)).toBe("{\"items\": [1, 2], \"meta\": {}}");
  });

  it("repairJson produces parseable JSON from trailing-comma response", () => {
    const raw = "{\"name\": \"Carol\", \"age\": 28,}";
    const result = repairJson(raw);
    expect(JSON.parse(result) as Record<string, string | number>).toEqual({
      name: "Carol",
      age: 28,
    });
  });
});

describe("Local Repair – completely un-repairable input", () => {
  it("returns a string that still throws when passed to JSON.parse", () => {
    const raw = "This is not JSON at all, just plain text.";
    const repaired = repairJson(raw);
    expect(() => JSON.parse(repaired)).toThrow(SyntaxError);
  });

  it("returns truncated/invalid JSON that cannot be parsed", () => {
    const raw = "{\"incomplete\": ";
    const repaired = repairJson(raw);
    expect(() => JSON.parse(repaired)).toThrow(SyntaxError);
  });

  it("leaves malformed structure (e.g. unquoted keys) unparseable", () => {
    const raw = "{ name: 'value' }";
    const repaired = repairJson(raw);
    expect(() => JSON.parse(repaired)).toThrow(SyntaxError);
  });
});

describe("Local Repair – extractJsonChunk edge cases", () => {
  it("extracts top-level array when input starts with [", () => {
    const raw = "Data: [1, 2, 3] end";
    expect(extractJsonChunk(raw)).toBe("[1, 2, 3]");
  });

  it("respects single-quoted strings when tracking depth", () => {
    const raw = "{\"msg\": \"Say 'hello' back\"}";
    expect(extractJsonChunk(raw)).toBe("{\"msg\": \"Say 'hello' back\"}");
  });

  it("returns remainder when closing brace never found (incomplete JSON)", () => {
    const raw = "{\"a\": 1";
    expect(extractJsonChunk(raw)).toBe("{\"a\": 1");
  });

  it("respects escaped quotes inside double-quoted string", () => {
    const raw = "{\"msg\": \"Say \\\"hi\\\"\"}";
    expect(extractJsonChunk(raw)).toBe("{\"msg\": \"Say \\\"hi\\\"\"}");
  });

  it("extracts deeply nested object (depth > 1 before return)", () => {
    const raw = "Prefix {\"a\": {\"b\": 1}} suffix";
    expect(extractJsonChunk(raw)).toBe("{\"a\": {\"b\": 1}}");
  });
});

describe("Local Repair – stripMarkdownCodeBlocks edge cases", () => {
  it("strips when closing fence has no newline (inline ```)", () => {
    const raw = "```json\n{\"x\": 1}\n```";
    expect(stripMarkdownCodeBlocks(raw)).toBe("{\"x\": 1}");
  });

  it("uses indexOf when closing ``` is not at end of string", () => {
    const raw = "```json\n{\"y\": 2}```";
    const result = stripMarkdownCodeBlocks(raw);
    expect(result).toBe("{\"y\": 2}");
  });
});
