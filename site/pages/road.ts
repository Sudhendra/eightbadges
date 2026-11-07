import { type Fork, type Starter, STARTERS, trainerFor } from "../lib/data.ts";
import { picksFor, type Pick, weighFork } from "../lib/foresight.ts";
import { html, type Markup, raw } from "../lib/html.ts";
import { evaluateRoad, type Hit, type StopMatchup, type Verdict } from "../lib/matchups.ts";
import { METHOD_LABEL } from "../lib/progress.ts";
import type { Kit } from "./kit.ts";

export const VERDICT_LABEL: Record<Verdict, string> = { easy: "EASY", fair: "FAIR", tough: "TOUGH" };
const KIND_LABEL: Record<StopMatchup["stop"]["kind"], string> = {
  rival: "RIVAL",
  gym: "GYM",
  villain: "BOSS",
  elite: "ELITE FOUR",
  champion: "CHAMPION",
};

function multiplierText(multiplier: number): string {
  if (multiplier === 0.25) return "×¼";
  if (multiplier === 0.5) return "×½";
  return `×${multiplier}`;
}

export const tally = (road: StopMatchup[]): string => {
  const count = (verdict: Verdict) => road.filter((stop) => stop.verdict === verdict).length;
  return `${count("easy")} EASY · ${count("fair")} FAIR · ${count("tough")} TOUGH`;
};

export const strip = (road: StopMatchup[], linked: boolean): Markup =>
  html`<span class="strip" aria-hidden="${linked ? "false" : "true"}">${road.map((stop) =>
    linked
      ? html`<a class="cell ${stop.verdict} ${stop.stop.kind}" href="#${stop.stop.id}" title="${stop.stop.title}, ${stop.stop.place}: ${VERDICT_LABEL[stop.verdict]}"><span class="vh">${stop.stop.title}: ${VERDICT_LABEL[stop.verdict]}</span></a>`
      : html`<i class="cell ${stop.verdict} ${stop.stop.kind}"></i>`,
  )}</span>`;

export function renderRoad(kit: Kit, starter: Starter): string {
  const { data, progress, page, sprite, gems, bar, moveName, placeLink, speciesLink } = kit;
  const entries = evaluateRoad(data, starter);
  const mon = data.species.get(starter)!;

  const hitText = (who: string, hit: Hit | null): Markup =>
    hit
      ? html`<span class="hit ${hit.multiplier > 1 ? "up" : hit.multiplier < 1 ? "down" : ""}">${who}: ${moveName(hit.move)} <b>${multiplierText(hit.multiplier)}</b></span>`
      : html`<span class="hit">${who}: no attacks</span>`;

  const pickReason = (pick: Pick): string => {
    const hits = pick.now.mons.filter((opponent) => (opponent.you?.multiplier ?? 0) >= 2).length;
    const parts: string[] = [];
    if (hits > 0) parts.push(`hits ${hits} of ${pick.now.mons.length} hard`);
    else if (pick.now.verdict !== "tough") parts.push("holds its own here");
    if (pick.laterWins.length > 0) {
      const next = data.journey[pick.laterWins[0]!]!;
      parts.push(`strong vs ${next.title}${pick.laterWins.length > 1 ? ` +${pick.laterWins.length - 1}` : ""}`);
    }
    return parts.join(", ") || "best of what's around";
  };

  const pickCard = (pick: Pick): Markup => {
    const where = "gift" in pick.where
      ? html`<span>Gift</span>`
      : html`<span>${placeLink(pick.where.section)} · ${METHOD_LABEL[pick.where.method]} ${pick.where.chance}%</span>`;
    return html`<li class="pick-card">
      <a class="pick-mon" href="/pokemon/${pick.species}/">${sprite(pick.species)}</a>
      <span class="pick-text">
        <b>${speciesLink(pick.species)}</b>${pick.stage !== pick.species ? html` <span class="evo-to">→ ${data.species.get(pick.stage)!.name}</span>` : ""}
        ${where}
        <span class="why">${pickReason(pick)}</span>
      </span>
    </li>`;
  };

  const forkCard = (fork: Fork): Markup => {
    const options = weighFork(data, fork, starter);
    const best = Math.max(...options.map((option) => option.wins));
    return html`<li class="fork" id="${fork.id}">
      <p class="meta"><span>CHOICE · ${placeLink(fork.section)}</span><span class="verdict">ONE OR THE OTHER</span></p>
      <h3 class="who">${fork.title}</h3>
      <p class="note">${fork.note}</p>
      <ul class="branches">${options.map((option) =>
        html`<li class="branch ${option.wins === best ? "best" : ""}">
          <a href="/pokemon/${option.species}/">${sprite(option.species)}</a>
          <b>${option.label}</b>
          <span>${speciesLink(option.species)}</span>
          <span class="why">Better in ${option.wins} of ${option.total} fights left${option.wins === best ? " · FORESIGHT PICK" : ""}</span>
        </li>`,
      )}</ul>
    </li>`;
  };

  const stopCard = (entry: StopMatchup, index: number): Markup => {
    const { stop } = entry;
    const stage = data.species.get(entry.stage)!;
    const gymIndex = stop.kind === "gym" ? data.journey.filter((s) => s.kind === "gym").indexOf(stop) : -1;
    const picks = picksFor(data, progress, starter, index);
    return html`<li class="stop ${stop.kind} ${entry.verdict}" id="${stop.id}" ${gymIndex >= 0 ? raw(`style="view-timeline-name:--g${gymIndex}"`) : raw("")}>
      <details>
        <summary data-nav>
          <span class="meta"><span>${KIND_LABEL[stop.kind]} · ${stop.place}</span><span class="verdict">${VERDICT_LABEL[entry.verdict]}</span></span>
          <span class="who">${stop.title}</span>
          ${stop.badge ? html`<span class="reward">${stop.badge}${stop.unlocks ? html` · ${moveName(stop.unlocks)} works outside battle` : ""}</span>` : ""}
          <span class="note">${stop.note}</span>
          <span class="team">${trainerFor(data, stop, starter).party.map((opponent) =>
            html`<span class="mon">${sprite(opponent.species)}<small>Lv${opponent.level}</small></span>`,
          )}</span>
          <span class="toggle"></span>
        </summary>
        <div class="more">
          <p class="assume">Your ${stage.name} at Lv ${entry.level}, using only level-up moves:</p>
          <ul class="rows">${entry.mons.map((opponent) =>
            html`<li><b class="vs">${data.species.get(opponent.species)!.name}</b>${hitText("YOU", opponent.you)}${hitText("IT", opponent.it)}</li>`,
          )}</ul>
        </div>
      </details>
      ${picks.length ? html`<div class="foresight">
        <p class="label">FORESIGHT · CATCH BEFORE THIS FIGHT</p>
        <ul class="picks">${picks.map(pickCard)}</ul>
      </div>` : ""}
    </li>${data.forks.filter((fork) => fork.after === stop.id).map(forkCard)}`;
  };

  const line: { id: string; level: number | null }[] = [{ id: starter, level: null }];
  for (let current = mon; current.evolutions[0]; current = data.species.get(current.evolutions[0].to)!) {
    line.push({ id: current.evolutions[0].to, level: Number(current.evolutions[0].param) });
  }
  const others = STARTERS.filter((other) => other !== starter);

  return page(
    {
      path: `/${starter}/`,
      title: `${mon.name}'s road through Pokémon Emerald | Eight Badges`,
      description: `Every gym, rival and boss on ${mon.name}'s road to Champion in Pokémon Emerald, what to catch before each one, and how it matches up.`,
      bodyClass: "road",
      starter,
    },
    html`${bar(mon.name, gems("scroll"))}
    <main>
      <header class="hero">
        <div class="line">${line.map((stage, i) =>
          html`${stage.level ? html`<span class="evo">Lv ${stage.level}</span>` : ""}${sprite(stage.id, { size: i === 0 ? 128 : 64, eager: true, ...(i === 0 ? { hero: `hero-${starter}` } : {}) })}`,
        )}</div>
        <h1>${mon.name}'S ROAD</h1>
        <p class="tally">${tally(entries)}</p>
        ${strip(entries, true)}
        <p class="method">Ratings use type matchups at the opponent's level, with level-up moves only. Foresight picks favor Pokémon that cover the fights your starter struggles with. It's a guide, not a battle sim. Rival teams shown are May's. Brendan's are the same or nearly so.</p>
      </header>
      <ol class="stops">${entries.map((entry, index) => stopCard(entry, index))}</ol>
      <section class="end">
        <h2>CHAMPION</h2>
        ${gems("shine")}
        <p>That's the road. Want a different one?</p>
        <nav class="others">${others.map((other) =>
          html`<a data-nav data-starter="${other}" href="/${other}/">${sprite(other)}<span>${data.species.get(other)!.name}</span></a>`,
        )}</nav>
      </section>
    </main>`,
  );
}
