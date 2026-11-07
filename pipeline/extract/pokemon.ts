import { bitFlags, designated, field, gameText, intField, requireField, slug, stripComments } from "../lib/c.ts";

export type Read = (path: string) => string;

export type Evolution = { method: string; param: number | string; to: string };

export type Species = {
  id: string;
  name: string;
  dex: number;
  hoenn: number | null;
  types: string[];
  /** hp, atk, def, spa, spd, spe */
  stats: [number, number, number, number, number, number];
  ev: [number, number, number, number, number, number];
  abilities: string[];
  catchRate: number;
  expYield: number;
  growth: string;
  /** Percent female. null when genderless. */
  female: number | null;
  eggGroups: string[];
  wildItems: string[];
  evolutions: Evolution[];
};

export type Move = {
  id: string;
  name: string;
  type: string;
  category: "physical" | "special" | "status";
  power: number;
  /** null means the move never misses. */
  accuracy: number | null;
  pp: number;
  priority: number;
  target: string;
  effect: string;
  chance: number;
  flags: string[];
};

export type Learnset = {
  level: [number, string][];
  tm: string[];
  tutor: string[];
  egg: string[];
};

/** Gen 3 decides physical or special by type alone. */
const PHYSICAL_TYPES = new Set(["normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel"]);

/** Dex constants in declaration order. Index in the list equals the dex number. */
function dexOrder(source: string, prefix: string): string[] {
  return [...source.matchAll(new RegExp(`^\\s+(${prefix}\\w+),`, "gm"))].map((m) => slug(m[1]!, prefix));
}

function femalePercent(value: string): number | null {
  if (value === "MON_GENDERLESS") return null;
  if (value === "MON_MALE") return 0;
  if (value === "MON_FEMALE") return 100;
  const match = /PERCENT_FEMALE\(([\d.]+)\)/.exec(value);
  if (!match) throw new Error(`Unknown gender ratio: ${value}`);
  return Number(match[1]);
}

function constantList(value: string, prefix: string): string[] {
  const inner = value.replace(/[{}]/g, "");
  const items = inner.split(",").map((part) => part.trim()).filter(Boolean);
  return [...new Set(items.filter((item) => !item.endsWith("_NONE")).map((item) => slug(item, prefix)))];
}

export function extractEvolutions(source: string): Map<string, Evolution[]> {
  const result = new Map<string, Evolution[]>();
  for (const [key, body] of designated(source, "SPECIES_")) {
    const evolutions: Evolution[] = [];
    for (const match of body.matchAll(/\{\s*EVO_(\w+)\s*,\s*(\w+)\s*,\s*SPECIES_(\w+)\s*\}/g)) {
      const raw = match[2]!;
      evolutions.push({
        method: match[1]!.toLowerCase(),
        param: raw.startsWith("ITEM_") ? slug(raw, "ITEM_") : Number(raw),
        to: match[3]!.toLowerCase(),
      });
    }
    if (evolutions.length > 0) result.set(slug(key, "SPECIES_"), evolutions);
  }
  return result;
}

export function extractSpecies(read: Read): Species[] {
  const dexSource = read("include/constants/pokedex.h");
  // Deoxys is the last real entry. Placeholder Unown slots follow it in the enum.
  const nationalOrder = dexOrder(dexSource, "NATIONAL_DEX_");
  const national = nationalOrder.slice(0, nationalOrder.indexOf("deoxys") + 1);
  const hoennOrder = dexOrder(dexSource, "HOENN_DEX_");
  const hoennEnd = hoennOrder.indexOf("deoxys");
  const names = designated(stripComments(read("src/data/text/species_names.h")), "SPECIES_");
  const info = designated(stripComments(read("src/data/pokemon/species_info.h")), "SPECIES_");
  const evolutions = extractEvolutions(stripComments(read("src/data/pokemon/evolution.h")));

  return national.filter((id) => id !== "none").map((id) => {
    const constant = `SPECIES_${id.toUpperCase()}`;
    const body = info.get(constant);
    const name = names.get(constant);
    if (!body || !name) throw new Error(`No species data for ${constant}`);
    const hoennIndex = hoennOrder.indexOf(id);
    return {
      id,
      name: gameText(name),
      dex: national.indexOf(id),
      hoenn: hoennIndex > 0 && hoennIndex <= hoennEnd ? hoennIndex : null,
      types: constantList(requireField(body, "types"), "TYPE_"),
      stats: [
        intField(body, "baseHP"),
        intField(body, "baseAttack"),
        intField(body, "baseDefense"),
        intField(body, "baseSpAttack"),
        intField(body, "baseSpDefense"),
        intField(body, "baseSpeed"),
      ],
      ev: [
        intField(body, "evYield_HP"),
        intField(body, "evYield_Attack"),
        intField(body, "evYield_Defense"),
        intField(body, "evYield_SpAttack"),
        intField(body, "evYield_SpDefense"),
        intField(body, "evYield_Speed"),
      ],
      abilities: constantList(requireField(body, "abilities"), "ABILITY_"),
      catchRate: intField(body, "catchRate"),
      expYield: intField(body, "expYield"),
      growth: slug(requireField(body, "growthRate"), "GROWTH_"),
      female: femalePercent(requireField(body, "genderRatio")),
      eggGroups: constantList(requireField(body, "eggGroups"), "EGG_GROUP_"),
      wildItems: [requireField(body, "itemCommon"), requireField(body, "itemRare")]
        .filter((item) => item !== "ITEM_NONE")
        .map((item) => slug(item, "ITEM_")),
      evolutions: evolutions.get(id) ?? [],
    };
  });
}

export function extractMoves(read: Read): Move[] {
  const names = designated(stripComments(read("src/data/text/move_names.h")), "MOVE_");
  const moves = designated(stripComments(read("src/data/battle_moves.h")), "MOVE_");
  const result: Move[] = [];
  for (const [constant, body] of moves) {
    if (constant === "MOVE_NONE") continue;
    const name = names.get(constant);
    if (!name) throw new Error(`No name for ${constant}`);
    const type = slug(requireField(body, "type"), "TYPE_");
    const power = intField(body, "power");
    const accuracy = intField(body, "accuracy");
    result.push({
      id: slug(constant, "MOVE_"),
      name: gameText(name),
      type,
      category: power === 0 ? "status" : PHYSICAL_TYPES.has(type) ? "physical" : "special",
      power,
      accuracy: accuracy === 0 ? null : accuracy,
      pp: intField(body, "pp"),
      priority: intField(body, "priority"),
      target: slug(requireField(body, "target"), "MOVE_TARGET_"),
      effect: slug(requireField(body, "effect"), "EFFECT_"),
      chance: intField(body, "secondaryEffectChance"),
      flags: bitFlags(field(body, "flags"), "FLAG_"),
    });
  }
  return result;
}

/** Names only. The ability descriptions are the game's own text, so they stay out. */
export function extractAbilities(read: Read): Record<string, string> {
  const source = stripComments(read("src/data/text/abilities.h"));
  const result: Record<string, string> = {};
  // The same keys also index the description table, so this matches name strings only.
  for (const match of source.matchAll(/\[ABILITY_(\w+)\]\s*=\s*_\("([^"]*)"\)/g)) {
    if (match[1] !== "NONE") result[match[1]!.toLowerCase()] = match[2]!;
  }
  return result;
}

export function extractLearnsets(read: Read, speciesIds: string[], tmMoves: Set<string>): Record<string, Learnset> {
  const levelSource = stripComments(read("src/data/pokemon/level_up_learnsets.h"));
  const levelByLabel = new Map<string, [number, string][]>();
  for (const match of levelSource.matchAll(/(\w+)\[\]\s*=\s*\{([\s\S]*?)\};/g)) {
    const moves: [number, string][] = [];
    for (const move of match[2]!.matchAll(/LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*MOVE_(\w+)\s*\)/g)) {
      moves.push([Number(move[1]), move[2]!.toLowerCase()]);
    }
    levelByLabel.set(match[1]!, moves);
  }
  const pointers = designated(stripComments(read("src/data/pokemon/level_up_learnset_pointers.h")), "SPECIES_");
  const tmhm = designated(stripComments(read("src/data/pokemon/tmhm_learnsets.h")), "SPECIES_");
  const tutor = designated(stripComments(read("src/data/pokemon/tutor_learnsets.h")), "SPECIES_");

  const egg = new Map<string, string[]>();
  const eggSource = stripComments(read("src/data/pokemon/egg_moves.h"));
  for (const match of eggSource.matchAll(/egg_moves\((\w+),([^)]*)\)/g)) {
    if (match[1] === "species") continue;
    egg.set(match[1]!.toLowerCase(), [...match[2]!.matchAll(/MOVE_(\w+)/g)].map((m) => m[1]!.toLowerCase()));
  }

  const result: Record<string, Learnset> = {};
  for (const id of speciesIds) {
    const constant = `SPECIES_${id.toUpperCase()}`;
    const label = pointers.get(constant);
    const level = label ? levelByLabel.get(label) : undefined;
    if (!level) throw new Error(`No level-up learnset for ${constant}`);
    const tm = [...(tmhm.get(constant) ?? "").matchAll(/\.(\w+)\s*=\s*TRUE/g)].map((m) => m[1]!.toLowerCase());
    for (const move of tm) {
      if (!tmMoves.has(move)) throw new Error(`${id} learns unknown TM/HM move ${move}`);
    }
    result[id] = {
      level,
      tm,
      tutor: [...(tutor.get(constant) ?? "").matchAll(/TUTOR\(MOVE_(\w+)\)/g)].map((m) => m[1]!.toLowerCase()),
      egg: egg.get(id) ?? [],
    };
  }
  return result;
}
