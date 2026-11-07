import type { Section } from "../../pipeline/extract/world.ts";
import { html, type Markup, raw } from "../lib/html.ts";
import { METHOD_LABEL, type Method } from "../lib/progress.ts";
import type { Kit } from "./kit.ts";
import { itemSources } from "./reference.ts";

type Kind = "town" | "route" | "sea" | "dungeon";

/** What a region map section mostly is, from the types of the maps inside it. */
function kindOf(kit: Kit, section: string): Kind {
  const types = kit.data.world.maps.filter((map) => map.section === section).map((map) => map.type);
  if (types.includes("city") || types.includes("town")) return "town";
  if (types.includes("route")) return "route";
  if (types.includes("ocean_route")) return "sea";
  return "dungeon";
}

const GRID = { columns: 28, rows: 15 };

/** The region map, drawn from section coordinates. `focus` highlights one place. */
function regionMap(kit: Kit, options: { focus?: string; linked: boolean }): Markup {
  const { data, progress, sectionName } = kit;
  const order: Record<Kind, number> = { sea: 0, route: 1, town: 2, dungeon: 3 };
  const sections = [...data.world.sections]
    .filter((section) => !section.id.startsWith("underwater_"))
    .sort((a, b) => order[kindOf(kit, a.id)] - order[kindOf(kit, b.id)]);
  const cell = (section: Section): Markup => {
    const kind = kindOf(kit, section.id);
    const from = progress.sectionFrom.get(section.id);
    const style = kind === "dungeon"
      ? `grid-area:${section.y + 1}/${section.x + 1}/span 1/span 1`
      : `grid-area:${section.y + 1}/${section.x + 1}/span ${section.h}/span ${section.w}`;
    const classes = `area ${kind} u${from ?? "x"}${section.id === options.focus ? " focus" : ""}`;
    return options.linked
      ? html`<a class="${classes}" style="${style}" href="/places/${section.id}/" title="${sectionName(section.id)}"><span class="vh">${sectionName(section.id)}</span></a>`
      : html`<i class="${classes}" style="${style}"></i>`;
  };
  return html`<div class="region" style="--cols:${GRID.columns};--rows:${GRID.rows}">${sections.map(cell)}</div>`;
}

/** CSS that dims every area not yet open at each checkpoint. Generated, so the map needs no JavaScript. */
function checkpointCss(checkpoints: number[]): string {
  return checkpoints
    .map((index) => {
      const open = Array.from({ length: index + 1 }, (_, i) => `.u${i}`).join(",");
      return `.mapview:has(#at${index}:checked) .area:not(${open}){opacity:.16}`;
    })
    .join("");
}

export function renderMap(kit: Kit): string {
  const { data, page, bar, sectionName } = kit;
  const checkpoints = data.journey
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => stop.kind === "gym" || stop.kind === "champion");
  const groups: Record<Kind, string[]> = { town: [], route: [], sea: [], dungeon: [] };
  for (const section of data.world.sections) {
    if (!section.id.startsWith("underwater_")) groups[kindOf(kit, section.id)].push(section.id);
  }
  const list = (title: string, ids: string[]): Markup =>
    html`<h2 class="group">${title}</h2><p class="chips">${ids
      .sort((a, b) => sectionName(a).localeCompare(sectionName(b), "en", { numeric: true }))
      .map((id) => html`<a href="/places/${id}/">${sectionName(id)}</a>`)}</p>`;

  return page(
    {
      path: "/map/",
      title: "Hoenn map: what's where in Pokémon Emerald | Eight Badges",
      description: "A map of Hoenn in Pokémon Emerald. See which areas are open before each gym, and what's in every place.",
      bodyClass: "mappage",
      css: checkpointCss(checkpoints.map(({ index }) => index)),
    },
    html`${bar("MAP")}
    <main class="mapview">
      <h1 class="page-title">HOENN</h1>
      <fieldset class="checkpoints">
        <legend>WHERE CAN I GO BEFORE…</legend>
        ${checkpoints.map(({ stop, index }, i) =>
          html`<label><input type="radio" name="at" id="at${index}" ${i === checkpoints.length - 1 ? raw("checked") : raw("")}><span>${stop.kind === "champion" ? "THE END" : stop.title}</span></label>`,
        )}
      </fieldset>
      ${regionMap(kit, { linked: true })}
      <p class="legend"><i class="area town"></i>TOWN <i class="area route"></i>ROUTE <i class="area sea"></i>SEA <i class="area dungeon"></i>CAVE &amp; MORE</p>
      ${list("TOWNS & CITIES", groups.town)}
      ${list("ROUTES", [...groups.route, ...groups.sea])}
      ${list("CAVES, TOWERS & MORE", groups.dungeon)}
    </main>`,
  );
}

export function renderPlace(kit: Kit, section: string): string {
  const { data, progress, page, bar, sprite, sectionName, speciesLink, itemName, beforeStop } = kit;
  const maps = data.world.maps.filter((map) => map.section === section).map((map) => map.id);
  const places = maps.map((id) => data.places.get(id)!).filter(Boolean);
  const from = progress.sectionFrom.get(section);
  const wild = progress.sightings.filter((sighting) => sighting.section === section);

  const byMethod = new Map<Method, Map<string, { min: number; max: number; chance: number }>>();
  for (const sighting of wild) {
    const table = byMethod.get(sighting.method) ?? new Map();
    const row = table.get(sighting.species);
    if (row) {
      row.chance = Math.max(row.chance, sighting.chance);
      row.min = Math.min(row.min, sighting.min);
      row.max = Math.max(row.max, sighting.max);
    } else table.set(sighting.species, { min: sighting.min, max: sighting.max, chance: sighting.chance });
    byMethod.set(sighting.method, table);
  }

  const fights = data.journey.filter((stop) => stop.section === section);
  const trainerCount = new Set(places.flatMap((place) => place.trainers)).size;
  const items = [...new Set(places.flatMap((place) => [...place.pickups, ...place.hidden, ...place.gifts, ...place.prizes]))];
  const marts = [...new Set(places.flatMap((place) => place.marts.flat()))];
  const mons = places.flatMap((place) => [...place.giftMons, ...place.staticMons]);
  const machineIds = new Set(data.items.filter((item) => item.teaches).map((item) => item.id));

  return page(
    {
      path: `/places/${section}/`,
      title: `${sectionName(section)}: Pokémon, items and trainers in Emerald | Eight Badges`,
      description: `What's in ${sectionName(section)} in Pokémon Emerald: wild Pokémon, items, TMs and trainers, and when you can get there.`,
      bodyClass: "place",
    },
    html`${bar("MAP")}
    <main>
      <header class="place-hero">
        <div>
          <p class="meta">${from === undefined ? "Not on the main road" : `Open ${beforeStop(from)}`}</p>
          <h1>${sectionName(section).toUpperCase()}</h1>
          ${fights.length ? html`<p class="reward">${fights.map((stop, i) => html`${i ? " · " : ""}${stop.title}`)}</p>` : ""}
          <p class="facts">${trainerCount} trainer${trainerCount === 1 ? "" : "s"}</p>
        </div>
        ${regionMap(kit, { focus: section, linked: false })}
      </header>

      ${byMethod.size ? html`<section class="panel">
        <h2>WILD POKÉMON</h2>
        ${[...byMethod].map(([method, table]) => html`<h3 class="sub">${METHOD_LABEL[method]}</h3>
          <ul class="wild">${[...table].sort((a, b) => b[1].chance - a[1].chance).map(([species, row]) =>
            html`<li><a href="/pokemon/${species}/">${sprite(species)}</a>${speciesLink(species)}<span>Lv ${row.min === row.max ? row.min : `${row.min}–${row.max}`}</span><span>${row.chance}%</span></li>`,
          )}</ul>`)}
      </section>` : ""}

      ${mons.length ? html`<section class="panel">
        <h2>SPECIAL POKÉMON</h2>
        <ul class="wild">${mons.map(([species, level]) => html`<li><a href="/pokemon/${species}/">${sprite(species)}</a>${speciesLink(species)}<span>Lv ${level}</span></li>`)}</ul>
      </section>` : ""}

      ${items.length ? html`<section class="panel">
        <h2>ITEMS</h2>
        <p class="chips">${items.map((id) => machineIds.has(id) ? html`<a class="tm" href="/tms/#${id}">${itemName(id)} ${kit.moveName(data.items.find((item) => item.id === id)!.teaches!)}</a>` : html`<span>${itemName(id)}</span>`)}</p>
      </section>` : ""}

      ${marts.length ? html`<section class="panel">
        <h2>SHOP</h2>
        <p class="chips">${marts.map((id) => machineIds.has(id) ? html`<a class="tm" href="/tms/#${id}">${itemName(id)}</a>` : html`<span>${itemName(id)}</span>`)}</p>
      </section>` : ""}
    </main>`,
  );
}

export { itemSources };
