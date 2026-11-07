import { slug } from "../lib/c.ts";
import type { Read } from "./pokemon.ts";

export type Slot = { species: string; min: number; max: number; chance: number };
export type Table = { rate: number; slots: Slot[] };

export type EncounterTable = {
  map: string;
  /** Present on maps with several rotating tables, such as Altering Cave. */
  variant?: string;
  land?: Table;
  surf?: Table;
  rockSmash?: Table;
  oldRod?: Table;
  goodRod?: Table;
  superRod?: Table;
};

type RawMon = { min_level: number; max_level: number; species: string };
type RawTable = { encounter_rate: number; mons: RawMon[] };
type RawEncounter = {
  map: string;
  base_label: string;
  land_mons?: RawTable;
  water_mons?: RawTable;
  rock_smash_mons?: RawTable;
  fishing_mons?: RawTable;
};
type RawField = { type: string; encounter_rates: number[]; groups?: Record<string, number[]> };
type RawFile = {
  wild_encounter_groups: { label: string; fields: RawField[]; encounters: RawEncounter[] }[];
};

/** Combines slots that are the same species and levels, so a table reads as what you can actually meet. */
function toTable(raw: RawTable, rates: number[], indices?: number[]): Table {
  const slots = new Map<string, Slot>();
  for (const index of indices ?? rates.map((_, i) => i)) {
    const mon = raw.mons[index];
    const chance = rates[index];
    if (!mon || chance === undefined) throw new Error(`Encounter slot ${index} is out of range`);
    const species = slug(mon.species, "SPECIES_");
    const key = `${species}:${mon.min_level}:${mon.max_level}`;
    const existing = slots.get(key);
    if (existing) existing.chance += chance;
    else slots.set(key, { species, min: mon.min_level, max: mon.max_level, chance });
  }
  return { rate: raw.encounter_rate, slots: [...slots.values()] };
}

export function extractEncounters(read: Read): EncounterTable[] {
  const file = JSON.parse(read("src/data/wild_encounters.json")) as RawFile;
  // The other groups belong to the Battle Pyramid and Pike, which are not part of the journey.
  const group = file.wild_encounter_groups.find((candidate) => candidate.label === "gWildMonHeaders");
  if (!group) throw new Error("gWildMonHeaders not found");

  const fields = new Map(group.fields.map((f) => [f.type, f]));
  const rates = (type: string): number[] => {
    const rate = fields.get(type)?.encounter_rates;
    if (!rate) throw new Error(`No rates for ${type}`);
    return rate;
  };
  const rods = fields.get("fishing_mons")?.groups;
  if (!rods) throw new Error("No fishing rod groups");

  const perMap = new Map<string, number>();
  for (const raw of group.encounters) perMap.set(raw.map, (perMap.get(raw.map) ?? 0) + 1);

  return group.encounters.map((raw) => {
    const table: EncounterTable = { map: slug(raw.map, "MAP_") };
    if ((perMap.get(raw.map) ?? 0) > 1) table.variant = raw.base_label.replace(/^g/, "");
    if (raw.land_mons) table.land = toTable(raw.land_mons, rates("land_mons"));
    if (raw.water_mons) table.surf = toTable(raw.water_mons, rates("water_mons"));
    if (raw.rock_smash_mons) table.rockSmash = toTable(raw.rock_smash_mons, rates("rock_smash_mons"));
    if (raw.fishing_mons) {
      const fishing = rates("fishing_mons");
      table.oldRod = toTable(raw.fishing_mons, fishing, rods["old_rod"]);
      table.goodRod = toTable(raw.fishing_mons, fishing, rods["good_rod"]);
      table.superRod = toTable(raw.fishing_mons, fishing, rods["super_rod"]);
    }
    return table;
  });
}
