/**
 * The matchup engine. One file, no imports, no Node or browser APIs, so the exact same code runs in the data
 * pipeline, in the site build, and in the browser (the build strips the types and ships it as engine.js).
 */

export type EngineSpecies = {
  id: string;
  types: string[];
  abilities: string[];
  stats: number[];
  evolutions: { method: string; param: number | string; to: string }[];
};

export type EngineMove = { type: string; power: number; category: "physical" | "special" | "status" };

/** attacking type -> defending type -> multiplier. Pairs not listed deal normal damage. */
export type TypeChart = Record<string, Record<string, number>>;

/** What the engine needs to look things up. Pages and the browser each build one from their own data. */
export type Lookup = {
  species(id: string): EngineSpecies;
  move(id: string): EngineMove | undefined;
  levelMoves(species: string): [number, string][];
  chart: TypeChart;
};

export type Opponent = { species: string; level: number; moves: string[] };
export type Hit = { move: string; multiplier: number };
export type Verdict = "easy" | "fair" | "tough";

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

export type TeamMember = { species: string; /** Extra moves taught by TM, already available at this fight. */ extraMoves?: string[] };

export type TeamMatchup = {
  /** Average edge, with each opponent met by its best counter. */
  score: number;
  /** Rated on the weakest link: the opponent your team handles worst. */
  verdict: Verdict;
  /** Index into the opponent list of the one your team handles worst. */
  weakest: number;
  /** Index into the members list of who does best overall. */
  lead: number;
  /** For each opponent, the member who handles it best. */
  counters: { member: number; matchup: MonMatchup; edge: number }[];
  /** Each member's matchup, in member order. */
  members: Matchup[];
};

/**
 * The moves a Pokémon knows when created at a level, matching the game's GiveBoxMonInitialMoveset:
 * walk the learnset in order, skip moves already known, and drop the oldest move when full.
 */
export function initialMoves(level: number, learnset: [number, string][]): string[] {
  const moves: string[] = [];
  for (const [moveLevel, move] of learnset) {
    if (moveLevel > level) break;
    if (moves.includes(move)) continue;
    if (moves.length === 4) moves.shift();
    moves.push(move);
  }
  return moves;
}

/** Abilities that cancel a type outright. Only applied when a species can't have any other ability. */
const IMMUNITIES: Record<string, string> = {
  levitate: "ground",
  flash_fire: "fire",
  volt_absorb: "electric",
  water_absorb: "water",
};

export function typeMultiplier(lookup: Lookup, moveType: string, defender: EngineSpecies): number {
  const [only, ...others] = defender.abilities;
  if (only && others.length === 0 && IMMUNITIES[only] === moveType) return 0;
  return defender.types.reduce((total, type) => total * (lookup.chart[moveType]?.[type] ?? 1), 1);
}

/** The move likely to hurt most: power, then same-type bonus, then type matchup. Status moves don't count. */
export function bestHit(lookup: Lookup, moves: string[], attacker: EngineSpecies, defender: EngineSpecies): Hit | null {
  let best: { hit: Hit; score: number } | null = null;
  for (const id of moves) {
    const move = lookup.move(id);
    if (!move || move.category === "status") continue;
    const multiplier = typeMultiplier(lookup, move.type, defender);
    const same = attacker.types.includes(move.type) ? 1.5 : 1;
    const score = multiplier * same * Math.max(move.power, 10);
    if (!best || score > best.score) best = { hit: { move: id, multiplier }, score };
  }
  return best ? best.hit : null;
}

/** Follows level-up evolutions as far as this level allows. Stone and trade evolutions are left alone. */
export function stageAtLevel(lookup: Lookup, species: string, level: number): EngineSpecies {
  let current = lookup.species(species);
  for (;;) {
    const next: EngineSpecies["evolutions"][number] | undefined = current.evolutions.find(
      (evolution) => evolution.method === "level" && typeof evolution.param === "number" && evolution.param <= level,
    );
    if (!next) return current;
    current = lookup.species(next.to);
  }
}

const log2 = (multiplier: number): number => Math.log2(Math.max(multiplier, 0.25));

/** How much better you do against one opponent than it does against you, in doublings of damage. */
export function edgeOf(mon: MonMatchup): number {
  return log2(mon.you ? mon.you.multiplier : 0.25) - log2(mon.it ? mon.it.multiplier : 0.5);
}

export function verdictFor(score: number): Verdict {
  if (score >= 0.75) return "easy";
  if (score >= -0.25) return "fair";
  return "tough";
}

/**
 * The moves a Pokémon brings to a fight: its TM moves first, then its most recent level-up moves,
 * four at most, like the real game.
 */
export function movesAt(lookup: Lookup, stage: EngineSpecies, level: number, extraMoves: string[] = []): string[] {
  const taught = [...new Set(extraMoves)].slice(0, 4);
  const learned = initialMoves(level, lookup.levelMoves(stage.id)).filter((move) => !taught.includes(move));
  return [...taught, ...learned.slice(-(4 - taught.length) || learned.length)].slice(0, 4);
}

/** How a Pokémon caught as `species` and raised to `level` fares against a team. */
export function matchup(lookup: Lookup, species: string, level: number, party: Opponent[], extraMoves: string[] = []): Matchup {
  const stage = stageAtLevel(lookup, species, level);
  const moves = movesAt(lookup, stage, level, extraMoves);
  const mons = party.map((mon): MonMatchup => {
    const opponent = lookup.species(mon.species);
    return {
      species: mon.species,
      level: mon.level,
      you: bestHit(lookup, moves, stage, opponent),
      it: bestHit(lookup, mon.moves, opponent, stage),
    };
  });
  const score = mons.reduce((sum, mon) => sum + edgeOf(mon), 0) / mons.length;
  return { stage: stage.id, level, moves, mons, score, verdict: verdictFor(score) };
}

/** A whole team against one fight: each opponent is met by whichever member handles it best. */
export function teamMatchup(lookup: Lookup, members: TeamMember[], level: number, party: Opponent[]): TeamMatchup {
  const results = members.map((member) => matchup(lookup, member.species, level, party, member.extraMoves));
  const counters = party.map((_, i) => {
    let best = { member: 0, matchup: results[0]!.mons[i]!, edge: edgeOf(results[0]!.mons[i]!) };
    results.forEach((result, member) => {
      const edge = edgeOf(result.mons[i]!);
      if (edge > best.edge) best = { member, matchup: result.mons[i]!, edge };
    });
    return best;
  });
  const score = counters.reduce((sum, counter) => sum + counter.edge, 0) / counters.length;
  let weakest = 0;
  counters.forEach((counter, i) => {
    if (counter.edge < counters[weakest]!.edge) weakest = i;
  });
  // A team is only as good as its answer to the opponent it handles worst.
  const worst = counters[weakest]!.edge;
  const verdict: Verdict = worst >= 1 ? "easy" : worst >= 0 ? "fair" : "tough";
  let lead = 0;
  results.forEach((result, i) => {
    if (result.score > results[lead]!.score) lead = i;
  });
  return { score, verdict, weakest, lead, counters, members: results };
}
