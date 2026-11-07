import assert from "node:assert/strict";
import { test } from "node:test";
import { extractEvolutions } from "../extract/pokemon.ts";
import { initialMoves } from "../extract/trainers.ts";
import { bitFlags, braceGroups, designated, field, gameText, slug, stripComments } from "../lib/c.ts";

test("stripComments removes comments but keeps strings", () => {
  assert.equal(stripComments('a /* b */ c // d\n"e // f"').trim(), 'a  c \n"e // f"');
});

test("designated reads nested values and stops at the entry boundary", () => {
  const source = '[MOVE_A] = { .power = 40, .flags = X | Y, }, [MOVE_B] = _("B, C"), [OTHER_C] = 1,';
  const entries = designated(source, "MOVE_");
  assert.deepEqual([...entries.keys()], ["MOVE_A", "MOVE_B"]);
  assert.equal(entries.get("MOVE_B"), '_("B, C")');
  assert.equal(field(entries.get("MOVE_A")!, "flags"), "X | Y");
});

test("field reads a brace value as one value", () => {
  assert.equal(field(".types = { TYPE_A, TYPE_B }, .x = 1", "types"), "{ TYPE_A, TYPE_B }");
});

test("gameText reads the inside of a game string", () => {
  assert.equal(gameText('_("MR. MIME")'), "MR. MIME");
  assert.throws(() => gameText("sDescription"));
});

test("slug and bitFlags", () => {
  assert.equal(slug("SPECIES_HO_OH", "SPECIES_"), "ho_oh");
  assert.throws(() => slug("MOVE_POUND", "SPECIES_"));
  assert.deepEqual(bitFlags("FLAG_A | FLAG_B", "FLAG_"), ["a", "b"]);
  assert.deepEqual(bitFlags("0", "FLAG_"), []);
});

test("braceGroups returns top-level groups only", () => {
  assert.deepEqual(braceGroups("{ a {b} }, { c }"), [" a {b} ", " c "]);
});

test("extractEvolutions reads level, item and branching evolutions", () => {
  const evolutions = extractEvolutions(`
    [SPECIES_A] = {{EVO_LEVEL, 16, SPECIES_B}},
    [SPECIES_C] = {{EVO_ITEM, ITEM_FIRE_STONE, SPECIES_D},
                   {EVO_LEVEL_SILCOON, 7, SPECIES_E}},
  `);
  assert.deepEqual(evolutions.get("a"), [{ method: "level", param: 16, to: "b" }]);
  assert.deepEqual(evolutions.get("c"), [
    { method: "item", param: "fire_stone", to: "d" },
    { method: "level_silcoon", param: 7, to: "e" },
  ]);
});

test("initialMoves keeps the last four moves learned by that level", () => {
  const learnset: [number, string][] = [[1, "a"], [1, "b"], [5, "c"], [9, "d"], [12, "e"], [20, "f"]];
  assert.deepEqual(initialMoves(1, learnset), ["a", "b"]);
  assert.deepEqual(initialMoves(12, learnset), ["b", "c", "d", "e"]);
});

test("initialMoves skips a move it already knows", () => {
  assert.deepEqual(initialMoves(10, [[1, "a"], [5, "b"], [10, "a"]]), ["a", "b"]);
});
