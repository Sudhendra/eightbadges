import type { Evolution } from "../../pipeline/extract/pokemon.ts";
import { html, type Markup } from "../lib/html.ts";
import { METHOD_LABEL } from "../lib/progress.ts";
import type { Kit } from "./kit.ts";

const STAT_NAMES = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPEED"];

export function evolutionText(kit: Kit, evolution: Evolution): string {
  const { method, param } = evolution;
  if (method === "level") return `Lv ${param}`;
  if (method === "item") return kit.itemName(String(param));
  if (method === "friendship") return "High friendship";
  if (method === "friendship_day") return "High friendship, by day";
  if (method === "friendship_night") return "High friendship, at night";
  if (method === "trade") return "Trade";
  if (method === "trade_item") return `Trade holding ${kit.itemName(String(param))}`;
  if (method === "beauty") return "High Beauty";
  if (method.startsWith("level_")) return `Lv ${param}, special`;
  return kit.titleCase(method.replace(/_/g, " "));
}

/** The species' whole family, from its earliest form. */
function family(kit: Kit, species: string): string[][] {
  const { data } = kit;
  const parents = new Map<string, string>();
  for (const mon of data.species.values()) for (const evolution of mon.evolutions) parents.set(evolution.to, mon.id);
  let root = species;
  while (parents.has(root)) root = parents.get(root)!;
  const rows: string[][] = [[root]];
  for (let row = rows[0]!; row.length; ) {
    const next = row.flatMap((id) => data.species.get(id)!.evolutions.map((evolution) => evolution.to));
    if (next.length) rows.push([...new Set(next)]);
    row = next;
  }
  return rows;
}

export function renderPokemon(kit: Kit, species: string): string {
  const { data, progress, page, sprite, bar, placeLink, speciesLink, moveName, beforeStop } = kit;
  const mon = data.species.get(species)!;
  const learnset = data.learnsets[species]!;
  const machines = data.items.filter((item) => item.teaches);
  const machineFor = new Map(machines.map((item) => [item.teaches!, item]));

  const sightings = progress.sightings
    .filter((sighting) => sighting.species === species)
    .sort((a, b) => (a.from ?? 99) - (b.from ?? 99) || b.chance - a.chance);
  // One row per place and method, with the combined chance.
  const rows = new Map<string, { section: string; method: keyof typeof METHOD_LABEL; min: number; max: number; chance: number; from: number | null }>();
  for (const sighting of sightings) {
    const key = `${sighting.section}:${sighting.method}`;
    const row = rows.get(key);
    if (row) {
      row.chance = Math.max(row.chance, sighting.chance);
      row.min = Math.min(row.min, sighting.min);
      row.max = Math.max(row.max, sighting.max);
    } else rows.set(key, { ...sighting });
  }

  const gifts: Markup[] = [];
  for (const place of data.places.values()) {
    const section = kit.mapSection.get(place.id)!;
    for (const [id, level] of place.giftMons) if (id === species) gifts.push(html`<li>Gift at ${placeLink(section)}, Lv ${level}</li>`);
    for (const [id, level] of place.staticMons) if (id === species) gifts.push(html`<li>One-time encounter at ${placeLink(section)}, Lv ${level}</li>`);
    for (const id of place.eggs) if (id === species) gifts.push(html`<li>Egg from ${placeLink(section)}</li>`);
  }
  for (const fork of data.forks) {
    for (const option of fork.options) {
      if (option.species === species) gifts.push(html`<li>${option.label} from ${placeLink(fork.section)}, revived at Lv ${option.level}. A one-time choice: the other fossil is lost.</li>`);
    }
  }

  const tree = family(kit, species);
  const total = mon.stats.reduce((sum, stat) => sum + stat, 0);

  return page(
    {
      path: `/pokemon/${species}/`,
      title: `${mon.name}: where to find it in Pokémon Emerald | Eight Badges`,
      description: `Where to catch ${mon.name} in Pokémon Emerald, when you can reach it, its abilities, stats, evolutions and moves.`,
      bodyClass: "dex",
    },
    html`${bar("POKÉMON")}
    <main>
      <header class="mon-hero">
        ${sprite(species, { size: 128, eager: true })}
        <div>
          <p class="meta">#${String(mon.dex).padStart(3, "0")}${mon.hoenn ? ` · HOENN #${String(mon.hoenn).padStart(3, "0")}` : ""}</p>
          <h1>${mon.name}</h1>
          <p class="types">${mon.types.map((type) => html`<span class="type t-${type}">${type.toUpperCase()}</span>`)}</p>
          <p>ABILITY: ${mon.abilities.map((ability, i) => html`${i ? " or " : ""}<a href="/abilities/#${ability}">${data.abilities[ability]}</a>`)}</p>
        </div>
      </header>

      <section class="panel">
        <h2>WHERE TO FIND IT</h2>
        ${rows.size || gifts.length
          ? html`<ul class="finds">${[...rows.values()].map((row) =>
              html`<li><span>${placeLink(row.section)}</span><span>${METHOD_LABEL[row.method]} · Lv ${row.min === row.max ? row.min : `${row.min}–${row.max}`} · up to ${row.chance}%</span><span class="when">${row.from === null ? "After the Champion" : `Open ${beforeStop(row.from)}`}</span></li>`,
            )}${gifts}</ul>`
          : html`<p>Not found in the wild in Emerald. Evolve it, or trade for it.</p>`}
      </section>

      ${tree.length > 1 ? html`<section class="panel">
        <h2>EVOLUTION</h2>
        <ol class="family">${tree.map((row, depth) =>
          html`<li>${row.map((id) => {
            const evolution = depth > 0
              ? tree[depth - 1]!.flatMap((parent) => data.species.get(parent)!.evolutions).find((evo) => evo.to === id)
              : undefined;
            return html`<span class="${id === species ? "here" : ""}">${evolution ? html`<small>${evolutionText(kit, evolution)}</small>` : ""}<a href="/pokemon/${id}/">${sprite(id)}</a>${speciesLink(id)}</span>`;
          })}</li>`,
        )}</ol>
      </section>` : ""}

      <section class="panel">
        <h2>BASE STATS · ${total}</h2>
        <ul class="stats">${mon.stats.map((stat, i) =>
          html`<li><span>${STAT_NAMES[i]}</span><b>${stat}</b><i style="--v:${Math.min(stat, 180) / 180}"></i></li>`,
        )}</ul>
      </section>

      <section class="panel">
        <h2>LEVEL-UP MOVES</h2>
        <ul class="moves">${learnset.level.map(([level, move]) =>
          html`<li><span>Lv ${level}</span><b>${moveName(move)}</b><span>${data.moves.get(move)!.type.toUpperCase()}</span></li>`,
        )}</ul>
      </section>

      ${learnset.tm.length ? html`<section class="panel">
        <h2>TMS &amp; HMS</h2>
        <p class="chips">${learnset.tm.map((move) => {
          const item = machineFor.get(move)!;
          return html`<a href="/tms/#${item.id}">${item.name} ${moveName(move)}</a>`;
        })}</p>
      </section>` : ""}

      <p class="method">"Open before" follows the story order on the starter roads, and leans late when unsure.</p>
    </main>`,
  );
}

export function renderPokemonIndex(kit: Kit): string {
  const { data, page, sprite, bar } = kit;
  const all = [...data.species.values()];
  const hoenn = all.filter((mon) => mon.hoenn !== null).sort((a, b) => a.hoenn! - b.hoenn!);
  const others = all.filter((mon) => mon.hoenn === null);
  const grid = (list: typeof all): Markup =>
    html`<ul class="dexgrid">${list.map((mon) => html`<li><a href="/pokemon/${mon.id}/">${sprite(mon.id)}<span>${mon.name}</span></a></li>`)}</ul>`;
  return page(
    {
      path: "/pokemon/",
      title: "Every Pokémon in Emerald, and where to find them | Eight Badges",
      description: "All 386 Pokémon in Pokémon Emerald: where to catch each one, when you can reach it, and how it evolves.",
      bodyClass: "dex",
    },
    html`${bar("POKÉMON")}
    <main>
      <h1 class="page-title">POKÉMON</h1>
      <h2 class="group">HOENN · ${hoenn.length}</h2>
      ${grid(hoenn)}
      <h2 class="group">FROM OTHER REGIONS · ${others.length}</h2>
      ${grid(others)}
    </main>`,
  );
}
