import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { DECOMP_COMMIT, DECOMP_DIR, OUTPUT_DIR } from "./config.ts";
import { buildEmerald } from "./emerald.ts";

const actual = execFileSync("git", ["-C", DECOMP_DIR, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (actual !== DECOMP_COMMIT) {
  throw new Error(`Decomp is at ${actual}, expected ${DECOMP_COMMIT}. Run: pnpm data:fetch`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const files: Record<string, { bytes: number; gzip: number; sha256: string }> = {};
const counts: Record<string, number> = {};
const outputs = buildEmerald(DECOMP_DIR);

for (const [name, value] of Object.entries(outputs)) {
  const text = JSON.stringify(value);
  writeFileSync(join(OUTPUT_DIR, name), text);
  files[name] = {
    bytes: Buffer.byteLength(text),
    gzip: gzipSync(text, { level: 9 }).length,
    sha256: createHash("sha256").update(text).digest("hex"),
  };
  counts[name] = Array.isArray(value) ? value.length : Object.keys(value as object).length;
}

const manifest = { game: "emerald", decompCommit: DECOMP_COMMIT, counts, files };
writeFileSync(join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

for (const [name, file] of Object.entries(files)) {
  console.log(`${name.padEnd(16)} ${String(counts[name]).padStart(5)} entries  ${String(file.bytes).padStart(8)} B  ${String(file.gzip).padStart(7)} B gzip`);
}
