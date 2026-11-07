import type { Species } from "../../pipeline/extract/pokemon.ts";
import { initialMoves } from "../../pipeline/extract/trainers.ts";
import { type GameData, type Starter, type Stop, trainerFor } from "./data.ts";

export type Verdict = "easy" | "fair" | "tough";
export type Hit = { move: string; multiplier: number };

export type MonMatchup = {
  species: string;
  level: number;
  /** Your best move against it. */
  you: Hit | null;
  /** Its best move against you. */
  it: Hit | null;
};

export type StopMatchup = {
  stop: Stop;
  trainerDouble: boolean;
  /** Your starter's form at this point, assuming you match the toughest opponent's level. */
  stage: string;
  level: number;
  moves: string[];
  verdict: Verdict;
  mons: MonMatchup[];
};

/** Abilities that cancel a type outright. Only applied when a species can't have any other ability. */
const IMMUNITIES: Record<string, string> = {
  levitate: "ground",
  flash_fire: "fire",
  volt_absorb: "electric",
  water_absorb: "water",
};

export function typeMultiplier(data: GameData, moveType: string, defender: Species): number {
  const [only, ...others] = defender.abilities;
  if (only && others.length === 0 && IMMUNITIES[only] === moveType) return 0;
  return defender.types.reduce((total, type) => total * (data.types[moveType]?.[type] ?? 1), 1);
}

/** The move likely to hurt most: power, then same-type bonus, then type matchup. Status moves don't count. */
function bestHit(data: GameData, moves: string[], attacker: Species, defender: Species): Hit | null {
  let best: { hit: Hit; score: number } | null = null;
  for (const id of moves) {
    const move = data.moves.get(id);
    if (!move || move.category === "status") continue;
    const multiplier = typeMultiplier(data, move.type, defender);
    const same = attacker.types.includes(move.type) ? 1.5 : 1;
    const score = multiplier * same * Math.max(move.power, 10);
    if (!best || score > best.score) best = { hit: { move: id, multiplier }, score };
  }
  return best?.hit ?? null;
}

/** Follows level-up evolutions as far as this level allows. */
export function stageAtLevel(data: GameData, starter: Starter, level: number): Species {
  let current = data.species.get(starter)!;
  for (;;) {
    const next = current.evolutions.find(
      (evolution) => evolution.method === "level" && typeof evolution.param === "number" && evolution.param <= level,
    );
    if (!next) return current;
    current = data.species.get(next.to)!;
  }
}

const log2 = (multiplier: number): number => Math.log2(Math.max(multiplier, 0.25));

/** Positive when you out-type them. Each step of 1 is one doubling of damage across the whole team. */
function verdictFor(mons: MonMatchup[]): Verdict {
  const total = mons.reduce((sum, mon) => sum + log2(mon.you?.multiplier ?? 0.25) - log2(mon.it?.multiplier ?? 0.5), 0);
  const score = total / mons.length;
  if (score >= 0.75) return "easy";
  if (score >= -0.25) return "fair";
  return "tough";
}

export function evaluateStop(data: GameData, stop: Stop, starter: Starter): StopMatchup {
  const trainer = trainerFor(data, stop, starter);
  const level = Math.max(...trainer.party.map((mon) => mon.level));
  const stage = stageAtLevel(data, starter, level);
  const moves = initialMoves(level, data.learnsets[stage.id]!.level);

  const mons = trainer.party.map((mon): MonMatchup => {
    const species = data.species.get(mon.species)!;
    return {
      species: mon.species,
      level: mon.level,
      you: bestHit(data, moves, stage, species),
      it: bestHit(data, mon.moves, species, stage),
    };
  });

  return { stop, trainerDouble: trainer.double, stage: stage.id, level, moves, verdict: verdictFor(mons), mons };
}

export function evaluateRoad(data: GameData, starter: Starter): StopMatchup[] {
  return data.journey.map((stop) => evaluateStop(data, stop, starter));
}
