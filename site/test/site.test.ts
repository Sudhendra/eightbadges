import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { loadGameData, STARTERS, trainerFor } from "../lib/data.ts";
import { evaluateRoad, evaluateStop, stageAtLevel, typeMultiplier } from "../lib/matchups.ts";
import { renderAll } from "../render.ts";

const data = loadGameData();
const site = renderAll({ dev: false });

/** 14 KB is about what arrives in the first network round trip, so the first screen shows up immediately. */
const FIRST_SCREEN_GZIP_BUDGET = 14_000;
const PAGE_GZIP_BUDGET = 16_000;

const stopNamed = (id: string) => data.journey.find((stop) => stop.id === id)!;

test("every journey stop has a real trainer for every starter", () => {
  for (const stop of data.journey) {
    for (const starter of STARTERS) assert.ok(trainerFor(data, stop, starter).party.length > 0, stop.id);
  }
});

test("journey stop ids are unique", () => {
  assert.equal(new Set(data.journey.map((stop) => stop.id)).size, data.journey.length);
});

test("the eight gyms are in badge order and unlock the right field moves", () => {
  const gyms = data.journey.filter((stop) => stop.kind === "gym");
  assert.deepEqual(
    gyms.map((gym) => [gym.badge, gym.unlocks]),
    [
      ["STONE BADGE", "cut"],
      ["KNUCKLE BADGE", "flash"],
      ["DYNAMO BADGE", "rock_smash"],
      ["HEAT BADGE", "strength"],
      ["BALANCE BADGE", "surf"],
      ["FEATHER BADGE", "fly"],
      ["MIND BADGE", "dive"],
      ["RAIN BADGE", "waterfall"],
    ],
  );
  for (const gym of gyms) assert.ok(data.moves.has(gym.unlocks!), gym.id);
});

test("the Elite Four are in room order and the Champion comes last", () => {
  assert.deepEqual(data.journey.slice(-5).map((stop) => stop.id), ["sidney", "phoebe", "glacia", "drake", "wallace"]);
});

test("May and Brendan only differ in the fights the road page warns about", () => {
  const differing: string[] = [];
  const species = (party: { species: string }[]) => party.map((mon) => mon.species).sort().join();
  for (const stop of data.journey.filter((candidate) => candidate.trainer.startsWith("may_"))) {
    for (const starter of STARTERS) {
      const may = trainerFor(data, stop, starter).party;
      const brendan = data.trainers.get(stop.trainer.replace("may_", "brendan_").replace("{starter}", starter))!.party;
      if (species(may) !== species(brendan)) differing.push(`${stop.id}:${starter}`);
    }
  }
  assert.deepEqual(differing, ["rival-rustboro:torchic", "rival-119:mudkip"]);
});

test("type multipliers stack across dual types and respect immunities", () => {
  const species = (id: string) => data.species.get(id)!;
  assert.equal(typeMultiplier(data, "water", species("geodude")), 4);
  assert.equal(typeMultiplier(data, "electric", species("marshtomp")), 0);
  assert.equal(typeMultiplier(data, "normal", species("banette")), 0);
  assert.equal(typeMultiplier(data, "ground", species("solrock")), 0, "Levitate");
});

test("starters evolve at the right levels", () => {
  assert.equal(stageAtLevel(data, "mudkip", 15).id, "mudkip");
  assert.equal(stageAtLevel(data, "mudkip", 16).id, "marshtomp");
  assert.equal(stageAtLevel(data, "torchic", 36).id, "blaziken");
});

test("well-known matchups come out the way players know them", () => {
  const verdict = (stop: string, starter: (typeof STARTERS)[number]) => evaluateStop(data, stopNamed(stop), starter).verdict;
  assert.equal(verdict("roxanne", "mudkip"), "easy");
  assert.equal(verdict("roxanne", "treecko"), "easy");
  assert.equal(verdict("roxanne", "torchic"), "tough");
  assert.equal(verdict("wattson", "mudkip"), "easy");
  assert.equal(verdict("flannery", "treecko"), "tough");
  assert.equal(verdict("flannery", "mudkip"), "easy");
});

test("the rival's first fight runs with moves the starter really knows at that level", () => {
  const fight = evaluateStop(data, stopNamed("rival-103"), "treecko");
  assert.equal(fight.level, 5);
  assert.deepEqual(fight.moves, ["pound", "leer"]);
});

test("every road covers every stop", () => {
  for (const starter of STARTERS) {
    const road = evaluateRoad(data, starter);
    assert.equal(road.length, data.journey.length);
    const page = site.pages[`${starter}/index.html`]!;
    for (const stop of data.journey) assert.ok(page.includes(`id="${stop.id}"`), `${starter}: ${stop.id}`);
  }
});

test("pages fit their size budgets, with all CSS and JS included", () => {
  const size = (path: string) => gzipSync(site.pages[path]!, { level: 9 }).length;
  assert.ok(size("index.html") <= FIRST_SCREEN_GZIP_BUDGET, `Home is ${size("index.html")} B gzipped`);
  for (const path of Object.keys(site.pages)) {
    assert.ok(size(path) <= PAGE_GZIP_BUDGET, `${path} is ${size(path)} B gzipped`);
  }
});

test("every internal link and anchor points at something that exists", () => {
  const ids = new Map<string, Set<string>>();
  for (const [path, page] of Object.entries(site.pages)) {
    const url = "/" + path.replace(/index\.html$/, "");
    ids.set(url, new Set([...page.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]!)));
  }
  const broken: string[] = [];
  for (const [path, page] of Object.entries(site.pages)) {
    const from = "/" + path.replace(/index\.html$/, "");
    for (const match of page.matchAll(/ href="(\/[^"]*|#[^"]+)"/g)) {
      const [target, anchor] = match[1]!.startsWith("#") ? [from, match[1]!.slice(1)] : match[1]!.split("#");
      if (target!.startsWith("/f/") || target!.startsWith("/s/")) continue;
      if (!ids.has(target!)) broken.push(`${from} -> ${match[1]}`);
      else if (anchor && !ids.get(target!)!.has(anchor)) broken.push(`${from} -> ${match[1]} (no anchor)`);
    }
  }
  assert.deepEqual(broken.slice(0, 20), []);
});

test("there is a page for every Pokémon and every place on the map", () => {
  for (const id of data.species.keys()) assert.ok(site.pages[`pokemon/${id}/index.html`], id);
  for (const stop of data.journey) assert.ok(site.pages[`places/${stop.section}/index.html`], stop.section);
});

test("pages load nothing from other sites, and images reserve their space", () => {
  for (const [path, page] of Object.entries(site.pages)) {
    assert.doesNotMatch(page, /(?:src|href)="https?:\/\/(?!github\.com\/Sudhendra\/eightbadges|eightbadges\.com)/, path);
    for (const image of page.matchAll(/<img [^>]*>/g)) {
      assert.match(image[0], /width="\d+" height="\d+"/, path);
      assert.match(image[0], /alt="[^"]+"/, path);
    }
  }
});

test("production pages don't contain dev tools", () => {
  for (const page of Object.values(site.pages)) assert.ok(!page.includes("devfont"));
});
