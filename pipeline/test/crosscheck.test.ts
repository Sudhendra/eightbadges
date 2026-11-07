import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Dex } from "@pkmn/dex";
import { OUTPUT_DIR } from "../config.ts";
import type { Move, Species } from "../extract/pokemon.ts";

/**
 * Checks our decomp extraction against Pokémon Showdown's Gen 3 data, an independently maintained source.
 * Any disagreement means a parser bug, or a real difference that has to be listed below with a reason.
 */
const gen3 = Dex.forGen(3);

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(OUTPUT_DIR, name), "utf8")) as T;
}

const compact = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

test("species stats, types and abilities match Showdown's Gen 3 data", () => {
  const differences: string[] = [];
  for (const mon of load<Species[]>("species.json")) {
    const other = gen3.species.get(mon.id === "nidoran_f" ? "nidoranf" : mon.id === "nidoran_m" ? "nidoranm" : compact(mon.id));
    if (!other.exists) {
      differences.push(`${mon.id}: not found`);
      continue;
    }
    const { hp, atk, def, spa, spd, spe } = other.baseStats;
    if (mon.stats.join() !== [hp, atk, def, spa, spd, spe].join()) {
      differences.push(`${mon.id}: stats ${mon.stats} vs ${[hp, atk, def, spa, spd, spe]}`);
    }
    if (mon.types.join() !== other.types.map(compact).join()) {
      differences.push(`${mon.id}: types ${mon.types} vs ${other.types}`);
    }
    if (other.num !== mon.dex) differences.push(`${mon.id}: dex ${mon.dex} vs ${other.num}`);
    // Showdown keeps later abilities in its Gen 3 table, so compare only abilities that existed by Gen 3.
    const { "0": first, "1": second } = other.abilities;
    const theirs = [first, second]
      .filter((name): name is NonNullable<typeof name> => Boolean(name) && gen3.abilities.get(name!).gen <= 3 && gen3.abilities.get(name!).gen > 0)
      .map(compact)
      .sort()
      .join();
    const ours = mon.abilities.map(compact).sort().join();
    if (ours !== theirs) differences.push(`${mon.id}: abilities ${ours} vs ${theirs}`);
  }
  assert.deepEqual(differences, []);
});

/** Showdown spells this move's id differently. */
const MOVE_ALIASES: Record<string, string> = { smelling_salt: "smellingsalts" };

/**
 * Where the cartridge and Showdown genuinely disagree. We keep the cartridge's stored value, since it is the
 * game's own data. The list is exact, so a new difference fails the test until someone looks at it.
 *
 * These stored values are not yet checked against in-battle behavior. The simulator phase must confirm how each
 * one acts, because the battle code can override a stored value (Spit Up's damage depends on Stockpile, for example).
 */
const KNOWN_MOVE_DIFFERENCES = [
  // The cartridge stores 100. Showdown models them as never missing.
  ...[
    "mimic", "soft_boiled", "spider_web", "nightmare", "conversion_2", "mean_look", "pain_split", "vital_throw",
    "memento", "follow_me", "charge", "helping_hand", "role_play", "wish", "assist", "ingrain", "magic_coat",
    "recycle", "yawn", "skill_swap", "imprison", "refresh", "grudge", "snatch", "camouflage", "tail_glow",
    "mud_sport", "slack_off", "block", "water_sport",
  ].map((move) => `${move}: accuracy 100 vs null`),
  "endure: priority 3 vs 4",
  "spit_up: power 100 vs 0",
];

test("move numbers match Showdown's Gen 3 data, apart from known differences", () => {
  const differences: string[] = [];
  for (const move of load<Move[]>("moves.json")) {
    const other = gen3.moves.get(MOVE_ALIASES[move.id] ?? compact(move.id));
    if (!other.exists) {
      differences.push(`${move.id}: not found`);
      continue;
    }
    if (compact(other.type) !== move.type && move.type !== "mystery") {
      differences.push(`${move.id}: type ${move.type} vs ${other.type}`);
    }
    if (other.pp !== move.pp) differences.push(`${move.id}: pp ${move.pp} vs ${other.pp}`);
    if (other.priority !== move.priority) differences.push(`${move.id}: priority ${move.priority} vs ${other.priority}`);
    const accuracy = other.accuracy === true ? null : other.accuracy;
    if (accuracy !== move.accuracy) differences.push(`${move.id}: accuracy ${move.accuracy} vs ${accuracy}`);
    // The game stores fixed and variable damage moves as power 1. Showdown stores 0 and computes it.
    if (other.basePower !== move.power && !(move.power === 1 && other.basePower === 0)) {
      differences.push(`${move.id}: power ${move.power} vs ${other.basePower}`);
    }
    if (other.category !== "Status" && compact(other.category) !== move.category && move.power !== 0) {
      differences.push(`${move.id}: category ${move.category} vs ${other.category}`);
    }
    if ((other.category === "Status") !== (move.category === "status") && move.power !== 1) {
      differences.push(`${move.id}: status mismatch ${move.category} vs ${other.category}`);
    }
  }
  assert.deepEqual(differences.sort(), [...KNOWN_MOVE_DIFFERENCES].sort());
});
