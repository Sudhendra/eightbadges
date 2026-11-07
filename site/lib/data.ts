import { readFileSync } from "node:fs";
import type { Learnset, Move, Species } from "../../pipeline/extract/pokemon.ts";
import type { Trainer } from "../../pipeline/extract/trainers.ts";
import type { TypeChart } from "../../pipeline/extract/types.ts";

export const STARTERS = ["treecko", "torchic", "mudkip"] as const;
export type Starter = (typeof STARTERS)[number];

export type Stop = {
  id: string;
  kind: "rival" | "gym" | "villain" | "elite" | "champion";
  /** A trainer id. `{starter}` is replaced by the player's starter. */
  trainer: string;
  title: string;
  place: string;
  note: string;
  badge?: string;
  /** The field move this badge lets you use outside battle. */
  unlocks?: string;
};

export type GameData = {
  species: Map<string, Species>;
  moves: Map<string, Move>;
  learnsets: Record<string, Learnset>;
  trainers: Map<string, Trainer>;
  types: TypeChart;
  journey: Stop[];
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
    journey: readJson<Stop[]>("content/emerald/journey.json"),
  };
}

export function trainerFor(data: GameData, stop: Stop, starter: Starter): Trainer {
  const id = stop.trainer.replace("{starter}", starter);
  const trainer = data.trainers.get(id);
  if (!trainer) throw new Error(`Journey stop ${stop.id} uses unknown trainer ${id}`);
  return trainer;
}
