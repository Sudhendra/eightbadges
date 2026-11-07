import assert from "node:assert/strict";
import { test } from "node:test";
import { loadGameData, STARTERS } from "../lib/data.ts";
import { picksFor, weighFork } from "../lib/foresight.ts";
import { buildProgress } from "../lib/progress.ts";

const data = loadGameData();
const progress = buildProgress(data);
const indexOf = (id: string) => data.journey.findIndex((stop) => stop.id === id);
const sectionIds = new Set(data.world.sections.map((section) => section.id));

test("every area a stop opens is a real region map section, opened only once", () => {
  const seen = new Set<string>();
  for (const stop of data.journey) {
    for (const area of stop.opens.areas) {
      assert.ok(sectionIds.has(area), `${stop.id} opens unknown area ${area}`);
      assert.ok(!seen.has(area), `${area} opens twice`);
      seen.add(area);
    }
    assert.ok(sectionIds.has(stop.section), `${stop.id} has unknown section ${stop.section}`);
  }
});

test("only post-game areas are missing from the road", () => {
  const never = [...new Set(progress.sightings.filter((sighting) => sighting.from === null).map((sighting) => sighting.section))];
  assert.deepEqual(never.sort(), ["altering_cave", "artisan_cave", "desert_underpass"]);
});

test("tools open where the game hands them out", () => {
  assert.equal(progress.toolFrom.get("old_rod"), indexOf("brawly"), "Old Rod, Dewford");
  assert.equal(progress.toolFrom.get("surf"), indexOf("shelly-institute"), "Surf, after Norman");
  assert.equal(progress.toolFrom.get("super_rod"), indexOf("tate-and-liza"), "Super Rod, Mossdeep");
});

test("nothing can be caught before you have Poké Balls", () => {
  for (const starter of STARTERS) assert.deepEqual(picksFor(data, progress, starter, 0), []);
});

test("Foresight never suggests something you can't reach yet", () => {
  for (const starter of STARTERS) {
    data.journey.forEach((_, index) => {
      for (const pick of picksFor(data, progress, starter, index)) {
        if ("gift" in pick.where) continue;
        assert.ok(pick.where.from !== null && pick.where.from <= index, `${starter} ${index}: ${pick.species}`);
      }
    });
  }
});

test("Foresight never suggests your own starter's line", () => {
  for (const pick of data.journey.flatMap((_, index) => picksFor(data, progress, "mudkip", index))) {
    assert.ok(!["mudkip", "marshtomp", "swampert"].includes(pick.species), pick.species);
  }
});

test("Foresight gives the picks players know work", () => {
  const species = (starter: (typeof STARTERS)[number], stop: string) =>
    picksFor(data, progress, starter, indexOf(stop)).map((pick) => pick.species);
  assert.ok(species("torchic", "roxanne").includes("lotad"), "Lotad for Torchic against Roxanne");
  assert.ok(species("treecko", "brawly").includes("sableye"), "Sableye ignores Brawly's Fighting moves");
  assert.ok(species("treecko", "flannery").some((id) => ["marill", "wailmer", "tentacool"].includes(id)), "Water for Treecko against Flannery");
});

test("Slaking's Truant keeps it from topping every list", () => {
  const tops = data.journey.map((_, index) => picksFor(data, progress, "mudkip", index, 1)[0]?.stage);
  assert.ok(!tops.includes("slaking"));
});

test("the fossil choice is weighed against the fights left", () => {
  const fork = data.forks[0]!;
  assert.equal(fork.after, "norman");
  const options = weighFork(data, fork, "torchic");
  assert.deepEqual(options.map((option) => option.species), ["lileep", "anorith"]);
  assert.ok(options.every((option) => option.total === data.journey.length - indexOf("norman") - 1));
});
