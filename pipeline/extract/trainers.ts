import { bitFlags, braceGroups, designated, field, gameText, intField, requireField, slug, stripComments } from "../lib/c.ts";
import { initialMoves } from "../../shared/engine.ts";
import type { Learnset, Read } from "./pokemon.ts";

export type TrainerMon = {
  species: string;
  level: number;
  /** Raw game value, 0 to 255. The game scales it to 0 to 31 for every stat. */
  iv: number;
  item?: string;
  moves: string[];
  /** True when the game derives these moves from the level-up learnset instead of listing them. */
  autoMoves?: true;
};

export type Trainer = {
  id: string;
  name: string;
  class: string;
  double: boolean;
  items: string[];
  ai: string[];
  party: TrainerMon[];
};

/** Shared with the site and the browser, so trainer movesets and matchups use one definition. */
export { initialMoves };

function extractParties(source: string, learnsets: Record<string, Learnset>): Map<string, TrainerMon[]> {
  const parties = new Map<string, TrainerMon[]>();
  for (const match of source.matchAll(/(sParty_\w+)\[\]\s*=\s*\{([\s\S]*?)\n\};/g)) {
    const party = braceGroups(match[2]!).map((body): TrainerMon => {
      const species = slug(requireField(body, "species"), "SPECIES_");
      const level = intField(body, "lvl");
      const item = field(body, "heldItem");
      const moves = field(body, "moves");
      const learnset = learnsets[species];
      if (!learnset) throw new Error(`${match[1]} uses unknown species ${species}`);
      const mon: TrainerMon = {
        species,
        level,
        iv: intField(body, "iv"),
        moves: moves
          ? [...moves.matchAll(/MOVE_(\w+)/g)].map((m) => m[1]!.toLowerCase()).filter((move) => move !== "none")
          : initialMoves(level, learnset.level),
      };
      if (item && item !== "ITEM_NONE") mon.item = slug(item, "ITEM_");
      if (!moves) mon.autoMoves = true;
      return mon;
    });
    parties.set(match[1]!, party);
  }
  return parties;
}

export function extractTrainers(read: Read, learnsets: Record<string, Learnset>): Trainer[] {
  const parties = extractParties(stripComments(read("src/data/trainer_parties.h")), learnsets);
  const result: Trainer[] = [];
  for (const [constant, body] of designated(stripComments(read("src/data/trainers.h")), "TRAINER_")) {
    if (constant === "TRAINER_NONE") continue;
    const label = /\((sParty_\w+)\)/.exec(requireField(body, "party"))?.[1];
    const party = label ? parties.get(label) : undefined;
    if (!party) throw new Error(`No party for ${constant}`);
    result.push({
      id: slug(constant, "TRAINER_"),
      name: gameText(requireField(body, "trainerName")),
      class: slug(requireField(body, "trainerClass"), "TRAINER_CLASS_"),
      double: requireField(body, "doubleBattle") === "TRUE",
      items: [...requireField(body, "items").matchAll(/ITEM_(\w+)/g)]
        .map((m) => m[1]!.toLowerCase())
        .filter((item) => item !== "none"),
      ai: bitFlags(field(body, "aiFlags"), "AI_SCRIPT_"),
      party,
    });
  }
  return result;
}
