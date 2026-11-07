/** Small helpers for reading the C data tables in the decomp. Not a C parser: just enough for these files. */

export function stripComments(source: string): string {
  return source.replace(/"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) =>
    match.startsWith('"') ? match : "",
  );
}

/** Reads one initializer value starting at `start`, stopping at a top-level comma or closing bracket. */
function scanValue(source: string, start: number): string {
  let depth = 0;
  let inString = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "(" || char === "{" || char === "[") {
      depth++;
    } else if (char === ")" || char === "}" || char === "]") {
      if (depth === 0) return source.slice(start, i).trim();
      depth--;
    } else if ((char === "," || char === ";") && depth === 0) {
      return source.slice(start, i).trim();
    }
  }
  return source.slice(start).trim();
}

/** Reads every `[PREFIX_KEY] = value` entry, in file order. */
export function designated(source: string, prefix: string): Map<string, string> {
  const entries = new Map<string, string>();
  const pattern = new RegExp(`\\[(${prefix}\\w*)\\]\\s*=\\s*`, "g");
  for (const match of source.matchAll(pattern)) {
    entries.set(match[1]!, scanValue(source, match.index + match[0].length));
  }
  return entries;
}

/** Reads a `.name = value` field from an initializer body. */
export function field(body: string, name: string): string | undefined {
  const match = new RegExp(`\\.${name}\\s*=\\s*`).exec(body);
  return match ? scanValue(body, match.index + match[0].length) : undefined;
}

export function requireField(body: string, name: string): string {
  const value = field(body, name);
  if (value === undefined) throw new Error(`Missing .${name} in: ${body.slice(0, 120)}`);
  return value;
}

export function intField(body: string, name: string): number {
  const value = Number(requireField(body, name));
  if (!Number.isInteger(value)) throw new Error(`.${name} is not an integer in: ${body.slice(0, 120)}`);
  return value;
}

/** Text inside `_("...")`. */
export function gameText(value: string): string {
  const match = /_\("((?:[^"\\]|\\.)*)"\)/.exec(value);
  if (!match) throw new Error(`Not a game string: ${value}`);
  return match[1]!;
}

/** Turns `SPECIES_MR_MIME` into `mr_mime`. */
export function slug(constant: string, prefix: string): string {
  if (!constant.startsWith(prefix)) throw new Error(`${constant} does not start with ${prefix}`);
  return constant.slice(prefix.length).toLowerCase();
}

/** Splits `A | B | C` into slugs. A literal 0 means none. */
export function bitFlags(value: string | undefined, prefix: string): string[] {
  if (!value || value === "0") return [];
  return value.split("|").map((part) => slug(part.trim(), prefix));
}

/** Top-level `{...}` groups inside a body. */
export function braceGroups(body: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "{") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (body[i] === "}") {
      depth--;
      if (depth === 0) groups.push(body.slice(start, i));
    }
  }
  return groups;
}
