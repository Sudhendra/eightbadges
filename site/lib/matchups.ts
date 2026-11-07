import type { Species } from "../../pipeline/extract/pokemon.ts";
import { initialMoves, type Trainer } from "../../pipeline/extract/trainers.ts";
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

export type Matchup = {
  /** Your Pokémon's form at this level. */
  stage: string;
  level: number;
  moves: string[];
  mons: MonMatchup[];
  /** Positive when you out-type them. Each step of 1 is one doubling of damage across the whole team. */
  score: number;
  verdict: Verdict;
};

export type StopMatchup = Matchup & { stop: Stop; trainerDouble: boolean };

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

/** Follows level-up evolutions as far as this level allows. Stone and trade evolutions are left alone. */
export function stageAtLevel(data: GameData, species: string, level: number): Species {
  let current = data.species.get(species);
  if (!current) throw new Error(`Unknown species ${species}`);
  for (;;) {
    const next: Species["evolutions"][number] | undefined = current.evolutions.find(
      (evolution) => evolution.method === "level" && typeof evolution.param === "number" && evolution.param <= level,
    );
    if (!next) return current;
    current = data.species.get(next.to)!;
  }
}

const log2 = (multiplier: number): number => Math.log2(Math.max(multiplier, 0.25));

export function verdictFor(score: number): Verdict {
  if (score >= 0.75) return "easy";
  if (score >= -0.25) return "fair";
  return "tough";
}

/** How a Pokémon caught as `species` and raised to `level` fares against a trainer's team. */
export function matchupAgainst(data: GameData, species: string, level: number, trainer: Trainer): Matchup {
  const stage = stageAtLevel(data, species, level);
  const moves = initialMoves(level, data.learnsets[stage.id]!.level);
  const mons = trainer.party.map((mon): MonMatchup => {
    const opponent = data.species.get(mon.species)!;
    return {
      species: mon.species,
      level: mon.level,
      you: bestHit(data, moves, stage, opponent),
      it: bestHit(data, mon.moves, opponent, stage),
    };
  });
  const total = mons.reduce((sum, mon) => sum + log2(mon.you?.multiplier ?? 0.25) - log2(mon.it?.multiplier ?? 0.5), 0);
  const score = total / mons.length;
  return { stage: stage.id, level, moves, mons, score, verdict: verdictFor(score) };
}

/** The level we assume you're at for a fight: the level of its strongest opponent. */
export function stopLevel(trainer: Trainer): number {
  return Math.max(...trainer.party.map((mon) => mon.level));
}

export function evaluateStop(data: GameData, stop: Stop, starter: Starter): StopMatchup {
  const trainer = trainerFor(data, stop, starter);
  return { ...matchupAgainst(data, starter, stopLevel(trainer), trainer), stop, trainerDouble: trainer.double };
}

export function evaluateRoad(data: GameData, starter: Starter): StopMatchup[] {
  return data.journey.map((stop) => evaluateStop(data, stop, starter));
}
