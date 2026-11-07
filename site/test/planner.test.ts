import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import * as engine from "../../shared/engine.ts";
import { loadGameData, STARTERS, trainerFor } from "../lib/data.ts";
import { lookupFor, stopLevel, teamAgainst } from "../lib/matchups.ts";
import { catchableFrom } from "../lib/planner.ts";
import { buildProgress } from "../lib/progress.ts";
import { renderAll } from "../render.ts";

const data = loadGameData();
const progress = buildProgress(data);
const site = renderAll({ dev: false });
const planner = JSON.parse(site.files["planner/data.json"]!);

const familyRoot = (species: string): string => {
  for (const mon of data.species.values()) {
    if (mon.evolutions.some((evolution) => evolution.to === species)) return familyRoot(mon.id);
  }
  return species;
};

const toughCount = (starter: (typeof STARTERS)[number], extra: string[]) =>
  data.journey.filter((stop, index) => {
    const trainer = trainerFor(data, stop, starter);
    const members = [starter, ...extra.filter((species) => planner.catchable[species] <= index)].map((species) => ({ species }));
    return teamAgainst(data, members, stopLevel(trainer), trainer).verdict === "tough";
  }).length;

test("the browser's engine.js gives exactly the same answers as the TypeScript engine", async () => {
  const browser = await import(`data:text/javascript,${encodeURIComponent(site.files["planner/engine.js"]!)}`);
  const lookup = lookupFor(data);
  for (const stop of data.journey) {
    const trainer = trainerFor(data, stop, "mudkip");
    const members = [{ species: "mudkip", extraMoves: ["ice_beam"] }, { species: "lotad" }, { species: "sableye" }];
    assert.deepEqual(
      browser.teamMatchup(lookup, members, stopLevel(trainer), trainer.party),
      engine.teamMatchup(lookup, members, stopLevel(trainer), trainer.party),
      stop.id,
    );
  }
});

test("a team is rated on its weakest link", () => {
  const lookup = lookupFor(data);
  const roxanne = data.trainers.get("roxanne_1")!;
  const torchicAlone = engine.teamMatchup(lookup, [{ species: "torchic" }], 15, roxanne.party);
  const withLotad = engine.teamMatchup(lookup, [{ species: "torchic" }, { species: "lotad" }], 15, roxanne.party);
  assert.equal(torchicAlone.verdict, "tough");
  assert.equal(withLotad.verdict, "easy", "Lotad's Water moves answer every Rock type");
  assert.equal(withLotad.members[withLotad.lead]!.stage, "lombre");
});

test("TM moves count, and take priority over level-up moves, four moves at most", () => {
  const lookup = lookupFor(data);
  const stage = engine.stageAtLevel(lookup, "mudkip", 50);
  const moves = engine.movesAt(lookup, stage, 50, ["ice_beam", "earthquake"]);
  assert.equal(moves.length, 4);
  assert.deepEqual(moves.slice(0, 2), ["ice_beam", "earthquake"]);
});

test("every Foresight team is five catchable Pokémon from different families, none from the starter's line", () => {
  for (const starter of STARTERS) {
    const team: string[] = planner.presets[starter];
    assert.equal(team.length, 5, starter);
    const families = new Set(team.map(familyRoot));
    assert.equal(families.size, 5, `${starter}: duplicate family`);
    assert.ok(!families.has(familyRoot(starter)), `${starter}: own line`);
    for (const species of team) assert.ok(species in planner.catchable, `${starter}: ${species} is not catchable`);
  }
});

test("every Foresight team leaves far fewer tough fights than the starter alone", () => {
  for (const starter of STARTERS) {
    const alone = toughCount(starter, []);
    const team = toughCount(starter, planner.presets[starter]);
    assert.ok(team <= alone / 3, `${starter}: ${team} tough with team vs ${alone} alone`);
  }
});

test("planner data is consistent with the rest of the site", () => {
  const from = catchableFrom(data, progress);
  assert.deepEqual(Object.keys(planner.catchable).sort(), [...from.keys()].sort());
  assert.equal(planner.stops.length, data.journey.length);
  assert.equal(planner.machines.length, 58);
  for (const machine of planner.machines) {
    assert.ok(machine.move in planner.moves, machine.id);
    assert.ok(machine.from >= 0 && machine.from <= data.journey.length, machine.id);
  }
  assert.equal(planner.machines.find((machine: { id: string }) => machine.id === "tm_flamethrower").from, 5, "Game Corner, before Wally");
  for (const stop of planner.stops) {
    const parties = Array.isArray(stop.party) ? [stop.party] : Object.values(stop.party);
    for (const party of parties as { species: string; moves: string[] }[][]) {
      for (const mon of party) {
        assert.ok(mon.species in planner.species, `${stop.id}: ${mon.species}`);
        for (const move of mon.moves) assert.ok(move in planner.moves, `${stop.id}: ${move}`);
      }
    }
  }
});

test("the planner stays small: data under 48 KB and code under 8 KB, gzipped", () => {
  const size = (path: string) => gzipSync(site.files[path]!, { level: 9 }).length;
  assert.ok(size("planner/data.json") <= 48_000, `data.json is ${size("planner/data.json")} B gzipped`);
  const code = size("planner/app.js") + size("planner/engine.js");
  assert.ok(code <= 8_000, `planner code is ${code} B gzipped`);
});
