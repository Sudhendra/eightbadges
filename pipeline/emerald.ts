import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractEncounters } from "./extract/encounters.ts";
import { extractItems, type ItemSource } from "./extract/items.ts";
import { extractAbilities, extractLearnsets, extractMoves, extractSpecies } from "./extract/pokemon.ts";
import { extractTrainers } from "./extract/trainers.ts";
import { extractTypeChart } from "./extract/types.ts";
import { extractWorld } from "./extract/world.ts";

/** Reads the decomp and returns every output file's contents, keyed by file name. Pure apart from reading. */
export function buildEmerald(decompDir: string): Record<string, unknown> {
  const read = (path: string): string => readFileSync(join(decompDir, path), "utf8");

  const species = extractSpecies(read);
  const moves = extractMoves(read);
  const items = extractItems(read);
  const tmMoves = new Set(items.flatMap((item) => (item.teaches ? [item.teaches] : [])));
  const learnsets = extractLearnsets(read, species.map((mon) => mon.id), tmMoves);
  const trainers = extractTrainers(read, learnsets);
  const { world, places } = extractWorld(decompDir, read);
  const mapIds = new Set(world.maps.map((map) => map.id));
  const encounters = extractEncounters(read).filter((table) => mapIds.has(table.map));

  const byId = new Map(items.map((item) => [item.id, item]));
  for (const place of places) {
    const add = (ids: string[], how: ItemSource["how"]): void => {
      for (const id of ids) byId.get(id)?.where.push({ map: place.id, how });
    };
    add(place.pickups, "pickup");
    add(place.hidden, "hidden");
    add(place.gifts, "gift");
    add(place.prizes, "prize");
    add([...new Set(place.marts.flat())], "mart");
  }

  return {
    "world.json": world,
    "places.json": places,
    "species.json": species,
    "moves.json": moves,
    "abilities.json": extractAbilities(read),
    "items.json": items,
    "learnsets.json": learnsets,
    "trainers.json": trainers,
    "encounters.json": encounters,
    "types.json": extractTypeChart(read),
  };
}
