import { readFileSync } from "node:fs";
import type { EncounterTable } from "../../pipeline/extract/encounters.ts";
import type { Item } from "../../pipeline/extract/items.ts";
import type { Learnset, Move, Species } from "../../pipeline/extract/pokemon.ts";
import type { Trainer } from "../../pipeline/extract/trainers.ts";
import type { TypeChart } from "../../pipeline/extract/types.ts";
import type { Place, World } from "../../pipeline/extract/world.ts";

export const STARTERS = ["treecko", "torchic", "mudkip"] as const;
export type Starter = (typeof STARTERS)[number];

/** Things that unlock more ways to find Pokémon. */
export type Tool = "old_rod" | "good_rod" | "super_rod" | "surf" | "rock_smash" | "dive" | "waterfall";

export type Stop = {
  id: string;
  kind: "rival" | "gym" | "villain" | "elite" | "champion";
  /** A trainer id. `{starter}` is replaced by the player's starter. */
  trainer: string;
  title: string;
  place: string;
  /** Region map section the fight happens in. */
  section: string;
  note: string;
  badge?: string;
  /** The field move this badge lets you use outside battle. */
  unlocks?: string;
  /** What becomes reachable between the previous fight and this one. */
  opens: { areas: string[]; tools?: Tool[]; gifts?: string[]; noCatching?: boolean };
};

export type Fork = {
  id: string;
  /** The stop this choice comes after. */
  after: string;
  title: string;
  place: string;
  section: string;
  note: string;
  options: { label: string; species: string; level: number }[];
};

export type GameData = {
  species: Map<string, Species>;
  moves: Map<string, Move>;
  learnsets: Record<string, Learnset>;
  trainers: Map<string, Trainer>;
  types: TypeChart;
  items: Item[];
  abilities: Record<string, string>;
  encounters: EncounterTable[];
  world: World;
  places: Map<string, Place>;
  journey: Stop[];
  forks: Fork[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadGameData(): GameData {
  return {
    species: new Map(readJson<Species[]>("data/emerald/species.json").map((mon) => [mon.id, mon])),
    moves: new Map(readJson<Move[]>("data/emerald/moves.json").map((move) => [move.id, move])),
    learnsets: readJson<Record<string, Learnset>>("data/emerald/learnsets.json"),
    trainers: new Map(readJson<Trainer[]>("data/emerald/trainers.json").map((trainer) => [trainer.id, trainer])),
    types: readJson<TypeChart>("data/emerald/types.json"),
    items: readJson<Item[]>("data/emerald/items.json"),
    abilities: readJson<Record<string, string>>("data/emerald/abilities.json"),
    encounters: readJson<EncounterTable[]>("data/emerald/encounters.json"),
    world: readJson<World>("data/emerald/world.json"),
    places: new Map(readJson<Place[]>("data/emerald/places.json").map((place) => [place.id, place])),
    journey: readJson<Stop[]>("content/emerald/journey.json"),
    forks: readJson<Fork[]>("content/emerald/forks.json"),
  };
}

export function trainerFor(data: GameData, stop: Stop, starter: Starter): Trainer {
  const id = stop.trainer.replace("{starter}", starter);
  const trainer = data.trainers.get(id);
  if (!trainer) throw new Error(`Journey stop ${stop.id} uses unknown trainer ${id}`);
  return trainer;
}
