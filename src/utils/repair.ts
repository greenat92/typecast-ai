/**
 * Attempts to fix common LLM JSON output errors locally (saves token cost vs. asking the AI to retry).
 */

/** Match opening markdown code fence (optional language). */
const CODE_FENCE = /^```(?:json|JSON)?\s*\n?/i;

/**
 * Strips Markdown code blocks (e.g. ```json ... ``` or ``` ... ```) and returns the inner content.
 */
export function stripMarkdownCodeBlocks(raw: string): string {
  let s = raw.trim();
  const openMatch = s.match(CODE_FENCE);
  if (openMatch) {
    s = s.slice(openMatch[0].length);
    const closing = s.match(/\n```\s*$/);
    if (closing) {
      s = s.slice(0, s.length - closing[0].length);
    } else {
      const endIdx = s.indexOf("```");
      if (endIdx !== -1) {
        s = s.slice(0, endIdx);
      }
    }
  }
  return s.trim();
}

/**
 * Removes trailing commas before ] or } so the string becomes valid JSON.
 * Does not parse strings; may mis-handle commas inside string values (rare).
 */
export function fixTrailingCommas(raw: string): string {
  return raw
    .replace(/,(\s*)]/g, "$1]")
    .replace(/,(\s*)}/g, "$1}");
}

/**
 * Extracts the top-level JSON value by finding the first { or [ and its matching } or ].
 * Trims "chatter" text before or after the JSON. Respects nesting and double-quoted strings.
 */
export function extractJsonChunk(raw: string): string {
  const trimmed = raw.trim();
  const startObj = trimmed.indexOf("{");
  const startArr = trimmed.indexOf("[");

  let start: number;
  let openChar: string;
  let closeChar: string;
  if (startObj === -1 && startArr === -1) {
    return trimmed;
  }
  if (startArr === -1 || (startObj !== -1 && startObj < startArr)) {
    start = startObj;
    openChar = "{";
    closeChar = "}";
  } else {
    start = startArr;
    openChar = "[";
    closeChar = "]";
  }

  let depth = 0;
  let i = start;
  let inString = false;
  let escape = false;
  let quoteChar = "";

  while (i < trimmed.length) {
    const c = trimmed[i];

    if (escape) {
      escape = false;
      i++;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      i++;
      continue;
    }
    if (inString) {
      if (c === quoteChar) {
        inString = false;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quoteChar = c;
      i++;
      continue;
    }
    if (c === openChar) {
      depth++;
      i++;
      continue;
    }
    if (c === closeChar) {
      depth--;
      if (depth === 0) {
        return trimmed.slice(start, i + 1);
      }
      i++;
      continue;
    }
    i++;
  }

  return trimmed.slice(start);
}

/**
 * Runs all local repairs in sequence: strip markdown, extract JSON chunk, fix trailing commas.
 * Use the result with JSON.parse(); only call the AI for retry if parsing still fails.
 */
export function repairJson(raw: string): string {
  let s = stripMarkdownCodeBlocks(raw);
  s = extractJsonChunk(s);
  s = fixTrailingCommas(s);
  return s.trim();
}
