import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { DECOMP_COMMIT, DECOMP_DIR, GZIP_BUDGETS, OUTPUT_DIR } from "../config.ts";
import { buildEmerald } from "../emerald.ts";
import type { EncounterTable, Table } from "../extract/encounters.ts";
import type { Item } from "../extract/items.ts";
import type { Learnset, Move, Species } from "../extract/pokemon.ts";
import type { Trainer } from "../extract/trainers.ts";
import type { Place, World } from "../extract/world.ts";

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(OUTPUT_DIR, name), "utf8")) as T;
}

const species = load<Species[]>("species.json");
const moves = load<Move[]>("moves.json");
const items = load<Item[]>("items.json");
const abilities = load<Record<string, string>>("abilities.json");
const learnsets = load<Record<string, Learnset>>("learnsets.json");
const trainers = load<Trainer[]>("trainers.json");
const encounters = load<EncounterTable[]>("encounters.json");
const world = load<World>("world.json");
const places = load<Place[]>("places.json");
const manifest = load<{ decompCommit: string; files: Record<string, { gzip: number }> }>("manifest.json");

const speciesIds = new Set(species.map((mon) => mon.id));
const moveIds = new Set(moves.map((move) => move.id));
const itemIds = new Set(items.map((item) => item.id));
const mapIds = new Set(world.maps.map((map) => map.id));
const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));

function reachableFrom(start: string): Set<string> {
  const next = new Map<string, string[]>();
  for (const [from, to] of world.edges) next.set(from, [...(next.get(from) ?? []), to]);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    for (const to of next.get(queue.pop()!) ?? []) {
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return seen;
}

test("the manifest matches the pinned decomp commit", () => {
  assert.equal(manifest.decompCommit, DECOMP_COMMIT);
});

test("every output file stays inside its gzip budget", () => {
  for (const [name, file] of Object.entries(manifest.files)) {
    const budget = GZIP_BUDGETS[name];
    assert.ok(budget, `${name} has no budget`);
    assert.ok(file.gzip <= budget, `${name} is ${file.gzip} B gzipped, budget is ${budget} B`);
  }
});

test("all 386 species are present with sane stats and unique dex numbers", () => {
  assert.equal(species.length, 386);
  assert.deepEqual(species.map((mon) => mon.dex), Array.from({ length: 386 }, (_, i) => i + 1));
  for (const mon of species) {
    assert.ok(mon.types.length >= 1 && mon.types.length <= 2, mon.id);
    assert.ok(mon.abilities.length >= 1, mon.id);
    assert.ok(mon.stats.every((stat) => stat > 0), mon.id);
    for (const ability of mon.abilities) assert.ok(abilities[ability], `${mon.id}: ${ability}`);
    for (const item of mon.wildItems) assert.ok(itemIds.has(item), `${mon.id}: ${item}`);
  }
});

test("known species values match the game", () => {
  const byId = new Map(species.map((mon) => [mon.id, mon]));
  const treecko = byId.get("treecko")!;
  assert.deepEqual(treecko.stats, [40, 45, 35, 65, 55, 70]);
  assert.deepEqual(treecko.types, ["grass"]);
  assert.equal(treecko.dex, 252);
  assert.equal(treecko.hoenn, 1);
  assert.deepEqual(treecko.evolutions, [{ method: "level", param: 16, to: "grovyle" }]);
  assert.equal(byId.get("rayquaza")!.hoenn, 200);
  assert.equal(byId.get("bulbasaur")!.hoenn, null);
  assert.equal(byId.get("magnemite")!.female, null);
  assert.equal(byId.get("mr_mime")!.name, "MR. MIME");
});

test("evolutions point at real species and items", () => {
  for (const mon of species) {
    for (const evolution of mon.evolutions) {
      assert.ok(speciesIds.has(evolution.to), `${mon.id} -> ${evolution.to}`);
      if (typeof evolution.param === "string") assert.ok(itemIds.has(evolution.param), evolution.param);
    }
  }
});

test("all 354 moves are present and Gen 3 splits physical and special by type", () => {
  assert.equal(moves.length, 354);
  const byId = new Map(moves.map((move) => [move.id, move]));
  assert.equal(byId.get("shadow_ball")!.category, "physical");
  assert.equal(byId.get("crunch")!.category, "special");
  assert.equal(byId.get("toxic")!.category, "status");
  assert.equal(byId.get("swift")!.accuracy, null);
  assert.equal(byId.get("quick_attack")!.priority, 1);
});

test("all learnset moves exist, and every species has moves", () => {
  assert.equal(Object.keys(learnsets).length, 386);
  for (const [id, learnset] of Object.entries(learnsets)) {
    assert.ok(learnset.level.length > 0, id);
    const all = [...learnset.level.map(([, move]) => move), ...learnset.tm, ...learnset.tutor, ...learnset.egg];
    for (const move of all) assert.ok(moveIds.has(move), `${id}: ${move}`);
  }
  const treecko = learnsets["treecko"]!;
  assert.deepEqual(treecko.level[0], [1, "pound"]);
  assert.ok(treecko.tm.includes("bullet_seed"));
  assert.ok(treecko.tutor.includes("swords_dance"));
  assert.ok(treecko.egg.includes("crunch"));
});

test("there are exactly 50 TMs and 8 HMs, all teaching real moves", () => {
  const machines = items.filter((item) => item.teaches);
  assert.equal(machines.filter((item) => item.name.startsWith("TM")).length, 50);
  assert.equal(machines.filter((item) => item.name.startsWith("HM")).length, 8);
  for (const machine of machines) assert.ok(moveIds.has(machine.teaches!), machine.id);
  const hms = machines.filter((item) => item.name.startsWith("HM")).map((item) => item.teaches).sort();
  assert.deepEqual(hms, ["cut", "dive", "flash", "fly", "rock_smash", "strength", "surf", "waterfall"]);
});

test("every TM and HM has a known location", () => {
  const missing = items.filter((item) => item.teaches && item.where.length === 0).map((item) => item.name);
  assert.deepEqual(missing, []);
});

test("every trainer has a valid party", () => {
  assert.ok(trainers.length > 800);
  for (const trainer of trainers) {
    assert.ok(trainer.party.length >= 1 && trainer.party.length <= 6, trainer.id);
    for (const mon of trainer.party) {
      assert.ok(speciesIds.has(mon.species), `${trainer.id}: ${mon.species}`);
      assert.ok(mon.moves.length >= 1 && mon.moves.length <= 4, `${trainer.id}: ${mon.species}`);
      for (const move of mon.moves) assert.ok(moveIds.has(move), `${trainer.id}: ${move}`);
      if (mon.item) assert.ok(itemIds.has(mon.item), `${trainer.id}: ${mon.item}`);
    }
  }
});

test("Roxanne has her real first team", () => {
  const roxanne = trainerById.get("roxanne_1")!;
  assert.equal(roxanne.class, "leader");
  assert.deepEqual(roxanne.party.map((mon) => [mon.species, mon.level]), [["geodude", 12], ["geodude", 12], ["nosepass", 15]]);
  assert.ok(roxanne.party[2]!.moves.includes("rock_tomb"));
});

test("rival fights counter the starter the player chose", () => {
  // Trainer ids are named after the player's starter. The rival takes the type that beats it.
  const counters = { treecko: "torchic", torchic: "mudkip", mudkip: "treecko" };
  for (const rival of ["may", "brendan"]) {
    for (const [chosen, counter] of Object.entries(counters)) {
      const fight = trainerById.get(`${rival}_route_103_${chosen}`);
      assert.ok(fight, `${rival} route 103 ${chosen}`);
      assert.equal(fight.party.at(-1)!.species, counter, fight.id);
    }
  }
});

test("each encounter table's slot chances add up to 100", () => {
  assert.ok(encounters.length > 80);
  const check = (table: Table | undefined, label: string): void => {
    if (!table) return;
    assert.equal(table.slots.reduce((sum, slot) => sum + slot.chance, 0), 100, label);
    for (const slot of table.slots) {
      assert.ok(speciesIds.has(slot.species), `${label}: ${slot.species}`);
      assert.ok(slot.min >= 1 && slot.min <= slot.max, label);
    }
  };
  for (const entry of encounters) {
    assert.ok(mapIds.has(entry.map), `Unknown map ${entry.map}`);
    for (const key of ["land", "surf", "rockSmash", "oldRod", "goodRod", "superRod"] as const) {
      check(entry[key], `${entry.map} ${key}`);
    }
  }
});

test("Route 101 has its real encounters", () => {
  const route = encounters.find((entry) => entry.map === "route101")!;
  const chance = (id: string): number => route.land!.slots.filter((s) => s.species === id).reduce((n, s) => n + s.chance, 0);
  assert.equal(chance("wurmple") + chance("poochyena") + chance("zigzagoon"), 100);
});

test("every world edge joins real maps, and every map has a real section", () => {
  const sections = new Set(world.sections.map((section) => section.id));
  for (const [from, to] of world.edges) {
    assert.ok(mapIds.has(from), from);
    assert.ok(mapIds.has(to), to);
  }
  for (const section of world.sections) assert.ok(section.x >= 0 && section.y >= 0, section.id);
  assert.ok(sections.has("littleroot_town"));
});

test("every town, city and route can be reached from Littleroot", () => {
  const reachable = reachableFrom(world.start);
  const outdoors = world.maps.filter((map) => ["route", "ocean_route", "town", "city"].includes(map.type));
  assert.equal(outdoors.length, 67);
  const missing = outdoors.filter((map) => !reachable.has(map.id)).map((map) => map.id);
  assert.deepEqual(missing, []);
});

test("only maps entered through game systems are unreachable in the graph", () => {
  // Secret bases, Pyramid and Pike floors, and the contest hall are entered through code, not map data.
  // High tide rooms swap in by time of day. The truck is the opening scene, before Littleroot.
  const expected = /^(secret_base_|battle_pyramid_square|battle_frontier_battle_pike_room_|shoal_cave_high_tide_|contest_hall$|inside_of_truck$)/;
  const reachable = reachableFrom(world.start);
  const surprises = world.maps.filter((map) => !reachable.has(map.id) && !expected.test(map.id)).map((map) => map.id);
  assert.deepEqual(surprises, []);
});

test("every gym, the Elite Four and the Champion's rooms can be reached", () => {
  const reachable = reachableFrom(world.start);
  const leagueTrainers = [
    "roxanne_1", "brawly_1", "wattson_1", "flannery_1", "norman_1", "winona_1", "tate_and_liza_1", "juan_1",
    "sidney", "phoebe", "glacia", "drake", "wallace",
  ];
  for (const id of leagueTrainers) {
    const place = places.find((candidate) => candidate.trainers.includes(id));
    assert.ok(place, `${id} is not placed on any map`);
    assert.ok(reachable.has(place.id), `${id}'s map ${place.id} is unreachable`);
  }
});

test("places reference real trainers, items and species", () => {
  for (const place of places) {
    assert.ok(mapIds.has(place.id), place.id);
    for (const id of place.trainers) assert.ok(trainerById.has(id), `${place.id}: ${id}`);
    for (const id of [...place.pickups, ...place.hidden, ...place.gifts, ...place.prizes, ...place.marts.flat()]) {
      assert.ok(itemIds.has(id), `${place.id}: ${id}`);
    }
    for (const [id] of [...place.giftMons, ...place.staticMons]) assert.ok(speciesIds.has(id), `${place.id}: ${id}`);
    for (const id of place.eggs) assert.ok(speciesIds.has(id), `${place.id}: ${id}`);
  }
});

test("known item locations are right", () => {
  const where = (id: string): string[] => items.find((item) => item.id === id)!.where.map((s) => `${s.map}:${s.how}`);
  assert.ok(where("hm_cut").includes("rustboro_city_cutters_house:gift"), where("hm_cut").join());
  assert.ok(where("tm_flamethrower").includes("mauville_city_game_corner:prize"), where("tm_flamethrower").join());
  assert.ok(where("tm_bullet_seed").includes("route104:gift"), where("tm_bullet_seed").join());
  assert.ok(where("potion").includes("route102:pickup"), where("potion").join());
  assert.ok(where("potion").includes("oldale_town_mart:mart"), where("potion").join());
});

test("legendaries and gift Pokémon are placed", () => {
  const staticAt = (map: string): string[] => places.find((place) => place.id === map)!.staticMons.map(([id]) => id);
  assert.ok(staticAt("sky_pillar_top").includes("rayquaza"));
  assert.ok(staticAt("desert_ruins").includes("regirock"));
  const gifts = places.find((place) => place.id === "mossdeep_city_stevens_house")!.giftMons;
  assert.deepEqual(gifts[0], ["beldum", 5]);
  assert.ok(places.find((place) => place.id === "lavaridge_town")!.eggs.includes("wynaut"));
});

test("committed data is exactly what the pinned decomp produces", { skip: !existsSync(DECOMP_DIR) }, () => {
  for (const [name, value] of Object.entries(buildEmerald(DECOMP_DIR))) {
    assert.equal(JSON.stringify(value), readFileSync(join(OUTPUT_DIR, name), "utf8"), `${name} is stale. Run: pnpm data:build`);
  }
});

test("no game prose leaks into the output", () => {
  const scan = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      assert.ok(value.length <= 48, `Long string at ${path}: ${value}`);
      assert.ok(!/[a-z]+ [a-z]+ [a-z]+/.test(value), `Prose at ${path}: ${value}`);
    } else if (Array.isArray(value)) {
      value.forEach((entry, i) => scan(entry, `${path}[${i}]`));
    } else if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        assert.ok(key !== "description", `Description field at ${path}`);
        scan(entry, `${path}.${key}`);
      }
    }
  };
  for (const name of Object.keys(GZIP_BUDGETS)) scan(load<unknown>(name), name);
});
