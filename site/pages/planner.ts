import { html } from "../lib/html.ts";
import type { Kit } from "./kit.ts";

export function renderPlanner(kit: Kit): string {
  const { page, bar } = kit;
  return page(
    {
      path: "/planner/",
      title: "Team planner for Pokémon Emerald | Eight Badges",
      description: "Build your Pokémon Emerald team, hand out your TMs, and see every fight on the road rated for the team you'll actually have.",
      bodyClass: "planner",
      starter: "treecko",
    },
    html`${bar("PLANNER")}
    <main>
      <h1 class="page-title">TEAM PLANNER</h1>
      <p class="intro">Pick your team and hand out your TMs. Every fight on the road re-rates for the team you'll actually have by then. Your team lives in the link, so you can share it.</p>
      <div id="planner" data-src="/planner/data.json"><p class="assume">Loading the planner…</p></div>
      <noscript><p>The planner needs JavaScript. Everything else on the site works without it.</p></noscript>
      <script type="module" src="/planner/app.js"></script>
    </main>`,
  );
}
