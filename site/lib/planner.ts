import { edgeOf, type Opponent } from "../../shared/engine.ts";
import { type GameData, type Starter, STARTERS, trainerFor } from "./data.ts";
import { lookupFor, matchupAgainst, stopLevel } from "./matchups.ts";
import type { Progress } from "./progress.ts";
import { spritePath } from "./sprites.ts";

/** Everything the planner page needs, in one file it loads on demand. */
export type PlannerData = {
  spriteExample: string;
  chart: GameData["types"];
  species: Record<string, {
    name: string;
    dex: number;
    types: string[];
    abilities: string[];
    stats: number[];
    evolutions: { method: string; param: number | string; to: string }[];
    level: [number, string][];
    tm: string[];
  }>;
  moves: Record<string, { name: string; type: string; power: number; category: "physical" | "special" | "status" }>;
  stops: {
    id: string;
    title: string;
    place: string;
    kind: string;
    level: number;
    /** One party, or one per starter for rival fights. */
    party: Opponent[] | Record<Starter, Opponent[]>;
  }[];
  /** TMs and HMs with the first stop index they're in hand for. */
  machines: { id: string; name: string; move: string; from: number }[];
  /** Species you can add to a team, with the first stop index they can join for. */
  catchable: Record<string, number>;
  /** Foresight's suggested team for each starter: five species to add to the starter. */
  presets: Record<Starter, string[]>;
};

/** The first stop each catchable species can join a team for: wild, gift, or a one-time choice. */
export function catchableFrom(data: GameData, progress: Progress): Map<string, number> {
  const from = new Map<string, number>();
  const offer = (species: string, index: number) => {
    const known = from.get(species);
    if (known === undefined || index < known) from.set(species, index);
  };
  for (const sighting of progress.sightings) if (sighting.from !== null) offer(sighting.species, sighting.from);
  data.journey.forEach((stop, index) => {
    for (const species of stop.opens.gifts ?? []) offer(species, index + 1);
  });
  for (const fork of data.forks) {
    const index = data.journey.findIndex((stop) => stop.id === fork.after) + 1;
    for (const option of fork.options) offer(option.species, index);
  }
  return from;
}

function familyOf(data: GameData, species: string): string {
  const parents = new Map<string, string>();
  for (const mon of data.species.values()) for (const evolution of mon.evolutions) parents.set(evolution.to, mon.id);
  let root = species;
  while (parents.has(root)) root = parents.get(root)!;
  return root;
}

function strength(data: GameData, species: string, level: number): number {
  const stage = data.species.get(lookupFor(data).species(species).id)!;
  const evolved = data.species.get(stageId(data, stage.id, level))!;
  const total = evolved.stats.reduce((sum, stat) => sum + stat, 0);
  const [only, ...others] = evolved.abilities;
  return (only === "truant" && others.length === 0 ? total * 0.6 : total);
}

function stageId(data: GameData, species: string, level: number): string {
  let current = data.species.get(species)!;
  for (;;) {
    const next = current.evolutions.find((evo) => evo.method === "level" && typeof evo.param === "number" && evo.param <= level);
    if (!next) return current.id;
    current = data.species.get(next.to)!;
  }
}

/**
 * Picks five teammates for a starter, one at a time. Each pick is whoever adds the most to the team across every
 * fight it's around for, where each opponent is met by the best member. Raw strength breaks close calls.
 * Only one member per evolution family.
 */
export function foresightTeam(data: GameData, progress: Progress, starter: Starter): string[] {
  const from = catchableFrom(data, progress);
  const fights = data.journey.map((stop) => {
    const trainer = trainerFor(data, stop, starter);
    return { trainer, level: stopLevel(trainer) };
  });
  const edgesFor = (species: string, joins: number): (number[] | null)[] =>
    fights.map((fight, index) => {
      if (index < joins) return null;
      const bonus = 0.25 * ((strength(data, species, fight.level) - 430) / 100);
      return matchupAgainst(data, species, fight.level, fight.trainer).mons.map((mon) => edgeOf(mon) + bonus);
    });

  const starterFamily = familyOf(data, starter);
  const candidates = [...from].filter(([species]) => familyOf(data, species) !== starterFamily);
  const edges = new Map(candidates.map(([species, joins]) => [species, edgesFor(species, joins)]));
  let best: number[][] = edgesFor(starter, 0).map((fight) => fight!);
  const team: string[] = [];
  const families = new Set([starterFamily]);

  for (let slot = 0; slot < 5; slot++) {
    let choice: { species: string; gain: number; next: number[][] } | null = null;
    for (const [species] of candidates) {
      if (families.has(familyOf(data, species))) continue;
      const own = edges.get(species)!;
      let gain = 0;
      const next = best.map((fight, i) => {
        const mine = own[i];
        if (!mine) return fight;
        return fight.map((edge, j) => {
          const better = Math.max(edge, mine[j]!);
          gain += better - edge;
          return better;
        });
      });
      if (!choice || gain > choice.gain) choice = { species, gain, next };
    }
    if (!choice) break;
    team.push(choice.species);
    families.add(familyOf(data, choice.species));
    best = choice.next;
  }
  return team;
}

export function plannerData(data: GameData, progress: Progress): PlannerData {
  const from = catchableFrom(data, progress);
  const machines = data.items
    .filter((item) => item.teaches)
    .map((item) => {
      const reachable = item.where
        .map((source) => progress.mapFrom(source.map))
        .filter((index): index is number => index !== null);
      return { id: item.id, name: item.name, move: item.teaches!, from: reachable.length ? Math.min(...reachable) : data.journey.length };
    });
  const party = (trainer: { party: Opponent[] }): Opponent[] =>
    trainer.party.map((mon) => ({ species: mon.species, level: mon.level, moves: mon.moves }));

  const usedMoves = new Set<string>();
  const species: PlannerData["species"] = {};
  for (const mon of data.species.values()) {
    const learnset = data.learnsets[mon.id]!;
    for (const [, move] of learnset.level) usedMoves.add(move);
    for (const move of learnset.tm) usedMoves.add(move);
    species[mon.id] = {
      name: mon.name,
      dex: mon.dex,
      types: mon.types,
      abilities: mon.abilities,
      stats: mon.stats,
      evolutions: mon.evolutions,
      level: learnset.level,
      tm: learnset.tm,
    };
  }
  const stops = data.journey.map((stop) => {
    const perStarter = stop.trainer.includes("{starter}");
    const first = trainerFor(data, stop, "treecko");
    return {
      id: stop.id,
      title: stop.title,
      place: stop.place,
      kind: stop.kind,
      level: stopLevel(first),
      party: perStarter
        ? (Object.fromEntries(STARTERS.map((starter) => [starter, party(trainerFor(data, stop, starter))])) as Record<Starter, Opponent[]>)
        : party(first),
    };
  });
  for (const stop of stops) {
    const parties = Array.isArray(stop.party) ? [stop.party] : Object.values(stop.party);
    for (const opponents of parties) for (const mon of opponents) for (const move of mon.moves) usedMoves.add(move);
  }
  const moves: PlannerData["moves"] = {};
  for (const id of usedMoves) {
    const move = data.moves.get(id)!;
    moves[id] = { name: move.name, type: move.type, power: move.power, category: move.category };
  }

  return {
    spriteExample: spritePath(1),
    chart: data.types,
    species,
    moves,
    stops,
    machines,
    catchable: Object.fromEntries([...from].sort((a, b) => a[1] - b[1])),
    presets: Object.fromEntries(STARTERS.map((starter) => [starter, foresightTeam(data, progress, starter)])) as Record<Starter, string[]>,
  };
}
