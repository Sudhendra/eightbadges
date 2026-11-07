import { stripComments } from "../lib/c.ts";
import type { Read } from "./pokemon.ts";

/** attacking type -> defending type -> multiplier. Pairs not listed deal normal damage. */
export type TypeChart = Record<string, Record<string, number>>;

const MULTIPLIERS: Record<string, number> = {
  TYPE_MUL_NO_EFFECT: 0,
  TYPE_MUL_NOT_EFFECTIVE: 0.5,
  TYPE_MUL_SUPER_EFFECTIVE: 2,
};

export function extractTypeChart(read: Read): TypeChart {
  const source = stripComments(read("src/battle_main.c"));
  const table = /gTypeEffectiveness\[\d+\]\s*=\s*\{([\s\S]*?)\};/.exec(source)?.[1];
  if (!table) throw new Error("gTypeEffectiveness not found");
  const chart: TypeChart = {};
  for (const match of table.matchAll(/TYPE_(\w+),\s*TYPE_(\w+),\s*(TYPE_MUL_\w+)/g)) {
    // Marker rows, not types. Normal and Fighting vs Ghost come after the Foresight marker but still count.
    if (match[1] === "FORESIGHT" || match[1] === "ENDTABLE") continue;
    const multiplier = MULTIPLIERS[match[3]!];
    if (multiplier === undefined) throw new Error(`Unknown multiplier ${match[3]}`);
    const attacking = match[1]!.toLowerCase();
    (chart[attacking] ??= {})[match[2]!.toLowerCase()] = multiplier;
  }
  return chart;
}
