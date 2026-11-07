import { designated, field, gameText, intField, requireField, slug, stripComments } from "../lib/c.ts";
import type { Read } from "./pokemon.ts";

export type ItemSource = { map: string; how: "pickup" | "hidden" | "gift" | "prize" | "mart" };

export type Item = {
  id: string;
  name: string;
  price: number;
  pocket: string;
  hold?: string;
  /** For TMs and HMs: the move they teach. */
  teaches?: string;
  where: ItemSource[];
};

/** Item table without sources. Descriptions are the game's own text, so they stay out. */
export function extractItems(read: Read): Item[] {
  const result: Item[] = [];
  for (const [constant, body] of designated(stripComments(read("src/data/items.h")), "ITEM_")) {
    if (constant === "ITEM_NONE") continue;
    const name = gameText(requireField(body, "name"));
    if (name.startsWith("????")) continue;
    const item: Item = {
      id: slug(constant, "ITEM_"),
      name,
      price: intField(body, "price"),
      pocket: slug(requireField(body, "pocket"), "POCKET_"),
      where: [],
    };
    const hold = field(body, "holdEffect");
    if (hold && hold !== "HOLD_EFFECT_NONE" && hold !== "0") item.hold = slug(hold, "HOLD_EFFECT_");
    // The pocket check keeps the TM Case, a key item, from counting as a machine.
    const machine = item.pocket === "tm_hm" ? /^ITEM_[TH]M_(\w+)$/.exec(constant) : null;
    if (machine) item.teaches = machine[1]!.toLowerCase();
    result.push(item);
  }
  return result;
}
