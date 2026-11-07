import { readdirSync } from "node:fs";
import { join } from "node:path";
import { slug } from "../lib/c.ts";
import type { Read } from "./pokemon.ts";

export type EdgeKind = "walk" | "warp" | "dive" | "emerge" | "script";

export type WorldMap = { id: string; type: string; section: string };
export type Section = { id: string; name: string; x: number; y: number; w: number; h: number };

export type World = {
  start: string;
  maps: WorldMap[];
  sections: Section[];
  /** [from, to, kind]. One-way unless the reverse edge also exists. */
  edges: [string, string, EdgeKind][];
};

export type Place = {
  id: string;
  trainers: string[];
  pickups: string[];
  hidden: string[];
  gifts: string[];
  /** Earned or exchanged at a counter, such as Game Corner coins or Battle Frontier points. */
  prizes: string[];
  marts: string[][];
  /** Gift Pokémon, as [species, level]. */
  giftMons: [string, number][];
  eggs: string[];
  /** Fixed wild battles such as legendaries, as [species, level]. */
  staticMons: [string, number][];
};

type RawMap = {
  id: string;
  name: string;
  region_map_section: string;
  map_type: string;
  connections?: { map: string; direction: string }[] | null;
  warp_events?: { dest_map: string }[] | null;
  object_events?: { script?: string; graphics_id?: string }[] | null;
  bg_events?: { type: string; item?: string }[] | null;
};

/** Maps a player can never stand on, or that only exist for link play. */
const EXCLUDED = /UNUSED|PROTOTYPE|BATTLE_COLOSSEUM|TRADE_CENTER|RECORD_CORNER|UNION_ROOM|^MAP_NONE$|^MAP_DYNAMIC$/;

function readMaps(decompDir: string, read: Read): { raw: RawMap; scripts: string }[] {
  const mapsDir = join(decompDir, "data/maps");
  return readdirSync(mapsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .flatMap((name) => {
      let raw: RawMap;
      try {
        raw = JSON.parse(read(`data/maps/${name}/map.json`)) as RawMap;
      } catch {
        return [];
      }
      let scripts = "";
      try {
        scripts = read(`data/maps/${name}/scripts.inc`);
      } catch {
        // A few maps have no scripts of their own.
      }
      return [{ raw, scripts }];
    })
    .filter(({ raw }) => !EXCLUDED.test(raw.id));
}

function martLists(scripts: string): string[][] {
  const lists: string[][] = [];
  for (const use of scripts.matchAll(/^\s*pokemart\s+(\w+)/gm)) {
    const label = new RegExp(`^${use[1]}:+\\s*$([\\s\\S]*?)pokemartlistend`, "m").exec(scripts);
    if (!label) throw new Error(`Mart list ${use[1]} not found`);
    const items = [...label[1]!.matchAll(/\.2byte\s+ITEM_(\w+)/g)].map((m) => m[1]!.toLowerCase());
    if (!lists.some((list) => list.join() === items.join())) lists.push(items);
  }
  return lists;
}

/** Item balls call a tiny script that runs `finditem`. This maps those script labels to their items. */
function findItemLabels(sources: string[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const source of sources) {
    for (const match of source.matchAll(/^(\w+)::?\s*\n\s*finditem\s+ITEM_(\w+)/gm)) {
      labels.set(match[1]!, match[2]!.toLowerCase());
    }
  }
  return labels;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function extractWorld(decompDir: string, read: Read): { world: World; places: Place[] } {
  const maps = readMaps(decompDir, read);
  const known = new Set(maps.map(({ raw }) => raw.id));
  const sectionFile = JSON.parse(read("src/data/region_map/region_map_sections.json")) as {
    map_sections: { id: string; name: string; x?: number; y?: number; width?: number; height?: number }[];
  };

  const edges = new Map<string, [string, string, EdgeKind]>();
  const addEdge = (from: string, to: string, kind: EdgeKind): void => {
    if (!known.has(to) || from === to) return;
    const key = `${from}>${to}`;
    // A map pair keeps its most direct way of travel: walking beats a door, a door beats a script.
    const rank: Record<EdgeKind, number> = { walk: 0, warp: 1, dive: 2, emerge: 2, script: 3 };
    const existing = edges.get(key);
    if (!existing || rank[kind] < rank[existing[2]]) {
      edges.set(key, [slug(from, "MAP_"), slug(to, "MAP_"), kind]);
    }
  };

  const shared = readdirSync(join(decompDir, "data/scripts"))
    .filter((name) => name.endsWith(".inc"))
    .sort()
    .map((name) => read(`data/scripts/${name}`));
  const itemLabels = findItemLabels([...shared, ...maps.map(({ scripts }) => scripts)]);

  const places: Place[] = [];
  for (const { raw, scripts } of maps) {
    for (const connection of raw.connections ?? []) {
      const kind: EdgeKind =
        connection.direction === "dive" ? "dive" : connection.direction === "emerge" ? "emerge" : "walk";
      addEdge(raw.id, connection.map, kind);
    }
    for (const warp of raw.warp_events ?? []) addEdge(raw.id, warp.dest_map, "warp");
    // Scripted travel: ferries, elevators, cutscenes, and dive spots set by `setdivewarp`.
    for (const match of scripts.matchAll(/^\s*(?:warp\w*|set\w*warp)\s+(MAP_\w+)/gm)) {
      addEdge(raw.id, match[1]!, "script");
    }

    const trainers = [...scripts.matchAll(/trainerbattle\w*\s+(?:[A-Z_]+,\s*)?TRAINER_(\w+)/g)]
      .map((m) => m[1]!)
      .filter((id) => !id.startsWith("BATTLE_"))
      .map((id) => id.toLowerCase());

    places.push({
      id: slug(raw.id, "MAP_"),
      trainers: unique(trainers),
      pickups: unique(
        (raw.object_events ?? []).flatMap((object) => {
          const item = object.script ? itemLabels.get(object.script) : undefined;
          return item ? [item] : [];
        }),
      ),
      hidden: unique(
        (raw.bg_events ?? []).flatMap((event) =>
          event.type === "hidden_item" && event.item ? [slug(event.item, "ITEM_")] : [],
        ),
      ),
      gifts: unique([...scripts.matchAll(/^\s*giveitem\s+ITEM_(\w+)/gm)].map((m) => m[1]!.toLowerCase())),
      prizes: unique(
        [...scripts.matchAll(/^\s*(?:additem\s+|setvar\s+VAR_\w+,\s*)ITEM_(\w+)/gm)]
          .map((m) => m[1]!.toLowerCase())
          .filter((item) => item !== "none"),
      ),
      marts: martLists(scripts),
      giftMons: [...scripts.matchAll(/^\s*givemon\s+SPECIES_(\w+),\s*(\d+)/gm)].map(
        (m): [string, number] => [m[1]!.toLowerCase(), Number(m[2])],
      ),
      eggs: unique([...scripts.matchAll(/^\s*giveegg\s+SPECIES_(\w+)/gm)].map((m) => m[1]!.toLowerCase())),
      staticMons: [...scripts.matchAll(/^\s*setwildbattle\s+SPECIES_(\w+),\s*(\d+)/gm)].map(
        (m): [string, number] => [m[1]!.toLowerCase(), Number(m[2])],
      ),
    });
  }

  const usedSections = new Set(maps.map(({ raw }) => raw.region_map_section));
  const sections: Section[] = sectionFile.map_sections
    .filter((section) => usedSections.has(section.id) && section.x !== undefined)
    .map((section) => ({
      id: slug(section.id, "MAPSEC_"),
      name: section.name,
      x: section.x!,
      y: section.y!,
      w: section.width!,
      h: section.height!,
    }));

  return {
    world: {
      start: "littleroot_town",
      maps: maps.map(({ raw }) => ({
        id: slug(raw.id, "MAP_"),
        type: slug(raw.map_type, "MAP_TYPE_"),
        section: slug(raw.region_map_section, "MAPSEC_"),
      })),
      sections,
      edges: [...edges.values()],
    },
    places,
  };
}
