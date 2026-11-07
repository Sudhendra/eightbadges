import type { Table } from "../../pipeline/extract/encounters.ts";
import type { GameData, Stop, Tool } from "./data.ts";

export type Method = "land" | "surf" | "rockSmash" | "oldRod" | "goodRod" | "superRod";

export const METHOD_LABEL: Record<Method, string> = {
  land: "GRASS",
  surf: "SURF",
  rockSmash: "ROCK SMASH",
  oldRod: "OLD ROD",
  goodRod: "GOOD ROD",
  superRod: "SUPER ROD",
};

const METHOD_TOOL: Record<Method, Tool | null> = {
  land: null,
  surf: "surf",
  rockSmash: "rock_smash",
  oldRod: "old_rod",
  goodRod: "good_rod",
  superRod: "super_rod",
};

const METHODS = Object.keys(METHOD_TOOL) as Method[];

export type Sighting = {
  species: string;
  map: string;
  section: string;
  method: Method;
  min: number;
  max: number;
  chance: number;
  /** Index of the first stop you can reach this before, or null if only after the Champion. */
  from: number | null;
};

/** Where each region map section first opens up, and what you can catch along the way. */
export type Progress = {
  /** section id -> index of the first stop it's open before. */
  sectionFrom: Map<string, number>;
  /** tool -> index of the first stop it's usable before. */
  toolFrom: Map<Tool, number>;
  /** Every wild encounter in the game, with when it becomes reachable. */
  sightings: Sighting[];
  /** Index of the first stop where catching is possible. */
  catchFrom: number;
  /** Earliest stop each map is open before, or null. */
  mapFrom(map: string): number | null;
};

export function buildProgress(data: GameData): Progress {
  const sectionFrom = new Map<string, number>();
  const toolFrom = new Map<Tool, number>();
  data.journey.forEach((stop: Stop, index) => {
    for (const area of stop.opens.areas) if (!sectionFrom.has(area)) sectionFrom.set(area, index);
    for (const tool of stop.opens.tools ?? []) if (!toolFrom.has(tool)) toolFrom.set(tool, index);
  });
  const catchFrom = data.journey.findIndex((stop) => !stop.opens.noCatching);
  const mapSection = new Map(data.world.maps.map((map) => [map.id, map.section]));
  const mapFrom = (map: string): number | null => {
    const section = mapSection.get(map);
    return section === undefined ? null : (sectionFrom.get(section) ?? null);
  };

  const sightings: Sighting[] = [];
  for (const table of data.encounters) {
    const section = mapSection.get(table.map)!;
    for (const method of METHODS) {
      const encounters: Table | undefined = table[method];
      if (!encounters) continue;
      const area = sectionFrom.get(section);
      const tool = METHOD_TOOL[method];
      const toolIndex = tool ? toolFrom.get(tool) : 0;
      const from =
        area === undefined || toolIndex === undefined ? null : Math.max(area, toolIndex ?? 0, catchFrom);
      for (const slot of encounters.slots) {
        sightings.push({ ...slot, map: table.map, section, method, from });
      }
    }
  }
  return { sectionFrom, toolFrom, sightings, catchFrom, mapFrom };
}

/** The best single place to find a species: open earliest, then most likely. */
export function bestSighting(sightings: Sighting[]): Sighting | undefined {
  return [...sightings].sort(
    (a, b) => (a.from ?? Infinity) - (b.from ?? Infinity) || b.chance - a.chance,
  )[0];
}
