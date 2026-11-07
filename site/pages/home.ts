import { STARTERS } from "../lib/data.ts";
import { html } from "../lib/html.ts";
import { evaluateRoad } from "../lib/matchups.ts";
import type { Kit } from "./kit.ts";
import { strip, tally } from "./road.ts";

export function renderHome(kit: Kit): string {
  const { data, page, sprite, gems, nav } = kit;
  return page(
    {
      path: "/",
      title: "Eight Badges: the best route through Pokémon Emerald",
      description: "Pick your starter and see your whole road to Champion: every gym, rival and boss, what to catch next, and how you match up.",
      bodyClass: "home",
    },
    html`<main>
      <header class="title">
        <h1>EIGHT<br>BADGES</h1>
        ${gems("shine")}
        <p>Pick a starter. See your whole road to Champion.</p>
      </header>
      <nav class="starters" aria-label="Choose your starter">
        ${STARTERS.map((starter) => {
          const road = evaluateRoad(data, starter);
          return html`<a class="starter" data-nav data-pick="${starter}" data-starter="${starter}" href="/${starter}/">
            <span class="pick">${sprite(starter, { size: 128, eager: true, hero: `hero-${starter}` })}</span>
            <span class="name">${data.species.get(starter)!.name}</span>
            ${strip(road, false)}
            <span class="tally">${tally(road)}</span>
          </a>`;
        })}
      </nav>
      <p class="hint">ARROWS to choose. ENTER to go.</p>
      ${nav()}
    </main>`,
  );
}
