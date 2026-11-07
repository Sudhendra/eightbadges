import type { Item, ItemSource } from "../../pipeline/extract/items.ts";
import { html, type Markup } from "../lib/html.ts";
import type { Kit } from "./kit.ts";

const HOW_LABEL: Record<ItemSource["how"], string> = {
  pickup: "On the ground",
  hidden: "Hidden",
  gift: "Gift",
  prize: "Prize or exchange",
  mart: "Shop",
};

/** HMs need a badge to use outside battle. The road's gym stops record which. */
function badgeFor(kit: Kit, move: string): string | undefined {
  return kit.data.journey.find((stop) => stop.unlocks === move)?.badge;
}

/** Where an item is found, earliest first, with when each place opens. */
export function itemSources(kit: Kit, item: Item): Markup {
  const { progress, mapPlace, beforeStop } = kit;
  const sources = item.where
    .map((source) => ({ ...source, place: mapPlace(source.map), from: progress.mapFrom(source.map) }))
    .sort((a, b) => (a.from ?? 99) - (b.from ?? 99));
  const seen = new Set<string>();
  return html`<ul class="sources">${sources
    .filter((source) => {
      const key = `${source.place.key}:${source.how}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((source) => html`<li>${source.place.markup} · ${HOW_LABEL[source.how]}<span class="when">${source.from === null ? "After the Champion" : `Open ${beforeStop(source.from)}`}</span></li>`)}</ul>`;
}

export function renderMachines(kit: Kit): string {
  const { data, page, bar, moveName } = kit;
  const machines = data.items.filter((item) => item.teaches);
  const row = (item: Item): Markup => {
    const move = data.moves.get(item.teaches!)!;
    const badge = item.name.startsWith("HM") ? badgeFor(kit, move.id) : undefined;
    const learners = [...data.species.values()].filter((mon) => data.learnsets[mon.id]!.tm.includes(move.id)).length;
    return html`<li class="machine" id="${item.id}">
      <p class="meta"><span>${item.name}</span><span class="type t-${move.type}">${move.type.toUpperCase()}</span></p>
      <h2 class="who">${moveName(move.id)}</h2>
      <p class="facts">${move.category === "status" ? "STATUS" : `${move.category.toUpperCase()} · POWER ${move.power}`} · ${move.accuracy === null ? "NEVER MISSES" : `ACC ${move.accuracy}`} · PP ${move.pp} · ${learners} can learn it${badge ? ` · Needs the ${badge} outside battle` : ""}</p>
      ${item.where.length ? itemSources(kit, item) : html`<p>No known location.</p>`}
    </li>`;
  };
  return page(
    {
      path: "/tms/",
      title: "Every TM and HM in Pokémon Emerald, and where to find it | Eight Badges",
      description: "Where to find all 50 TMs and 8 HMs in Pokémon Emerald, when you can reach each one, and what they teach.",
      bodyClass: "ref",
    },
    html`${bar("TMS & HMS")}
    <main>
      <h1 class="page-title">TMS &amp; HMS</h1>
      <p class="intro">In Emerald, every TM breaks after one use. Choose who gets it carefully. HMs can be used again and again.</p>
      <nav class="jump">${machines.map((item) => html`<a href="#${item.id}">${item.name.replace(/^(TM|HM)0?/, "$1")}</a>`)}</nav>
      <ol class="machines">${machines.map(row)}</ol>
    </main>`,
  );
}

export function renderAbilities(kit: Kit): string {
  const { data, progress, page, bar, speciesLink, beforeStop } = kit;
  const earliest = new Map<string, number>();
  for (const sighting of progress.sightings) {
    if (sighting.from === null) continue;
    const known = earliest.get(sighting.species);
    if (known === undefined || sighting.from < known) earliest.set(sighting.species, sighting.from);
  }
  const ids = Object.keys(data.abilities).sort((a, b) => data.abilities[a]!.localeCompare(data.abilities[b]!));
  return page(
    {
      path: "/abilities/",
      title: "Every ability in Pokémon Emerald, and who has it | Eight Badges",
      description: "Every ability in Pokémon Emerald, which Pokémon can have it, and the earliest one you can catch.",
      bodyClass: "ref",
    },
    html`${bar("ABILITIES")}
    <main>
      <h1 class="page-title">ABILITIES</h1>
      <p class="intro">Who can have each ability, and the first one you can catch on the road.</p>
      <ol class="machines">${ids.map((id) => {
        const holders = [...data.species.values()].filter((mon) => mon.abilities.includes(id));
        if (!holders.length) return "";
        const first = holders
          .filter((mon) => earliest.has(mon.id))
          .sort((a, b) => earliest.get(a.id)! - earliest.get(b.id)!)[0];
        return html`<li class="machine" id="${id}">
          <h2 class="who">${data.abilities[id]}</h2>
          ${first ? html`<p class="reward">Catch first: ${speciesLink(first.id)}, ${beforeStop(earliest.get(first.id))}</p>` : html`<p class="facts">Not catchable in the wild during the story.</p>`}
          <p class="chips">${holders.map((mon) => speciesLink(mon.id))}</p>
        </li>`;
      })}</ol>
    </main>`,
  );
}
