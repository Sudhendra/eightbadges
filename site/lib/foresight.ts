import { type Fork, type GameData, type Starter, trainerFor } from "./data.ts";
import { evaluateStop, matchupAgainst, type Matchup, stageAtLevel, stopLevel } from "./matchups.ts";
import { bestSighting, type Progress, type Sighting } from "./progress.ts";

/** How many fights ahead a pick should keep paying off. */
const LOOKAHEAD = 4;

export type Pick = {
  /** The species you catch. */
  species: string;
  /** What it will have become by this fight. */
  stage: string;
  where: Sighting | { gift: true };
  now: Matchup;
  /** Upcoming fights this pick has the edge in, by stop index. */
  laterWins: number[];
  rank: number;
};

export type ForkOption = { label: string; species: string; wins: number; total: number };

/** Abilities that make a Pokémon much weaker than its stats suggest. */
const HANDICAPS: Record<string, number> = { truant: 0.6, slow_start: 0.6 };

/** Raw strength: base stat total, cut down for crippling abilities like Slaking's Truant. */
function strengthOf(data: GameData, species: string): number {
  const mon = data.species.get(species)!;
  const total = mon.stats.reduce((sum, stat) => sum + stat, 0);
  const [only, ...others] = mon.abilities;
  return only && others.length === 0 ? total * (HANDICAPS[only] ?? 1) : total;
}

/** Every species in your starter's evolution line, so we don't suggest catching what you already have. */
function lineOf(data: GameData, starter: Starter): Set<string> {
  const line = new Set<string>([starter]);
  let current = data.species.get(starter)!;
  while (current.evolutions[0]) {
    line.add(current.evolutions[0].to);
    current = data.species.get(current.evolutions[0].to)!;
  }
  return line;
}

/**
 * Ranks what to catch before a fight. A pick scores for its matchup in this fight, for covering the fights
 * coming up where your starter struggles, and for raw strength. It assumes you train the pick up to each
 * fight's level, with level-up moves only.
 */
export function picksFor(data: GameData, progress: Progress, starter: Starter, index: number, count = 3): Pick[] {
  const stop = data.journey[index]!;
  if (index < progress.catchFrom) return [];
  const trainer = trainerFor(data, stop, starter);
  const level = stopLevel(trainer);
  const exclude = lineOf(data, starter);
  const upcoming = data.journey.slice(index + 1, index + 1 + LOOKAHEAD).map((next, offset) => ({
    index: index + 1 + offset,
    trainer: trainerFor(data, next, starter),
    starterScore: evaluateStop(data, next, starter).score,
  }));
  const starterNow = evaluateStop(data, stop, starter).score;

  const candidates = new Map<string, Sighting[]>();
  for (const sighting of progress.sightings) {
    if (sighting.from === null || sighting.from > index || exclude.has(sighting.species)) continue;
    candidates.set(sighting.species, [...(candidates.get(sighting.species) ?? []), sighting]);
  }
  const gifts = data.journey.slice(0, index + 1).flatMap((earlier) => earlier.opens.gifts ?? []);

  const scored = new Map<string, Pick>();
  const consider = (species: string, where: Pick["where"]): void => {
    const now = matchupAgainst(data, species, level, trainer);
    const later = upcoming.map((next) => ({
      index: next.index,
      matchup: matchupAgainst(data, species, stopLevel(next.trainer), next.trainer),
    }));
    // Coverage: how much better this pick does than your starter, only where your starter needs the help.
    const gaps = [now.score - starterNow, ...later.map((next, i) => next.matchup.score - upcoming[i]!.starterScore)];
    const coverage = gaps.reduce((sum, gap) => sum + Math.max(0, gap), 0) / gaps.length;
    const strength = (strengthOf(data, now.stage) - 430) / 100;
    const rank = 0.4 * now.score + 0.5 * coverage + 0.4 * strength;
    const pick: Pick = {
      species,
      stage: now.stage,
      where,
      now,
      laterWins: later.filter((next) => next.matchup.verdict === "easy").map((next) => next.index),
      rank,
    };
    // Pokémon that evolve into the same thing compete for one slot. Keep the better find.
    const existing = scored.get(now.stage);
    if (!existing || rank > existing.rank) scored.set(now.stage, pick);
  };

  for (const [species, sightings] of candidates) consider(species, bestSighting(sightings)!);
  for (const species of gifts) consider(species, { gift: true });

  return [...scored.values()].sort((a, b) => b.rank - a.rank).slice(0, count);
}

/** Scores each side of a one-time choice against every fight still ahead. */
export function weighFork(data: GameData, fork: Fork, starter: Starter): ForkOption[] {
  const start = data.journey.findIndex((stop) => stop.id === fork.after) + 1;
  const ahead = data.journey.slice(start).map((stop) => trainerFor(data, stop, starter));
  const scores = fork.options.map((option) =>
    ahead.map((trainer) => matchupAgainst(data, option.species, Math.max(option.level, stopLevel(trainer)), trainer).score),
  );
  return fork.options.map((option, i) => ({
    label: option.label,
    species: option.species,
    total: ahead.length,
    wins: scores[i]!.filter((score, fight) => scores.every((other, j) => j === i || score > other[fight]!)).length,
  }));
}

export { stageAtLevel };
