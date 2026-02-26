import { describe, it, expect } from "vitest";
import {
  repairJson,
  stripMarkdownCodeBlocks,
  fixTrailingCommas,
  extractJsonChunk,
} from "../src/utils/repair.js";

describe("stripMarkdownCodeBlocks", () => {
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

  it("strips closing fence with trailing whitespace", () => {
    const raw = "```json\n{\"b\": 2}\n```  \n";
    expect(stripMarkdownCodeBlocks(raw)).toBe("{\"b\": 2}");
  });

  it("leaves content without code fences unchanged", () => {
    const raw = "{\"only\": \"json\"}";
    expect(stripMarkdownCodeBlocks(raw)).toBe("{\"only\": \"json\"}");
  });

  it("handles inline closing fence when not at end of string", () => {
    const raw = "```json\n{\"c\": 3}\n```";
    const result = stripMarkdownCodeBlocks(raw);
    expect(result).toBe("{\"c\": 3}");
  });
});

describe("fixTrailingCommas", () => {
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

  it("handles trailing comma with newline", () => {
    const raw = "{\n  \"x\": 1,\n}";
    expect(fixTrailingCommas(raw)).toBe("{\n  \"x\": 1\n}");
  });

  it("leaves valid JSON unchanged", () => {
    const valid = "{\"a\": 1}";
    expect(fixTrailingCommas(valid)).toBe(valid);
  });
});

describe("extractJsonChunk", () => {
  it("removes leading chatter before a JSON object", () => {
    const raw = "Here is the result:\n{\"name\": \"Alice\", \"age\": 30}";
    expect(extractJsonChunk(raw)).toBe("{\"name\": \"Alice\", \"age\": 30}");
  });

  it("removes trailing chatter after a JSON object", () => {
    const raw = "{\"ok\": true} Let me know if you need more.";
    expect(extractJsonChunk(raw)).toBe("{\"ok\": true}");
  });

  it("removes both leading and trailing chatter", () => {
    const raw = "Sure!\n{\"id\": 42}\nHope that helps.";
    expect(extractJsonChunk(raw)).toBe("{\"id\": 42}");
  });

  it("extracts first array when response starts with array", () => {
    const raw = "Data: [1, 2, 3] end";
    expect(extractJsonChunk(raw)).toBe("[1, 2, 3]");
  });

  it("extracts nested object correctly (respects braces)", () => {
    const raw = "Result: {\"a\": {\"b\": 1}} done";
    expect(extractJsonChunk(raw)).toBe("{\"a\": {\"b\": 1}}");
  });

  it("respects strings containing braces", () => {
    const raw = "{\"msg\": \"Say } hi {\"}\n";
    expect(extractJsonChunk(raw)).toBe("{\"msg\": \"Say } hi {\"}");
  });

  it("returns trimmed string when no { or [ found", () => {
    const raw = "  just text  ";
    expect(extractJsonChunk(raw)).toBe("just text");
  });
});

describe("repairJson", () => {
  it("combines all repairs: markdown + chatter + trailing comma", () => {
    const raw = "Here you go:\n```json\n{\"name\": \"Bob\", }\n```\nThanks!";
    const result = repairJson(raw);
    const parsed = JSON.parse(result) as { name: string };
    expect(parsed).toEqual({ name: "Bob" });
  });

  it("produces parseable JSON from markdown-wrapped trailing-comma response", () => {
    const raw = "```json\n[1, 2, 3,]\n```";
    const result = repairJson(raw);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it("produces parseable JSON from chatter-wrapped valid JSON", () => {
    const raw = "The answer is: {\"valid\": true}.";
    const result = repairJson(raw);
    expect(JSON.parse(result)).toEqual({ valid: true });
  });

  it("leaves already-valid JSON string unchanged in content", () => {
    const raw = "{\"a\": 1, \"b\": 2}";
    expect(repairJson(raw)).toBe(raw);
  });

  it("handles real-world LLM-style response with all issues", () => {
    const raw = [
      "Sure, here's the JSON you asked for:",
      "```json",
      "{",
      '  "title": "Hello",',
      '  "count": 5,',
      "}",
      "```",
      "Let me know if you need changes.",
    ].join("\n");
    const result = repairJson(raw);
    const parsed = JSON.parse(result) as { title: string; count: number };
    expect(parsed.title).toBe("Hello");
    expect(parsed.count).toBe(5);
  });
});
