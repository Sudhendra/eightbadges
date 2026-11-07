import type { Trainer } from "../../pipeline/extract/trainers.ts";
import {
  type Lookup,
  matchup,
  type Matchup,
  stageAtLevel as engineStage,
  type TeamMatchup,
  type TeamMember,
  teamMatchup,
  typeMultiplier as engineMultiplier,
} from "../../shared/engine.ts";
import { type GameData, type Starter, type Stop, trainerFor } from "./data.ts";

export type { Hit, Matchup, MonMatchup, Verdict } from "../../shared/engine.ts";
export { verdictFor } from "../../shared/engine.ts";
import type { Species } from "../../pipeline/extract/pokemon.ts";

export type StopMatchup = Matchup & { stop: Stop; trainerDouble: boolean };

const lookups = new WeakMap<GameData, Lookup>();

/** The engine's view of the game data. */
export function lookupFor(data: GameData): Lookup {
  let lookup = lookups.get(data);
  if (!lookup) {
    lookup = {
      species: (id) => {
        const mon = data.species.get(id);
        if (!mon) throw new Error(`Unknown species ${id}`);
        return mon;
      },
      move: (id) => data.moves.get(id),
      levelMoves: (id) => data.learnsets[id]!.level,
      chart: data.types,
    };
    lookups.set(data, lookup);
  }
  return lookup;
}

export function typeMultiplier(data: GameData, moveType: string, defender: Species): number {
  return engineMultiplier(lookupFor(data), moveType, defender);
}

export function stageAtLevel(data: GameData, species: string, level: number): Species {
  return data.species.get(engineStage(lookupFor(data), species, level).id)!;
}

/** How a Pokémon caught as `species` and raised to `level` fares against a trainer's team. */
export function matchupAgainst(data: GameData, species: string, level: number, trainer: Trainer, extraMoves: string[] = []): Matchup {
  return matchup(lookupFor(data), species, level, trainer.party, extraMoves);
}

export function teamAgainst(data: GameData, members: TeamMember[], level: number, trainer: Trainer): TeamMatchup {
  return teamMatchup(lookupFor(data), members, level, trainer.party);
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
